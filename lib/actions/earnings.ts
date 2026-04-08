"use server";

/**
 * Seller Earnings Server Actions
 *
 * Handles all seller earnings operations including:
 * - Managing payout methods (bank, mobile money)
 * - Requesting payouts
 * - Updating payout settings
 */

import { revalidatePath } from "next/cache";
import { eq, and, ne, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  sellerBalances,
  sellerPayoutMethods,
  sellerPayouts,
  sellerTransactions,
} from "@/lib/db/schema";
import { requireAuth, isPlatformAdmin } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import {
  payoutMethodSchema,
  requestPayoutSchema,
  payoutSettingsSchema,
  type PayoutMethodInput,
  type RequestPayoutInput,
  type PayoutSettingsInput,
} from "@/lib/validations/earnings";
import {
  getSellerBalance,
  getPayoutMethodById,
  generatePayoutNumber,
} from "@/lib/db/queries/earnings";

// =============================================================================
// TYPES
// =============================================================================

type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

// =============================================================================
// PAYOUT METHODS
// =============================================================================

/**
 * Add a new payout method for a store
 */
export async function addPayoutMethod(
  tenantId: string,
  input: PayoutMethodInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Validate input
    const validated = payoutMethodSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validated.data;

    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db
        .update(sellerPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(eq(sellerPayoutMethods.tenantId, tenantId));
    }

    // Build insert values based on type
    const baseValues = {
      tenantId,
      type: data.type,
      label: data.label,
      isDefault: data.isDefault,
    };

    let insertValues: typeof baseValues & Record<string, unknown>;

    switch (data.type) {
      case "bank_transfer":
        insertValues = {
          ...baseValues,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          bankCode: data.bankCode,
          routingNumber: data.routingNumber,
          swiftCode: data.swiftCode,
          iban: data.iban,
        };
        break;
      case "mobile_money":
        insertValues = {
          ...baseValues,
          mobileNumber: data.mobileNumber,
          mobileProvider: data.mobileProvider,
          accountName: data.accountName,
        };
        break;
      case "cash":
        insertValues = {
          ...baseValues,
          additionalInfo: data.additionalInfo,
        };
        break;
      case "crypto":
        insertValues = {
          ...baseValues,
          walletAddress: data.walletAddress,
          additionalInfo: { network: data.network }, // Store network in additionalInfo
        };
        break;
      default:
        insertValues = baseValues;
    }

    // Insert the payout method
    const [newMethod] = await db
      .insert(sellerPayoutMethods)
      .values(insertValues)
      .returning({ id: sellerPayoutMethods.id });

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true, data: { id: newMethod.id } };
  } catch (error) {
    console.error("[addPayoutMethod] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add payout method",
    };
  }
}

/**
 * Update an existing payout method
 */
export async function updatePayoutMethod(
  tenantId: string,
  methodId: string,
  input: Partial<PayoutMethodInput>
): Promise<ActionResult> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Check method exists and belongs to this tenant
    const existingMethod = await getPayoutMethodById(methodId, tenantId);
    if (!existingMethod) {
      return { success: false, error: "Payout method not found" };
    }

    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await db
        .update(sellerPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(sellerPayoutMethods.tenantId, tenantId),
            ne(sellerPayoutMethods.id, methodId)
          )
        );
    }

    // Update the method
    await db
      .update(sellerPayoutMethods)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerPayoutMethods.id, methodId));

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true };
  } catch (error) {
    console.error("[updatePayoutMethod] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update payout method",
    };
  }
}

/**
 * Delete a payout method
 */
export async function deletePayoutMethod(
  tenantId: string,
  methodId: string
): Promise<ActionResult> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Check method exists and belongs to this tenant
    const existingMethod = await getPayoutMethodById(methodId, tenantId);
    if (!existingMethod) {
      return { success: false, error: "Payout method not found" };
    }

    // Check if there are pending payouts using this method
    const [pendingPayout] = await db
      .select({ id: sellerPayouts.id })
      .from(sellerPayouts)
      .where(
        and(
          eq(sellerPayouts.payoutMethodId, methodId),
          eq(sellerPayouts.status, "pending")
        )
      )
      .limit(1);

    if (pendingPayout) {
      return {
        success: false,
        error: "Cannot delete method with pending payouts",
      };
    }

    // Delete the method
    await db
      .delete(sellerPayoutMethods)
      .where(eq(sellerPayoutMethods.id, methodId));

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true };
  } catch (error) {
    console.error("[deletePayoutMethod] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete payout method",
    };
  }
}

/**
 * Set a payout method as default
 */
export async function setDefaultPayoutMethod(
  tenantId: string,
  methodId: string
): Promise<ActionResult> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Check method exists and belongs to this tenant
    const existingMethod = await getPayoutMethodById(methodId, tenantId);
    if (!existingMethod) {
      return { success: false, error: "Payout method not found" };
    }

    // Unset other defaults
    await db
      .update(sellerPayoutMethods)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(sellerPayoutMethods.tenantId, tenantId));

    // Set this one as default
    await db
      .update(sellerPayoutMethods)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(sellerPayoutMethods.id, methodId));

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true };
  } catch (error) {
    console.error("[setDefaultPayoutMethod] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default",
    };
  }
}

// =============================================================================
// PAYOUT REQUESTS
// =============================================================================

/**
 * Request a payout
 */
export async function requestPayout(
  tenantId: string,
  input: RequestPayoutInput
): Promise<ActionResult<{ payoutId: string; payoutNumber: string }>> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Validate input
    const validated = requestPayoutSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Invalid input",
      };
    }

    const { amount, payoutMethodId, notes } = validated.data;

    // Check payout method exists
    const payoutMethod = await getPayoutMethodById(payoutMethodId, tenantId);
    if (!payoutMethod) {
      return { success: false, error: "Payout method not found" };
    }

    // Generate payout number
    const payoutNumber = await generatePayoutNumber(tenantId);

    // Withdrawal fee — covers TRC20 gas (~$0.30) + small platform overhead
    const WITHDRAWAL_FEE = 0.5;
    const fee = WITHDRAWAL_FEE;
    const netAmount = amount - fee;

    if (netAmount <= 0) {
      return {
        success: false,
        error: `Amount too small after ${fee} USDT withdrawal fee`,
      };
    }

    // Entire balance check + deduction inside a single transaction
    // with row-level locking to prevent double-withdrawal race condition
    const result = await db.transaction(async (tx) => {
      // Lock the balance row and read it atomically
      const [balance] = await tx
        .select()
        .from(sellerBalances)
        .where(eq(sellerBalances.tenantId, tenantId))
        .for("update"); // PostgreSQL row-level lock

      if (!balance) {
        throw new Error("Seller balance not found");
      }

      const availableBalance = parseFloat(balance.available);

      // Check if enough balance (inside the lock)
      if (amount > availableBalance) {
        throw new Error(
          `Insufficient balance. Available: ${availableBalance.toFixed(2)}`
        );
      }

      // Update balance: move from available to reserved
      const newAvailable = availableBalance - amount;
      const newReserved = parseFloat(balance.reserved) + amount;

      await tx
        .update(sellerBalances)
        .set({
          available: newAvailable.toString(),
          reserved: newReserved.toString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sellerBalances.tenantId, tenantId));

      // Create payout record
      const [payout] = await tx
        .insert(sellerPayouts)
        .values({
          tenantId,
          payoutMethodId,
          payoutNumber,
          amount: amount.toString(),
          fee: fee.toString(),
          netAmount: netAmount.toString(),
          currency: balance.currency,
          status: "pending",
          notes,
        })
        .returning({ id: sellerPayouts.id });

      // Create transaction record
      await tx.insert(sellerTransactions).values({
        tenantId,
        type: "payout",
        amount: (-amount).toString(), // Negative because money is leaving
        currency: balance.currency,
        availableAfter: newAvailable.toString(),
        pendingAfter: balance.pending,
        reservedAfter: newReserved.toString(),
        payoutId: payout.id,
        description: `Payout request ${payoutNumber} (fee: ${fee} USDT)`,
        notes,
      });

      return payout;
    });

    revalidatePath(`/dashboard/[slug]/earnings`);
    return {
      success: true,
      data: { payoutId: result.id, payoutNumber },
    };
  } catch (error) {
    console.error("[requestPayout] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request payout",
    };
  }
}

/**
 * Cancel a pending payout request
 */
export async function cancelPayoutRequest(
  tenantId: string,
  payoutId: string
): Promise<ActionResult> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Get the payout
    const [payout] = await db
      .select()
      .from(sellerPayouts)
      .where(
        and(
          eq(sellerPayouts.id, payoutId),
          eq(sellerPayouts.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!payout) {
      return { success: false, error: "Payout not found" };
    }

    // Can only cancel pending payouts
    if (payout.status !== "pending") {
      return {
        success: false,
        error: `Cannot cancel payout with status: ${payout.status}`,
      };
    }

    // Get current balance
    const balance = await getSellerBalance(tenantId);
    const payoutAmount = parseFloat(payout.amount);

    // Reverse the balance changes
    await db.transaction(async (tx) => {
      const newAvailable = parseFloat(balance.available) + payoutAmount;
      const newReserved = parseFloat(balance.reserved) - payoutAmount;

      await tx
        .update(sellerBalances)
        .set({
          available: newAvailable.toString(),
          reserved: newReserved.toString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sellerBalances.tenantId, tenantId));

      // Update payout status
      await tx
        .update(sellerPayouts)
        .set({
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sellerPayouts.id, payoutId));

      // Create reversal transaction
      await tx.insert(sellerTransactions).values({
        tenantId,
        type: "payout_reversal",
        amount: payoutAmount.toString(), // Positive because money is coming back
        currency: balance.currency,
        availableAfter: newAvailable.toString(),
        pendingAfter: balance.pending,
        reservedAfter: newReserved.toString(),
        payoutId,
        description: `Payout cancelled: ${payout.payoutNumber}`,
      });
    });

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true };
  } catch (error) {
    console.error("[cancelPayoutRequest] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel payout",
    };
  }
}

// =============================================================================
// PAYOUT SETTINGS
// =============================================================================

/**
 * Update payout settings (auto-payout, thresholds)
 */
export async function updatePayoutSettings(
  tenantId: string,
  input: PayoutSettingsInput
): Promise<ActionResult> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Validate input
    const validated = payoutSettingsSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Invalid input",
      };
    }

    const { autoPayout, autoPayoutThreshold, payoutHoldDays } = validated.data;

    // Ensure balance record exists
    await getSellerBalance(tenantId);

    // Update settings
    await db
      .update(sellerBalances)
      .set({
        autoPayout,
        autoPayoutThreshold: autoPayoutThreshold?.toString(),
        payoutHoldDays,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.tenantId, tenantId));

    revalidatePath(`/dashboard/[slug]/earnings`);
    return { success: true };
  } catch (error) {
    console.error("[updatePayoutSettings] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

// =============================================================================
// INTERNAL EARNINGS FUNCTIONS (called from webhooks)
// =============================================================================

/**
 * Credit seller earnings when an order is paid
 *
 * This is called from payment webhooks (HesabPay, Stripe) when an order payment
 * is confirmed. The amount goes to pending balance first, then becomes available
 * after the holding period.
 *
 * @param tenantId - The store's tenant ID
 * @param orderId - The order ID
 * @param orderNumber - The order number for description
 * @param amount - The amount to credit (typically the order total)
 * @param currency - The currency code (default: AFN)
 * @param gateway - The payment gateway used (for description)
 */
export async function creditSellerEarnings(
  tenantId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  currency: string = "USDT",
  gateway?: string
): Promise<ActionResult> {
  try {
    // Get or create seller balance
    const balance = await getSellerBalance(tenantId);

    // Calculate new balances
    const currentPending = parseFloat(balance.pending);
    const newPending = currentPending + amount;

    // Update balance
    await db
      .update(sellerBalances)
      .set({
        pending: newPending.toString(),
        lifetimeEarnings: (
          parseFloat(balance.lifetimeEarnings) + amount
        ).toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.tenantId, tenantId));

    // Create transaction record
    await db.insert(sellerTransactions).values({
      tenantId,
      type: "sale",
      amount: amount.toString(),
      currency,
      availableAfter: balance.available, // Available stays the same
      pendingAfter: newPending.toString(),
      reservedAfter: balance.reserved,
      orderId,
      description: `Sale from order ${orderNumber}${gateway ? ` via ${gateway}` : ""}`,
    });

    console.log(
      `[creditSellerEarnings] Credited ${amount} ${currency} to tenant ${tenantId} for order ${orderNumber}`
    );

    return { success: true };
  } catch (error) {
    console.error("[creditSellerEarnings] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to credit earnings",
    };
  }
}

/**
 * Debit seller earnings for a refund
 *
 * This is called when an order is refunded. The amount is deducted from
 * available balance (if sufficient) or pending balance.
 */
export async function debitSellerEarningsForRefund(
  tenantId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  currency: string = "USDT"
): Promise<ActionResult> {
  try {
    // Get seller balance
    const balance = await getSellerBalance(tenantId);

    const currentAvailable = parseFloat(balance.available);
    const currentPending = parseFloat(balance.pending);

    // Deduct from available first, then pending
    let newAvailable = currentAvailable;
    let newPending = currentPending;

    if (amount <= currentAvailable) {
      // Deduct entirely from available
      newAvailable = currentAvailable - amount;
    } else {
      // Deduct available first, then pending
      const remainingToDeduct = amount - currentAvailable;
      newAvailable = 0;
      newPending = Math.max(0, currentPending - remainingToDeduct);
    }

    // Update balance
    await db
      .update(sellerBalances)
      .set({
        available: newAvailable.toString(),
        pending: newPending.toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.tenantId, tenantId));

    // Create transaction record
    await db.insert(sellerTransactions).values({
      tenantId,
      type: "refund",
      amount: (-amount).toString(), // Negative for refund
      currency,
      availableAfter: newAvailable.toString(),
      pendingAfter: newPending.toString(),
      reservedAfter: balance.reserved,
      orderId,
      description: `Refund for order ${orderNumber}`,
    });

    console.log(
      `[debitSellerEarningsForRefund] Debited ${amount} ${currency} from tenant ${tenantId} for order ${orderNumber}`
    );

    return { success: true };
  } catch (error) {
    console.error("[debitSellerEarningsForRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to debit earnings",
    };
  }
}

// =============================================================================
// ADMIN PAYOUT PROCESSING
// =============================================================================

/**
 * Admin: Mark a payout as processing (admin has seen it and will send)
 */
export async function adminMarkPayoutProcessing(
  payoutId: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return {
        success: false,
        error: "Only platform admin can process payouts",
      };
    }

    const payout = await db.query.sellerPayouts.findFirst({
      where: eq(sellerPayouts.id, payoutId),
    });

    if (!payout) {
      return { success: false, error: "Payout not found" };
    }

    if (payout.status !== "pending") {
      return { success: false, error: `Payout is already ${payout.status}` };
    }

    await db
      .update(sellerPayouts)
      .set({
        status: "processing",
        processedAt: new Date().toISOString(),
        processedById: user.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerPayouts.id, payoutId));

    revalidatePath("/admin/payouts");
    return { success: true };
  } catch (error) {
    console.error("[adminMarkPayoutProcessing] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process",
    };
  }
}

/**
 * Admin: Mark a payout as completed — funds have been sent
 */
export async function adminCompletePayout(
  payoutId: string,
  txHash?: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return {
        success: false,
        error: "Only platform admin can complete payouts",
      };
    }

    const payout = await db.query.sellerPayouts.findFirst({
      where: eq(sellerPayouts.id, payoutId),
    });

    if (!payout) {
      return { success: false, error: "Payout not found" };
    }

    if (payout.status !== "pending" && payout.status !== "processing") {
      return {
        success: false,
        error: `Cannot complete payout in ${payout.status} status`,
      };
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      // Update payout status
      await tx
        .update(sellerPayouts)
        .set({
          status: "completed",
          completedAt: now,
          processedById: user.id,
          ...(txHash ? { cryptoTxHash: txHash, cryptoSentAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(sellerPayouts.id, payoutId));

      // Move from reserved to paid out
      const [balance] = await tx
        .select()
        .from(sellerBalances)
        .where(eq(sellerBalances.tenantId, payout.tenantId))
        .for("update");

      if (balance) {
        const payoutAmount = parseFloat(payout.amount);
        const newReserved = Math.max(
          0,
          parseFloat(balance.reserved) - payoutAmount
        );
        const newLifetimePaidOut =
          parseFloat(balance.lifetimePaidOut) + payoutAmount;

        await tx
          .update(sellerBalances)
          .set({
            reserved: newReserved.toString(),
            lifetimePaidOut: newLifetimePaidOut.toString(),
            updatedAt: now,
          })
          .where(eq(sellerBalances.tenantId, payout.tenantId));
      }
    });

    revalidatePath("/admin/payouts");
    return { success: true };
  } catch (error) {
    console.error("[adminCompletePayout] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete",
    };
  }
}

/**
 * Admin: Reject/fail a payout — return funds to seller's available balance
 */
export async function adminRejectPayout(
  payoutId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return {
        success: false,
        error: "Only platform admin can reject payouts",
      };
    }

    const payout = await db.query.sellerPayouts.findFirst({
      where: eq(sellerPayouts.id, payoutId),
    });

    if (!payout) {
      return { success: false, error: "Payout not found" };
    }

    if (payout.status !== "pending" && payout.status !== "processing") {
      return {
        success: false,
        error: `Cannot reject payout in ${payout.status} status`,
      };
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      // Update payout status
      await tx
        .update(sellerPayouts)
        .set({
          status: "failed",
          failedAt: now,
          failureReason: reason,
          processedById: user.id,
          updatedAt: now,
        })
        .where(eq(sellerPayouts.id, payoutId));

      // Return funds: move from reserved back to available
      const [balance] = await tx
        .select()
        .from(sellerBalances)
        .where(eq(sellerBalances.tenantId, payout.tenantId))
        .for("update");

      if (balance) {
        const payoutAmount = parseFloat(payout.amount);
        const newAvailable = parseFloat(balance.available) + payoutAmount;
        const newReserved = Math.max(
          0,
          parseFloat(balance.reserved) - payoutAmount
        );

        await tx
          .update(sellerBalances)
          .set({
            available: newAvailable.toString(),
            reserved: newReserved.toString(),
            updatedAt: now,
          })
          .where(eq(sellerBalances.tenantId, payout.tenantId));

        // Create reversal transaction
        await tx.insert(sellerTransactions).values({
          tenantId: payout.tenantId,
          type: "payout_reversal",
          amount: payoutAmount.toString(),
          currency: balance.currency,
          availableAfter: newAvailable.toString(),
          pendingAfter: balance.pending,
          reservedAfter: newReserved.toString(),
          payoutId: payout.id,
          description: `Payout ${payout.payoutNumber} rejected: ${reason}`,
        });
      }
    });

    revalidatePath("/admin/payouts");
    return { success: true };
  } catch (error) {
    console.error("[adminRejectPayout] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject",
    };
  }
}

// =============================================================================
// PENDING → AVAILABLE MATURATION
// =============================================================================

/**
 * Move matured pending earnings to available balance.
 *
 * Called by a cron job. For each tenant with pending balance, finds sale
 * transactions older than payoutHoldDays and moves that amount from
 * pending to available. Uses metadata flag to avoid double-processing.
 */
export async function maturePendingEarnings(): Promise<{
  success: boolean;
  matured: number;
  error?: string;
}> {
  try {
    // Get all tenants with pending balance > 0
    const balancesWithPending = await db.query.sellerBalances.findMany({
      where: and(
        ne(sellerBalances.pending, "0"),
        ne(sellerBalances.pending, "0.00")
      ),
    });

    let matured = 0;

    for (const balance of balancesWithPending) {
      const holdDays = balance.payoutHoldDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - holdDays);

      // Find unmatured sale transactions older than the hold period
      const matureTransactions = await db.query.sellerTransactions.findMany({
        where: and(
          eq(sellerTransactions.tenantId, balance.tenantId),
          eq(sellerTransactions.type, "sale"),
          lte(sellerTransactions.createdAt, cutoffDate.toISOString())
        ),
      });

      // Filter to only unprocessed ones
      const unmatured = matureTransactions.filter(
        (tx) => !(tx.metadata as Record<string, unknown> | null)?.matured
      );

      if (unmatured.length === 0) continue;

      const amountToMature = unmatured.reduce(
        (sum, tx) => sum + Math.max(0, parseFloat(tx.amount)),
        0
      );

      if (amountToMature <= 0) continue;

      await db.transaction(async (tx) => {
        const [currentBalance] = await tx
          .select()
          .from(sellerBalances)
          .where(eq(sellerBalances.tenantId, balance.tenantId))
          .for("update");

        if (!currentBalance) return;

        const currentPending = parseFloat(currentBalance.pending);
        const currentAvailable = parseFloat(currentBalance.available);
        const actualMove = Math.min(amountToMature, currentPending);
        if (actualMove <= 0) return;

        await tx
          .update(sellerBalances)
          .set({
            pending: (currentPending - actualMove).toFixed(2),
            available: (currentAvailable + actualMove).toFixed(2),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sellerBalances.tenantId, balance.tenantId));

        // Mark transactions as matured
        for (const utx of unmatured) {
          await tx
            .update(sellerTransactions)
            .set({
              metadata: {
                ...(utx.metadata as Record<string, unknown> | null),
                matured: true,
                maturedAt: new Date().toISOString(),
              },
            })
            .where(eq(sellerTransactions.id, utx.id));
        }
      });

      matured++;
    }

    return { success: true, matured };
  } catch (error) {
    console.error("[maturePendingEarnings] Error:", error);
    return {
      success: false,
      matured: 0,
      error: error instanceof Error ? error.message : "Failed to mature",
    };
  }
}
