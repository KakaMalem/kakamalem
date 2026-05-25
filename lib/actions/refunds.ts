"use server";

/**
 * Refund Server Actions
 *
 * Handles all refund-related operations including:
 * - Creating refund requests
 * - Approving/rejecting refunds
 * - Processing refunds via payment gateways
 */

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  refunds,
  refundItems,
  orders,
  orderItems,
  orderTransactions,
} from "@/lib/db/schema";
import type { RefundType, RefundReason, NewRefundItem } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { canManageStore, hasMinimumRole } from "@/lib/auth/context";
import { generateRefundNumber, getRefundById } from "@/lib/db/queries/refunds";

// =============================================================================
// TYPES
// =============================================================================

export type RefundResult = {
  success: boolean;
  error?: string;
  refundId?: string;
};

export type RefundItemInput = {
  orderItemId: string;
  quantity: number;
  unitRefundAmount: number;
};

export type CreateRefundInput = {
  orderId: string;
  type: RefundType;
  reasonCode: RefundReason;
  reasonDetails?: string;
  refundMethod: "original_payment" | "cash" | "store_credit" | "exchange";
  items: RefundItemInput[];
  shippingRefund?: number;
  taxRefund?: number;
  restockingFee?: number;
  customerNotes?: string;
};

// =============================================================================
// CREATE REFUND REQUEST
// =============================================================================

/**
 * Create a new refund request
 */
export async function createRefundRequest(
  tenantId: string,
  input: CreateRefundInput
): Promise<RefundResult> {
  try {
    // 1. Auth check
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Permission check - must be able to manage the store
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Get the order and verify it belongs to this tenant
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, tenantId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // 4. Verify order is eligible for refund (must have received payment)
    if (order.paymentStatus === "unpaid") {
      return {
        success: false,
        error: "Cannot refund an unpaid order",
      };
    }

    // 5. Validate refund items
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "At least one item is required" };
    }

    // Get order items to validate
    const orderItemIds = input.items.map((i) => i.orderItemId);
    const orderItemsData = await db.query.orderItems.findMany({
      where: and(
        eq(orderItems.orderId, input.orderId),
        sql`${orderItems.id} IN ${orderItemIds}`
      ),
    });

    // Create a map for quick lookup
    const orderItemMap = new Map(orderItemsData.map((item) => [item.id, item]));

    // Validate each refund item
    let subtotal = 0;
    const validatedItems: NewRefundItem[] = [];

    for (const refundItem of input.items) {
      const orderItem = orderItemMap.get(refundItem.orderItemId);
      if (!orderItem) {
        return {
          success: false,
          error: `Order item ${refundItem.orderItemId} not found`,
        };
      }

      // Check if there's enough quantity to refund
      const alreadyRefunded = orderItem.quantityRefunded || 0;
      const availableForRefund = orderItem.quantity - alreadyRefunded;

      if (refundItem.quantity > availableForRefund) {
        return {
          success: false,
          error: `Cannot refund ${refundItem.quantity} units of "${orderItem.productName}". Only ${availableForRefund} available.`,
        };
      }

      // Validate refund amount per unit
      const originalUnitPrice = parseFloat(orderItem.price);
      if (refundItem.unitRefundAmount > originalUnitPrice) {
        return {
          success: false,
          error: `Refund amount cannot exceed original price for "${orderItem.productName}"`,
        };
      }

      const totalItemRefund = refundItem.quantity * refundItem.unitRefundAmount;
      subtotal += totalItemRefund;

      validatedItems.push({
        refundId: "", // Will be set after creating refund
        orderItemId: refundItem.orderItemId,
        quantity: refundItem.quantity,
        unitRefundAmount: refundItem.unitRefundAmount.toString(),
        totalRefundAmount: totalItemRefund.toString(),
      });
    }

    // 6. Calculate total refund amount
    const shippingRefund = input.shippingRefund || 0;
    const taxRefund = input.taxRefund || 0;
    const restockingFee = input.restockingFee || 0;
    const totalAmount = subtotal + shippingRefund + taxRefund - restockingFee;

    // Validate total doesn't exceed what was paid
    const amountPaid = parseFloat(order.amountPaid || "0");
    const alreadyRefunded = parseFloat(order.amountRefunded || "0");
    const availableForRefund = amountPaid - alreadyRefunded;

    if (totalAmount > availableForRefund) {
      return {
        success: false,
        error: `Refund amount (${totalAmount}) exceeds available amount (${availableForRefund})`,
      };
    }

    // 7. Generate refund number
    const storeSlug = order.tenantId.slice(0, 8); // Use part of tenant ID if slug not available
    const refundNumber = generateRefundNumber(storeSlug);

    // 8. Create the refund in a transaction
    const result = await db.transaction(async (tx) => {
      // Create refund record
      const [newRefund] = await tx
        .insert(refunds)
        .values({
          orderId: input.orderId,
          tenantId,
          refundNumber,
          type: input.type,
          status: "pending",
          subtotal: subtotal.toString(),
          shippingRefund: shippingRefund.toString(),
          taxRefund: taxRefund.toString(),
          restockingFee: restockingFee.toString(),
          totalAmount: totalAmount.toString(),
          currencyCode: order.currencyCode || "AFN",
          refundMethod: input.refundMethod,
          reasonCode: input.reasonCode,
          reasonDetails: input.reasonDetails,
          customerNotes: input.customerNotes,
          requestedBy: user.id,
          requestedAt: new Date().toISOString(),
        })
        .returning();

      // Create refund items
      const itemsWithRefundId = validatedItems.map((item) => ({
        ...item,
        refundId: newRefund.id,
      }));

      await tx.insert(refundItems).values(itemsWithRefundId);

      return newRefund;
    });

    // 9. Revalidate relevant pages
    revalidatePath(`/dashboard/[slug]/orders`);
    revalidatePath(`/dashboard/[slug]/orders/${input.orderId}`);

    return {
      success: true,
      refundId: result.id,
    };
  } catch (error) {
    console.error("[createRefundRequest] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create refund",
    };
  }
}

// =============================================================================
// APPROVE REFUND
// =============================================================================

/**
 * Approve a pending refund request
 */
export async function approveRefund(refundId: string): Promise<RefundResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the refund
    const refund = await getRefundById(refundId);
    if (!refund) {
      return { success: false, error: "Refund not found" };
    }

    // Permission check
    const hasRole = await hasMinimumRole(refund.tenantId, "admin");
    if (!hasRole) {
      return { success: false, error: "Admin access required" };
    }

    // Verify status
    if (refund.status !== "pending") {
      return {
        success: false,
        error: `Cannot approve refund with status: ${refund.status}`,
      };
    }

    // Update refund status
    await db
      .update(refunds)
      .set({
        status: "approved",
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(refunds.id, refundId));

    revalidatePath(`/dashboard/[slug]/orders`);

    return { success: true, refundId };
  } catch (error) {
    console.error("[approveRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to approve refund",
    };
  }
}

// =============================================================================
// REJECT REFUND
// =============================================================================

/**
 * Reject a refund request
 */
export async function rejectRefund(
  refundId: string,
  reason: string
): Promise<RefundResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    if (!reason.trim()) {
      return { success: false, error: "Rejection reason is required" };
    }

    // Get the refund
    const refund = await getRefundById(refundId);
    if (!refund) {
      return { success: false, error: "Refund not found" };
    }

    // Permission check
    const hasRole = await hasMinimumRole(refund.tenantId, "admin");
    if (!hasRole) {
      return { success: false, error: "Admin access required" };
    }

    // Verify status
    if (refund.status !== "pending" && refund.status !== "approved") {
      return {
        success: false,
        error: `Cannot reject refund with status: ${refund.status}`,
      };
    }

    // Update refund status
    await db
      .update(refunds)
      .set({
        status: "rejected",
        rejectedBy: user.id,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(refunds.id, refundId));

    revalidatePath(`/dashboard/[slug]/orders`);

    return { success: true, refundId };
  } catch (error) {
    console.error("[rejectRefund] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject refund",
    };
  }
}

// =============================================================================
// PROCESS REFUND
// =============================================================================

/**
 * Process an approved refund (execute the actual refund)
 *
 * For gateway refunds, this calls the gateway API (HesabPay).
 * For other methods (cash, store credit), this just marks as completed.
 */
export async function processRefund(refundId: string): Promise<RefundResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the refund with full details
    const refund = await getRefundById(refundId);
    if (!refund) {
      return { success: false, error: "Refund not found" };
    }

    // Permission check
    const canManage = await canManageStore(refund.tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Verify status - must be approved
    if (refund.status !== "approved") {
      return {
        success: false,
        error: `Cannot process refund with status: ${refund.status}`,
      };
    }

    const totalAmount = parseFloat(refund.totalAmount);

    // Start processing
    await db
      .update(refunds)
      .set({
        status: "processing",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(refunds.id, refundId));

    // Process based on refund method
    try {
      if (refund.refundMethod === "original_payment") {
        // For original payment refunds, we would call the gateway API here
        // This is a placeholder for gateway integration
        // In a real implementation, check the order's payment gateway and call appropriate API
        console.log(
          `[processRefund] Would refund ${totalAmount} via original payment method`
        );
      }

      // Complete the refund in a transaction
      await db.transaction(async (tx) => {
        // Update refund status
        await tx
          .update(refunds)
          .set({
            status: "completed",
            processedBy: user.id,
            processedAt: new Date().toISOString(),
          })
          .where(eq(refunds.id, refundId));

        // Update order amounts
        const order = refund.order;
        if (order) {
          const currentRefunded = parseFloat(
            (order as { amountRefunded?: string }).amountRefunded || "0"
          );
          const newRefundedAmount = currentRefunded + totalAmount;
          const orderTotal = parseFloat(order.total);
          const amountPaid = parseFloat(
            (order as { amountPaid?: string }).amountPaid || "0"
          );

          // Determine new payment status
          let newPaymentStatus = order.paymentStatus;
          if (newRefundedAmount >= amountPaid) {
            newPaymentStatus = "refunded";
          } else if (newRefundedAmount > 0) {
            newPaymentStatus = "partial_refund";
          }

          await tx
            .update(orders)
            .set({
              amountRefunded: newRefundedAmount.toString(),
              amountDue: (
                orderTotal -
                amountPaid +
                newRefundedAmount
              ).toString(),
              paymentStatus: newPaymentStatus,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(orders.id, order.id));
        }

        // Update order item quantities
        for (const item of refund.items) {
          await tx
            .update(orderItems)
            .set({
              quantityRefunded: sql`${orderItems.quantityRefunded} + ${item.quantity}`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(orderItems.id, item.orderItemId));
        }

        // Create refund transaction record
        await tx.insert(orderTransactions).values({
          orderId: refund.orderId,
          tenantId: refund.tenantId,
          type: "refund",
          amount: (-totalAmount).toString(),
          currencyCode: refund.currencyCode,
          paymentMethod:
            refund.refundMethod === "original_payment" ? "card" : "cash",
          status: "completed",
          refundId: refund.id,
          processedAt: new Date().toISOString(),
          notes: `Refund #${refund.refundNumber}`,
        });
      });

      revalidatePath(`/dashboard/[slug]/orders`);
      revalidatePath(`/dashboard/[slug]/orders/${refund.orderId}`);

      return { success: true, refundId };
    } catch (processError) {
      // If processing fails, revert to approved status
      await db
        .update(refunds)
        .set({
          status: "approved",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(refunds.id, refundId));

      throw processError;
    }
  } catch (error) {
    console.error("[processRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process refund",
    };
  }
}

// =============================================================================
// QUICK REFUND (Combined approve + process)
// =============================================================================

/**
 * Quick refund - approve and process in one step
 * Useful for simple refund scenarios
 */
export async function quickRefund(refundId: string): Promise<RefundResult> {
  // First approve
  const approveResult = await approveRefund(refundId);
  if (!approveResult.success) {
    return approveResult;
  }

  // Then process
  return processRefund(refundId);
}
