"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  updateOrderStatusSchema,
  bulkUpdateOrderStatusSchema,
  updateStaffNotesSchema,
  type OrderStatusType,
} from "@/lib/validations/orders";

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

    // Get current order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: {
        id: true,
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
