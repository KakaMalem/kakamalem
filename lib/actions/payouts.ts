"use server";

/**
 * Seller payouts.
 *
 * Card payments land in the platform's HesabPay account, so withdrawing is the
 * platform sending money out of its own account to the seller's. That makes the
 * ordering here the important part:
 *
 *   1. In one transaction: lock the balance, reserve the amount, record the
 *      payout as `processing`. The money is now unspendable by anyone else.
 *   2. Outside any transaction: call HesabPay. Never hold a database
 *      transaction open across a network call.
 *   3. In a second transaction: settle it, give the money back, or leave it
 *      reserved when we do not know what happened.
 *
 * That third branch is the one that matters. HesabPay refusing is safe to undo.
 * HesabPay never answering is not, because the money may already have gone, so
 * the funds stay reserved and the payout stays `processing` until a human
 * checks. Guessing there is how a marketplace pays someone twice.
 */

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db, withTransaction } from "@/lib/db";
import { sellerPayouts, tenants } from "@/lib/db/schema";
import { getUser, requireAuth, requirePlatformAdmin } from "@/lib/auth/server";
import { hasMinimumRole } from "@/lib/auth/context";
import { getPlatformCredentials } from "@/lib/payments";
import { hesabPayClient } from "@/lib/payments/hesabpay";
import {
  PAYOUT_CURRENCY,
  getSellerBalance,
  reserveForPayout,
  reversePayout,
  settlePayout,
} from "@/lib/payouts/ledger";
import { MIN_PAYOUT_AFN } from "@/lib/payouts/constants";
import {
  PAYOUT_ACCOUNT_MESSAGES,
  normalizePayoutAccount,
} from "@/lib/payouts/account";
import { payoutError, type PayoutError } from "@/lib/payouts/errors";

export type PayoutActionResult = {
  success: boolean;
  error?: PayoutError;
  payoutId?: string;
};

/**
 * Set the HesabPay account a store's money is withdrawn to.
 *
 * Stored as E.164. HesabPay's own format is derived at send time.
 */
export async function updatePayoutAccount(
  storeId: string,
  input: { accountNumber: string; accountName: string }
): Promise<PayoutActionResult> {
  try {
    await requireAuth();

    // Changing where money goes is owner-only, even though admins can manage
    // the rest of the payments page.
    const isOwner = await hasMinimumRole(storeId, "owner");
    if (!isOwner) {
      return {
        success: false,
        error: payoutError(
          "permission",
          "Only the store owner can change the payout account"
        ),
      };
    }

    const normalized = normalizePayoutAccount(input.accountNumber);
    if (!normalized.ok) {
      return {
        success: false,
        error: payoutError(
          "validation",
          PAYOUT_ACCOUNT_MESSAGES[normalized.error],
          "accountNumber"
        ),
      };
    }

    const accountName = input.accountName.trim();
    if (!accountName) {
      return {
        success: false,
        error: payoutError(
          "validation",
          "Enter the name on the HesabPay account",
          "accountName"
        ),
      };
    }

    const [store] = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, storeId))
      .limit(1);

    if (!store) {
      return {
        success: false,
        error: payoutError("unexpected", "Store not found"),
      };
    }

    await db
      .update(tenants)
      .set({
        hesabpayAccountNumber: normalized.account.e164,
        hesabpayAccountName: accountName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    revalidatePath(`/dashboard/${store.slug}/payments`);
    return { success: true };
  } catch (error) {
    console.error("[updatePayoutAccount] Error:", error);
    return {
      success: false,
      error: payoutError(
        "unexpected",
        "Could not save the payout account. Please try again."
      ),
    };
  }
}

/**
 * Withdraw available earnings to the store's HesabPay account.
 */
export async function requestPayout(
  storeId: string,
  amount: number
): Promise<PayoutActionResult> {
  let payoutId: string | undefined;
  let reservedAmount = 0;
  let storeSlug = "";

  try {
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        error: payoutError("permission", "You must be logged in"),
      };
    }

    const isOwner = await hasMinimumRole(storeId, "owner");
    if (!isOwner) {
      return {
        success: false,
        error: payoutError(
          "permission",
          "Only the store owner can withdraw earnings"
        ),
      };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        error: payoutError(
          "validation",
          "Enter an amount to withdraw",
          "amount"
        ),
      };
    }

    if (amount < MIN_PAYOUT_AFN) {
      return {
        success: false,
        error: payoutError(
          "validation",
          `The smallest withdrawal is ${MIN_PAYOUT_AFN} ${PAYOUT_CURRENCY}`,
          "amount"
        ),
      };
    }

    const [store] = await db
      .select({
        slug: tenants.slug,
        accountNumber: tenants.hesabpayAccountNumber,
        accountName: tenants.hesabpayAccountName,
      })
      .from(tenants)
      .where(eq(tenants.id, storeId))
      .limit(1);

    if (!store) {
      return {
        success: false,
        error: payoutError("unexpected", "Store not found"),
      };
    }
    storeSlug = store.slug;

    // Re-validate the stored account. It may predate this validation, and a
    // transfer to a wrong-but-valid number cannot be undone.
    const normalized = normalizePayoutAccount(store.accountNumber);
    if (!normalized.ok) {
      return {
        success: false,
        error: payoutError(
          "validation",
          `${PAYOUT_ACCOUNT_MESSAGES[normalized.error]}. Update it above before withdrawing.`,
          "accountNumber"
        ),
      };
    }

    // Round to whole Afghani: HesabPay settles in whole units and a fractional
    // request would reserve money that can never be sent.
    const requested = Math.floor(amount);

    // Refuse before reserving anything if payouts are not configured at all,
    // so a misconfigured platform cannot strand a seller's money in `reserved`.
    const credentials = await getPlatformCredentials("hesabpay");
    if (!credentials?.apiKey || !credentials.merchantPin) {
      console.error(
        "[requestPayout] HESABPAY_API_KEY or HESABPAY_MERCHANT_PIN is missing"
      );
      return {
        success: false,
        error: payoutError(
          "configuration",
          "Payouts are not set up yet. Please contact support."
        ),
      };
    }

    // --- 1. Reserve the money and record the intent -------------------------
    const payoutNumber = `PO-${nanoid(10).toUpperCase()}`;

    const reservation = await withTransaction(async (tx) => {
      const [payout] = await tx
        .insert(sellerPayouts)
        .values({
          tenantId: storeId,
          payoutNumber,
          amount: requested.toFixed(2),
          currency: PAYOUT_CURRENCY,
          status: "processing",
          // Stored canonically; HesabPay's own format is derived below.
          accountNumber: normalized.account.e164,
          accountName: store.accountName,
          requestedBy: user.id,
        })
        .returning({ id: sellerPayouts.id });

      const reserved = await reserveForPayout({
        tenantId: storeId,
        amount: requested,
        payoutId: payout.id,
        tx,
      });

      if (!reserved.ok) {
        // Roll the whole thing back, including the payout row.
        throw new InsufficientBalanceError(reserved.available);
      }

      return { payoutId: payout.id };
    }).catch((error: unknown) => {
      if (error instanceof InsufficientBalanceError) {
        return { insufficient: true, available: error.available } as const;
      }
      throw error;
    });

    if ("insufficient" in reservation) {
      return {
        success: false,
        error: payoutError(
          "balance",
          `You can withdraw up to ${Math.floor(reservation.available)} ${PAYOUT_CURRENCY}`,
          "amount"
        ),
      };
    }

    payoutId = reservation.payoutId;
    reservedAmount = requested;

    // --- 2. Move the money (no transaction open here) -----------------------
    const transfer = await hesabPayClient.sendMoneyToVendors(
      [
        {
          // HesabPay wants the national number: no +93, no leading zero.
          account_number: normalized.account.hesabpay,
          amount: requested,
        },
      ],
      credentials
    );

    // --- 3. Record the outcome ---------------------------------------------
    if (transfer.status === "sent") {
      // One transaction: a payout that says "completed" and a balance that
      // still reserves the money would strand it with nothing to notice.
      await withTransaction(async (tx) => {
        await tx
          .update(sellerPayouts)
          .set({
            status: "completed",
            gatewayResponse: transfer.gatewayResponse,
            settledAt: new Date().toISOString(),
          })
          .where(eq(sellerPayouts.id, payoutId as string));

        await settlePayout({ tenantId: storeId, amount: requested, tx });
      });

      revalidatePath(`/dashboard/${storeSlug}/payments`);
      return { success: true, payoutId };
    }

    if (transfer.status === "unknown") {
      // We do not know whether the money moved. Leave it reserved and the
      // payout `processing`: returning it now risks paying twice.
      console.error(
        `[requestPayout] Payout ${payoutNumber} outcome unknown, left processing:`,
        transfer.message
      );

      await db
        .update(sellerPayouts)
        .set({
          failureReason: transfer.message,
          // Keep whatever HesabPay did say: this is exactly the payout a human
          // has to adjudicate, so the raw body is the evidence they need.
          gatewayResponse: transfer.gatewayResponse,
        })
        .where(eq(sellerPayouts.id, payoutId));

      revalidatePath(`/dashboard/${storeSlug}/payments`);
      return {
        success: false,
        payoutId,
        error: payoutError("unknown_outcome", transfer.message),
      };
    }

    if (transfer.reason === "configuration") {
      console.error(
        `[requestPayout] Payout ${payoutNumber} refused by our own configuration:`,
        transfer.message
      );
    }

    // Rejected: HesabPay answered and refused, so no money moved. Mark it and
    // give the balance back together, so the seller can never see a failed
    // withdrawal whose money has not come back.
    await withTransaction(async (tx) => {
      await tx
        .update(sellerPayouts)
        .set({
          status: "failed",
          failureReason:
            transfer.reason === "configuration"
              ? "Payouts were not configured correctly. No money was sent."
              : transfer.message,
          gatewayResponse: transfer.gatewayResponse,
          settledAt: new Date().toISOString(),
        })
        .where(eq(sellerPayouts.id, payoutId as string));

      await reversePayout({
        tenantId: storeId,
        amount: requested,
        payoutId: payoutId as string,
        reason: transfer.message,
        tx,
      });
    });

    revalidatePath(`/dashboard/${storeSlug}/payments`);
    return {
      success: false,
      payoutId,
      error:
        transfer.reason === "configuration"
          ? payoutError(
              "configuration",
              "Payouts are not set up correctly. Please contact support."
            )
          : payoutError("gateway", transfer.message),
    };
  } catch (error) {
    console.error("[requestPayout] Error:", error);

    // If we had already reserved the money, we cannot tell from here whether
    // the transfer went out, so treat it the same as an unknown outcome.
    if (payoutId && reservedAmount > 0) {
      return {
        success: false,
        payoutId,
        error: payoutError(
          "unknown_outcome",
          "Something went wrong after the withdrawal started. Check your HesabPay account before trying again."
        ),
      };
    }

    return {
      success: false,
      error: payoutError(
        "unexpected",
        "Something went wrong starting the withdrawal. Please try again."
      ),
    };
  }
}

/** Thrown inside the reservation transaction to roll it back cleanly. */
class InsufficientBalanceError extends Error {
  constructor(public available: number) {
    super("Insufficient balance");
    this.name = "InsufficientBalanceError";
  }
}

export type PayoutRecord = {
  id: string;
  payoutNumber: string;
  amount: number;
  currency: string;
  status: "processing" | "completed" | "failed";
  accountNumber: string;
  failureReason: string | null;
  requestedAt: string;
  settledAt: string | null;
};

/** Withdrawal history for a store, newest first. */
export async function getPayoutHistory(
  storeId: string,
  limit = 25
): Promise<PayoutRecord[]> {
  const canView = await hasMinimumRole(storeId, "admin");
  if (!canView) return [];

  const rows = await db
    .select()
    .from(sellerPayouts)
    .where(eq(sellerPayouts.tenantId, storeId))
    .orderBy(desc(sellerPayouts.requestedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    payoutNumber: row.payoutNumber,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    accountNumber: row.accountNumber,
    failureReason: row.failureReason,
    requestedAt: row.requestedAt,
    settledAt: row.settledAt,
  }));
}

/** Current withdrawable balance, for the dashboard. */
export async function getStoreBalance(storeId: string) {
  const canView = await hasMinimumRole(storeId, "admin");
  if (!canView) return null;
  return getSellerBalance(storeId);
}

// =============================================================================
// RESOLVING AN UNCONFIRMED PAYOUT
// =============================================================================

export type UnresolvedPayout = {
  id: string;
  payoutNumber: string;
  storeName: string;
  storeSlug: string;
  amount: number;
  currency: string;
  accountNumber: string;
  accountName: string | null;
  failureReason: string | null;
  requestedAt: string;
};

/**
 * Payouts we never got a clear answer on. Their money is still reserved, so
 * each one needs a human to look in HesabPay and say what really happened.
 */
export async function getUnresolvedPayouts(): Promise<UnresolvedPayout[]> {
  await requirePlatformAdmin();

  const rows = await db
    .select({
      id: sellerPayouts.id,
      payoutNumber: sellerPayouts.payoutNumber,
      storeName: tenants.name,
      storeSlug: tenants.slug,
      amount: sellerPayouts.amount,
      currency: sellerPayouts.currency,
      accountNumber: sellerPayouts.accountNumber,
      accountName: sellerPayouts.accountName,
      failureReason: sellerPayouts.failureReason,
      requestedAt: sellerPayouts.requestedAt,
    })
    .from(sellerPayouts)
    .innerJoin(tenants, eq(tenants.id, sellerPayouts.tenantId))
    .where(eq(sellerPayouts.status, "processing"))
    .orderBy(desc(sellerPayouts.requestedAt));

  return rows.map((row) => ({
    ...row,
    amount: parseFloat(row.amount),
  }));
}

/**
 * Close out a payout whose outcome we could not determine automatically.
 *
 * The admin checks HesabPay and tells us which way it went:
 * - `sent`: the money did leave, so release the reservation and count it paid.
 * - `not_sent`: it did not, so give the seller their balance back.
 *
 * The status flip is a conditional update, so two admins clicking at once
 * cannot both resolve the same payout and move the money twice.
 */
export async function resolveUnconfirmedPayout(
  payoutId: string,
  resolution: "sent" | "not_sent",
  note?: string
): Promise<PayoutActionResult> {
  try {
    await requirePlatformAdmin();

    const reason = (note || "").trim().slice(0, 300);

    // Claim the payout and move the money in one transaction. The conditional
    // status flip means only one caller can win, so two admins clicking at the
    // same moment cannot both resolve it.
    const resolved = await withTransaction(async (tx) => {
      const [claimed] = await tx
        .update(sellerPayouts)
        .set({
          status: resolution === "sent" ? "completed" : "failed",
          settledAt: new Date().toISOString(),
          failureReason:
            resolution === "sent"
              ? null
              : `Confirmed not sent${reason ? `: ${reason}` : ""}`,
        })
        .where(
          and(
            eq(sellerPayouts.id, payoutId),
            eq(sellerPayouts.status, "processing")
          )
        )
        .returning({
          id: sellerPayouts.id,
          tenantId: sellerPayouts.tenantId,
          amount: sellerPayouts.amount,
        });

      if (!claimed) return null;

      const amount = parseFloat(claimed.amount);

      if (resolution === "sent") {
        await settlePayout({ tenantId: claimed.tenantId, amount, tx });
      } else {
        await reversePayout({
          tenantId: claimed.tenantId,
          amount,
          payoutId: claimed.id,
          reason: reason || "Confirmed not sent by HesabPay",
          tx,
        });
      }

      return claimed.id;
    });

    if (!resolved) {
      return {
        success: false,
        error: payoutError(
          "validation",
          "That withdrawal has already been resolved"
        ),
      };
    }

    revalidatePath("/admin/payments");
    return { success: true, payoutId: resolved };
  } catch (error) {
    console.error("[resolveUnconfirmedPayout] Error:", error);
    return {
      success: false,
      error: payoutError("unexpected", "Could not resolve that withdrawal"),
    };
  }
}
