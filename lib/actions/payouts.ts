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
 *   3. In a second transaction: settle it, or give the money back and record
 *      why it failed.
 *
 * If the process dies between 2 and 3 the payout stays `processing`, which is
 * the honest state: we genuinely do not know whether the money moved, and it
 * needs a human to check HesabPay before anything else happens to it.
 */

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db, withTransaction } from "@/lib/db";
import { sellerPayouts, tenants } from "@/lib/db/schema";
import { getUser, requireAuth } from "@/lib/auth/server";
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
import { MIN_PAYOUT_AFN, isValidHesabPayAccount } from "@/lib/payouts/constants";

export type PayoutActionResult = {
  success: boolean;
  error?: string;
  payoutId?: string;
};

/**
 * Set the HesabPay account a store's money is withdrawn to.
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
        error: "Only the store owner can change the payout account",
      };
    }

    const accountNumber = input.accountNumber.trim();
    const accountName = input.accountName.trim();

    if (!isValidHesabPayAccount(accountNumber)) {
      return {
        success: false,
        error: "Enter a valid HesabPay account number (digits only)",
      };
    }

    if (!accountName) {
      return {
        success: false,
        error: "Enter the name on the HesabPay account",
      };
    }

    const [store] = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, storeId))
      .limit(1);

    if (!store) return { success: false, error: "Store not found" };

    await db
      .update(tenants)
      .set({
        hesabpayAccountNumber: accountNumber,
        hesabpayAccountName: accountName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    revalidatePath(`/dashboard/${store.slug}/payments`);
    return { success: true };
  } catch (error) {
    console.error("[updatePayoutAccount] Error:", error);
    return { success: false, error: "Could not save the payout account" };
  }
}

/**
 * Withdraw available earnings to the store's HesabPay account.
 */
export async function requestPayout(
  storeId: string,
  amount: number
): Promise<PayoutActionResult> {
  try {
    const user = await getUser();
    if (!user) return { success: false, error: "You must be logged in" };

    const isOwner = await hasMinimumRole(storeId, "owner");
    if (!isOwner) {
      return {
        success: false,
        error: "Only the store owner can withdraw earnings",
      };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Enter an amount to withdraw" };
    }

    if (amount < MIN_PAYOUT_AFN) {
      return {
        success: false,
        error: `The smallest withdrawal is ${MIN_PAYOUT_AFN} ${PAYOUT_CURRENCY}`,
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

    if (!store) return { success: false, error: "Store not found" };

    if (!isValidHesabPayAccount(store.accountNumber)) {
      return {
        success: false,
        error: "Add your HesabPay account number before withdrawing",
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
        error: "Payouts are temporarily unavailable. Please contact support.",
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
          accountNumber: store.accountNumber as string,
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
        error: `You can withdraw up to ${Math.floor(reservation.available)} ${PAYOUT_CURRENCY}`,
      };
    }

    const { payoutId } = reservation;

    // --- 2. Move the money (no transaction open here) -----------------------
    const transfer = await hesabPayClient.sendMoneyToVendors(
      [
        {
          account_number: store.accountNumber as string,
          amount: requested,
        },
      ],
      credentials
    );

    // --- 3. Record the outcome ---------------------------------------------
    if (transfer.success) {
      await db
        .update(sellerPayouts)
        .set({
          status: "completed",
          gatewayResponse: transfer.gatewayResponse,
          settledAt: new Date().toISOString(),
        })
        .where(eq(sellerPayouts.id, payoutId));

      await settlePayout({ tenantId: storeId, amount: requested });

      revalidatePath(`/dashboard/${store.slug}/payments`);
      return { success: true, payoutId };
    }

    const reason = transfer.error || "HesabPay rejected the transfer";

    await db
      .update(sellerPayouts)
      .set({
        status: "failed",
        failureReason: reason,
        gatewayResponse: transfer.gatewayResponse,
        settledAt: new Date().toISOString(),
      })
      .where(eq(sellerPayouts.id, payoutId));

    await reversePayout({
      tenantId: storeId,
      amount: requested,
      payoutId,
      reason,
    });

    revalidatePath(`/dashboard/${store.slug}/payments`);
    return { success: false, error: reason, payoutId };
  } catch (error) {
    console.error("[requestPayout] Error:", error);
    return {
      success: false,
      error:
        "Something went wrong starting the withdrawal. Check your payout history before trying again.",
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
