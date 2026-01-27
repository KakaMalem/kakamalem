"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  orders,
  orderPayments,
  orderTransactions,
  tenants,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  updateOrderStatusSchema,
  bulkUpdateOrderStatusSchema,
  updateStaffNotesSchema,
  type OrderStatusType,
} from "@/lib/validations/orders";
import { getUser } from "@/lib/auth/server";
import { computePaymentStatus } from "@/lib/utils/payment-status";

// Validation schema for order discount adjustment
const adjustOrderDiscountSchema = z.object({
  orderId: z.string().uuid(),
  discountAmount: z.number().min(0, "Discount cannot be negative"),
  reason: z.string().optional(),
});

// Validation schema for order shipping adjustment
const adjustOrderShippingSchema = z.object({
  orderId: z.string().uuid(),
  shippingAmount: z.number().min(0, "Shipping cannot be negative"),
  reason: z.string().optional(),
});

// Validation schema for order total adjustment (sets new total, calculates discount)
const adjustOrderTotalSchema = z.object({
  orderId: z.string().uuid(),
  newTotal: z.number().min(0, "Total cannot be negative"),
  reason: z.string().optional(),
});

// Validation schema for refund processing
const processRefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive("Refund amount must be positive"),
  reason: z.string().optional(),
  refundMethod: z.enum(["original_payment", "cash", "store_credit"]).optional(),
});
import {
  sendOrderCancelledNotification,
  sendCustomerOrderStatusNotification,
  type OrderStatusNotificationType,
} from "@/lib/push";

export type OrderActionResult = {
  success: boolean;
  error?: {
    message: string;
  };
  data?: {
    orderId?: string;
    orderIds?: string[];
    newStatus?: OrderStatusType;
  };
};

export type RefundResult = {
  success: boolean;
  error?: { message: string };
  data?: {
    orderId: string;
    refundAmount: number;
    newAmountRefunded: number;
    newPaymentStatus: string;
  };
};

/**
 * Update a single order's status
 */
export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  newStatus: OrderStatusType,
  staffNote?: string
): Promise<OrderActionResult> {
  try {
    // Get current user (for excluding from notifications)
    const user = await getUser();

    // Validate input
    const result = updateOrderStatusSchema.safeParse({
      orderId,
      status: newStatus,
      staffNote,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current order with details needed for notification
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        status: true,
        staffNotes: true,
        orderNumber: true,
        customerSnapshot: true,
        total: true,
        userId: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    // Build update data
    const now = new Date().toISOString();
    const updateData: {
      status: OrderStatusType;
      updatedAt: string;
      staffNotes?: string;
    } = {
      status: newStatus,
      updatedAt: now,
    };

    // Append staff note if provided
    if (staffNote && staffNote.trim()) {
      const timestamp = new Date().toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const newNote = `[${timestamp}] Status changed to ${newStatus}: ${staffNote.trim()}`;
      updateData.staffNotes = order.staffNotes
        ? `${order.staffNotes}\n\n${newNote}`
        : newNote;
    }

    // Update order
    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Send notification if order was cancelled (to store owners)
    if (newStatus === "cancelled" && order.status !== "cancelled") {
      // Get tenant details for notification
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { slug: true, name: true },
      });

      if (tenant) {
        const customerSnapshot = order.customerSnapshot as {
          name?: string;
        } | null;

        sendOrderCancelledNotification(
          tenantId,
          tenant.slug,
          {
            orderNumber: order.orderNumber,
            orderId: order.id,
            customerName: customerSnapshot?.name || "Customer",
            total: order.total,
            currency: "AFN",
            storeName: tenant.name,
            reason: staffNote?.trim(),
          },
          user?.id // Exclude the staff member who cancelled (they already know)
        ).catch(console.error);
      }
    }

    // Send customer notification for status changes
    if (order.userId && order.status !== newStatus) {
      // Map order status to notification type
      const statusToNotificationType: Partial<
        Record<OrderStatusType, OrderStatusNotificationType>
      > = {
        confirmed: "order_confirmed",
        shipped: "order_shipped",
        delivered: "order_delivered",
        cancelled: "order_cancelled",
      };

      const notificationType = statusToNotificationType[newStatus];

      if (notificationType) {
        // Get tenant details if not already fetched
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
          columns: { slug: true, name: true },
        });

        if (tenant) {
          sendCustomerOrderStatusNotification(
            order.userId,
            tenantId,
            tenant.slug,
            {
              type: notificationType,
              orderId: order.id,
              orderNumber: order.orderNumber,
              storeName: tenant.name,
            }
          ).catch(console.error);
        }
      }
    }

    // Revalidate orders page
    revalidatePath("/dashboard/[slug]/orders", "page");

    return {
      success: true,
      data: {
        orderId,
        newStatus,
      },
    };
  } catch (error) {
    console.error("Failed to update order status:", error);
    return {
      success: false,
      error: { message: "Failed to update order status" },
    };
  }
}

/**
 * Update multiple orders' status at once
 */
export async function bulkUpdateOrderStatus(
  tenantId: string,
  orderIds: string[],
  newStatus: OrderStatusType
): Promise<OrderActionResult> {
  try {
    // Validate input
    const result = bulkUpdateOrderStatusSchema.safeParse({
      orderIds,
      status: newStatus,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current orders to validate transitions
    const currentOrders = await db.query.orders.findMany({
      where: and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        status: true,
      },
    });

    if (currentOrders.length === 0) {
      return {
        success: false,
        error: { message: "No orders found" },
      };
    }

    // Update all orders
    const now = new Date().toISOString();
    await db
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: now,
      })
      .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));

    // Revalidate orders page
    revalidatePath("/dashboard/[slug]/orders", "page");

    return {
      success: true,
      data: {
        orderIds,
        newStatus,
      },
    };
  } catch (error) {
    console.error("Failed to bulk update order status:", error);
    return {
      success: false,
      error: { message: "Failed to update orders" },
    };
  }
}

/**
 * Update staff notes for an order
 */
export async function updateStaffNotes(
  tenantId: string,
  orderId: string,
  notes: string
): Promise<OrderActionResult> {
  try {
    // Validate input
    const result = updateStaffNotesSchema.safeParse({
      orderId,
      notes,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: { id: true },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    // Update staff notes
    await db
      .update(orders)
      .set({
        staffNotes: notes.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Revalidate order detail page
    revalidatePath("/dashboard/[slug]/orders/[orderId]", "page");

    return {
      success: true,
      data: { orderId },
    };
  } catch (error) {
    console.error("Failed to update staff notes:", error);
    return {
      success: false,
      error: { message: "Failed to update notes" },
    };
  }
}

/**
 * Helper function to calculate the actual amount paid for an order.
 * This handles both:
 * - Legacy orders where isPaid is true but amountPaid is 0
 * - Orders with payment records in orderPayments table
 */
async function getActualAmountPaid(
  orderId: string,
  orderTotal: string,
  orderAmountPaid: string,
  orderIsPaid: boolean
): Promise<number> {
  // First, check if there are payment records
  const paymentRecords = await db
    .select({ total: sql<string>`COALESCE(SUM(${orderPayments.amount}), '0')` })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const paymentsTotal = parseFloat(paymentRecords[0]?.total || "0");

  // If there are payment records, use that sum
  if (paymentsTotal > 0) {
    return paymentsTotal;
  }

  // If amountPaid field is set (non-zero), use it
  const amountPaidField = parseFloat(orderAmountPaid);
  if (amountPaidField > 0) {
    return amountPaidField;
  }

  // If order is marked as paid but no payment records and amountPaid is 0,
  // assume the original total was paid (legacy order)
  if (orderIsPaid) {
    return parseFloat(orderTotal);
  }

  return 0;
}

/**
 * Adjust order discount (add/update discount amount)
 * This recalculates the order total based on the new discount
 */
export async function adjustOrderDiscount(
  tenantId: string,
  orderId: string,
  discountAmount: number,
  reason?: string
): Promise<OrderActionResult> {
  try {
    // Validate input
    const result = adjustOrderDiscountSchema.safeParse({
      orderId,
      discountAmount,
      reason,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        subtotal: true,
        shippingTotal: true,
        taxTotal: true,
        discountTotal: true,
        total: true,
        staffNotes: true,
        amountPaid: true,
        amountDue: true,
        isPaid: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    const subtotal = parseFloat(order.subtotal);
    const shippingTotal = parseFloat(order.shippingTotal);
    const taxTotal = parseFloat(order.taxTotal);
    const maxDiscount = subtotal + shippingTotal + taxTotal;

    // Validate discount doesn't exceed order value
    if (discountAmount > maxDiscount) {
      return {
        success: false,
        error: {
          message: `Discount cannot exceed order value (${maxDiscount.toFixed(2)})`,
        },
      };
    }

    // Calculate new total
    const newTotal = Math.max(
      0,
      subtotal + shippingTotal + taxTotal - discountAmount
    );

    // Get actual amount paid (handles legacy orders and payment records)
    const actualAmountPaid = await getActualAmountPaid(
      orderId,
      order.total,
      order.amountPaid,
      order.isPaid
    );

    // Calculate new payment status using the utility for consistency
    const paymentInfo = computePaymentStatus({
      total: newTotal,
      amountPaid: actualAmountPaid,
      amountRefunded: 0,
    });
    const newAmountDue = paymentInfo.amountDue;
    const newIsPaid = paymentInfo.isPaid;

    // Build staff note about the discount
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const discountNote = reason
      ? `[${timestamp}] Discount adjusted to ${discountAmount.toFixed(2)}: ${reason}`
      : `[${timestamp}] Discount adjusted to ${discountAmount.toFixed(2)}`;
    const updatedStaffNotes = order.staffNotes
      ? `${order.staffNotes}\n\n${discountNote}`
      : discountNote;

    // Update order - also set amountPaid if it was 0 and we inferred a payment
    const updateData: Record<string, unknown> = {
      discountTotal: discountAmount.toFixed(2),
      total: newTotal.toFixed(2),
      amountDue: newAmountDue.toFixed(2),
      isPaid: newIsPaid,
      paymentStatus: paymentInfo.status,
      staffNotes: updatedStaffNotes,
      updatedAt: new Date().toISOString(),
    };

    // If we inferred the amount paid from legacy data, persist it
    if (actualAmountPaid > 0 && parseFloat(order.amountPaid) === 0) {
      updateData.amountPaid = actualAmountPaid.toFixed(2);
    }

    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Revalidate order detail page
    revalidatePath("/dashboard/[slug]/orders/[orderId]", "page");

    return {
      success: true,
      data: { orderId },
    };
  } catch (error) {
    console.error("Failed to adjust order discount:", error);
    return {
      success: false,
      error: { message: "Failed to adjust discount" },
    };
  }
}

/**
 * Adjust order shipping (change shipping/delivery charges)
 * This recalculates the order total based on the new shipping amount
 */
export async function adjustOrderShipping(
  tenantId: string,
  orderId: string,
  shippingAmount: number,
  reason?: string
): Promise<OrderActionResult> {
  try {
    // Validate input
    const result = adjustOrderShippingSchema.safeParse({
      orderId,
      shippingAmount,
      reason,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        subtotal: true,
        shippingTotal: true,
        taxTotal: true,
        discountTotal: true,
        total: true,
        staffNotes: true,
        amountPaid: true,
        amountDue: true,
        isPaid: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    const subtotal = parseFloat(order.subtotal);
    const taxTotal = parseFloat(order.taxTotal);
    const discountTotal = parseFloat(order.discountTotal);
    const oldShippingTotal = parseFloat(order.shippingTotal);

    // Calculate new total
    const newTotal = Math.max(
      0,
      subtotal + shippingAmount + taxTotal - discountTotal
    );

    // Get actual amount paid (handles legacy orders and payment records)
    const actualAmountPaid = await getActualAmountPaid(
      orderId,
      order.total,
      order.amountPaid,
      order.isPaid
    );

    // Calculate new payment status using the utility for consistency
    const paymentInfo = computePaymentStatus({
      total: newTotal,
      amountPaid: actualAmountPaid,
      amountRefunded: 0,
    });
    const newAmountDue = paymentInfo.amountDue;
    const newIsPaid = paymentInfo.isPaid;

    // Build staff note about the shipping change
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

    let shippingNote: string;
    if (shippingAmount === 0 && oldShippingTotal > 0) {
      shippingNote = reason
        ? `[${timestamp}] Shipping made free (was ${oldShippingTotal.toFixed(2)}): ${reason}`
        : `[${timestamp}] Shipping made free (was ${oldShippingTotal.toFixed(2)})`;
    } else if (shippingAmount !== oldShippingTotal) {
      shippingNote = reason
        ? `[${timestamp}] Shipping changed from ${oldShippingTotal.toFixed(2)} to ${shippingAmount.toFixed(2)}: ${reason}`
        : `[${timestamp}] Shipping changed from ${oldShippingTotal.toFixed(2)} to ${shippingAmount.toFixed(2)}`;
    } else {
      shippingNote = `[${timestamp}] Shipping confirmed at ${shippingAmount.toFixed(2)}`;
    }

    const updatedStaffNotes = order.staffNotes
      ? `${order.staffNotes}\n\n${shippingNote}`
      : shippingNote;

    // Update order - also set amountPaid if it was 0 and we inferred a payment
    const updateData: Record<string, unknown> = {
      shippingTotal: shippingAmount.toFixed(2),
      total: newTotal.toFixed(2),
      amountDue: newAmountDue.toFixed(2),
      isPaid: newIsPaid,
      paymentStatus: paymentInfo.status,
      staffNotes: updatedStaffNotes,
      updatedAt: new Date().toISOString(),
    };

    // If we inferred the amount paid from legacy data, persist it
    if (actualAmountPaid > 0 && parseFloat(order.amountPaid) === 0) {
      updateData.amountPaid = actualAmountPaid.toFixed(2);
    }

    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Revalidate order detail page
    revalidatePath("/dashboard/[slug]/orders/[orderId]", "page");

    return {
      success: true,
      data: { orderId },
    };
  } catch (error) {
    console.error("Failed to adjust order shipping:", error);
    return {
      success: false,
      error: { message: "Failed to adjust shipping" },
    };
  }
}

/**
 * Adjust order total directly (calculates discount automatically)
 * If new total is less than original, the difference becomes the discount
 */
export async function adjustOrderTotal(
  tenantId: string,
  orderId: string,
  newTotal: number,
  reason?: string
): Promise<OrderActionResult> {
  try {
    // Validate input
    const result = adjustOrderTotalSchema.safeParse({
      orderId,
      newTotal,
      reason,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        subtotal: true,
        shippingTotal: true,
        taxTotal: true,
        discountTotal: true,
        total: true,
        staffNotes: true,
        amountPaid: true,
        amountDue: true,
        isPaid: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    const subtotal = parseFloat(order.subtotal);
    const shippingTotal = parseFloat(order.shippingTotal);
    const taxTotal = parseFloat(order.taxTotal);
    const originalTotal = subtotal + shippingTotal + taxTotal;
    const oldTotal = parseFloat(order.total);
    const oldDiscount = parseFloat(order.discountTotal);

    // Validate new total doesn't exceed original (before any discounts)
    if (newTotal > originalTotal) {
      return {
        success: false,
        error: {
          message: `Total cannot exceed ${originalTotal.toFixed(2)} (subtotal + shipping + tax)`,
        },
      };
    }

    // Calculate the discount as the difference between original and new total
    const newDiscount = Math.max(0, originalTotal - newTotal);

    // Get actual amount paid (handles legacy orders and payment records)
    const actualAmountPaid = await getActualAmountPaid(
      orderId,
      order.total,
      order.amountPaid,
      order.isPaid
    );

    // Calculate new payment status using the utility for consistency
    const paymentInfo = computePaymentStatus({
      total: newTotal,
      amountPaid: actualAmountPaid,
      amountRefunded: 0,
    });
    const newAmountDue = paymentInfo.amountDue;
    const newIsPaid = paymentInfo.isPaid;

    // Build staff note about the total change
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

    let totalNote: string;
    if (newTotal < oldTotal) {
      const discountChange = newDiscount - oldDiscount;
      totalNote = reason
        ? `[${timestamp}] Total reduced from ${oldTotal.toFixed(2)} to ${newTotal.toFixed(2)} (${discountChange.toFixed(2)} discount applied): ${reason}`
        : `[${timestamp}] Total reduced from ${oldTotal.toFixed(2)} to ${newTotal.toFixed(2)} (${discountChange.toFixed(2)} discount applied)`;
    } else if (newTotal > oldTotal) {
      totalNote = reason
        ? `[${timestamp}] Total increased from ${oldTotal.toFixed(2)} to ${newTotal.toFixed(2)} (discount reduced): ${reason}`
        : `[${timestamp}] Total increased from ${oldTotal.toFixed(2)} to ${newTotal.toFixed(2)} (discount reduced)`;
    } else {
      totalNote = `[${timestamp}] Total confirmed at ${newTotal.toFixed(2)}`;
    }

    const updatedStaffNotes = order.staffNotes
      ? `${order.staffNotes}\n\n${totalNote}`
      : totalNote;

    // Update order
    const updateData: Record<string, unknown> = {
      discountTotal: newDiscount.toFixed(2),
      total: newTotal.toFixed(2),
      amountDue: newAmountDue.toFixed(2),
      isPaid: newIsPaid,
      paymentStatus: paymentInfo.status,
      staffNotes: updatedStaffNotes,
      updatedAt: new Date().toISOString(),
    };

    // If we inferred the amount paid from legacy data, persist it
    if (actualAmountPaid > 0 && parseFloat(order.amountPaid) === 0) {
      updateData.amountPaid = actualAmountPaid.toFixed(2);
    }

    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Revalidate order detail page
    revalidatePath("/dashboard/[slug]/orders/[orderId]", "page");

    return {
      success: true,
      data: { orderId },
    };
  } catch (error) {
    console.error("Failed to adjust order total:", error);
    return {
      success: false,
      error: { message: "Failed to adjust total" },
    };
  }
}

/**
 * Process a refund (full or partial)
 * Updates amountRefunded, paymentStatus, and order status
 */
export async function processRefund(
  tenantId: string,
  orderId: string,
  amount: number,
  reason: string,
  refundMethod?: "original_payment" | "cash" | "store_credit"
): Promise<RefundResult> {
  try {
    // Validate input
    const result = processRefundSchema.safeParse({
      orderId,
      amount,
      reason,
      refundMethod,
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.issues[0].message },
      };
    }

    // Get current order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
        total: true,
        amountPaid: true,
        amountRefunded: true,
        amountDue: true,
        isPaid: true,
        status: true,
        staffNotes: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: { message: "Order not found" },
      };
    }

    const currentRefunded = parseFloat(order.amountRefunded);

    // Get actual amount paid
    const actualAmountPaid = await getActualAmountPaid(
      orderId,
      order.total,
      order.amountPaid,
      order.isPaid
    );

    // Calculate maximum refundable amount (what was paid minus what's already refunded)
    const maxRefundable = actualAmountPaid - currentRefunded;

    if (amount > maxRefundable + 0.01) {
      return {
        success: false,
        error: {
          message: `Refund amount exceeds refundable balance (${maxRefundable.toFixed(2)})`,
        },
      };
    }

    // Calculate new refund totals
    const newAmountRefunded = currentRefunded + amount;

    // Compute payment status using the utility for consistency
    const paymentInfo = computePaymentStatus({
      total: order.total,
      amountPaid: actualAmountPaid,
      amountRefunded: newAmountRefunded,
    });
    const isFullRefund = paymentInfo.isFullyRefunded;
    const newPaymentStatus = paymentInfo.status;

    // Build staff note about the refund
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const refundMethodText = refundMethod
      ? ` via ${refundMethod.replace("_", " ")}`
      : "";
    const refundNote = `[${timestamp}] ${isFullRefund ? "Full" : "Partial"} refund of ${amount.toFixed(2)}${refundMethodText}: ${reason}`;
    const updatedStaffNotes = order.staffNotes
      ? `${order.staffNotes}\n\n${refundNote}`
      : refundNote;

    // Update order (only payment fields - order status is for fulfillment, not payments)
    const updateData: Record<string, unknown> = {
      amountRefunded: newAmountRefunded.toFixed(2),
      paymentStatus: newPaymentStatus,
      staffNotes: updatedStaffNotes,
      updatedAt: new Date().toISOString(),
    };

    // Also set amountPaid if it wasn't set
    if (actualAmountPaid > 0 && parseFloat(order.amountPaid) === 0) {
      updateData.amountPaid = actualAmountPaid.toFixed(2);
    }

    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));

    // Create a transaction record for the refund
    // Map refund method to payment method for the transaction
    const paymentMethodMap: Record<
      string,
      "cash" | "card" | "mobile_money" | "bank_transfer"
    > = {
      original_payment: "cash", // Default, could be improved if we track original payment method
      cash: "cash",
      store_credit: "cash", // Store credit treated as cash for transaction purposes
    };

    await db.insert(orderTransactions).values({
      orderId,
      tenantId,
      type: "refund",
      amount: amount.toFixed(2),
      paymentMethod: paymentMethodMap[refundMethod || "cash"] || "cash",
      status: "completed",
      notes: reason || undefined,
      processedAt: new Date().toISOString(),
    });

    // Revalidate order detail page
    revalidatePath("/dashboard/[slug]/orders/[orderId]", "page");
    revalidatePath("/dashboard/[slug]/orders", "page");

    return {
      success: true,
      data: {
        orderId,
        refundAmount: amount,
        newAmountRefunded,
        newPaymentStatus,
      },
    };
  } catch (error) {
    console.error("Failed to process refund:", error);
    return {
      success: false,
      error: { message: "Failed to process refund" },
    };
  }
}
