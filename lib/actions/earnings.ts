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
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  sellerBalances,
  sellerPayoutMethods,
  sellerPayouts,
  sellerTransactions,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/server";
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

    // Get seller balance
    const balance = await getSellerBalance(tenantId);
    const availableBalance = parseFloat(balance.available);

    // Check if enough balance
    if (amount > availableBalance) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${availableBalance.toFixed(2)}`,
      };
    }

    // Check payout method exists
    const payoutMethod = await getPayoutMethodById(payoutMethodId, tenantId);
    if (!payoutMethod) {
      return { success: false, error: "Payout method not found" };
    }

    // Generate payout number
    const payoutNumber = await generatePayoutNumber(tenantId);

    // Calculate fee (could be configurable later)
    const fee = 0; // No fee for now
    const netAmount = amount - fee;

    // Start transaction
    const result = await db.transaction(async (tx) => {
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
        description: `Payout request ${payoutNumber}`,
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
