"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, ilike } from "drizzle-orm";
import { db, withTransaction, type Transaction } from "@/lib/db";
import {
  orders,
  orderItems,
  orderPayments,
  products,
  productVariants,
  inventoryMovements,
  storeCustomers,
} from "@/lib/db/schema";
import type { CustomerSnapshot } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import {
  recordOfflineSaleSchema,
  markOrderPaidSchema,
  recordOrderPaymentSchema,
  type RecordOfflineSaleInput,
  type RecordOrderPaymentInput,
  type PaymentMethod,
} from "@/lib/validations/offline-sales";
import { sendOrderNotificationToTenant } from "@/lib/push";

// =============================================================================
// TYPES
// =============================================================================

export type OfflineSaleResult = {
  success: boolean;
  error?: {
    message: string;
    code?: string;
  };
  order?: {
    id: string;
    orderNumber: string;
    receiptNumber: string;
  };
};

export type MarkOrderPaidResult = {
  success: boolean;
  error?: { message: string };
};

export type RecordPaymentResult = {
  success: boolean;
  error?: { message: string };
  payment?: {
    id: string;
    amount: string;
    totalPaid: string;
    remaining: string;
    isFullyPaid: boolean;
  };
};

// =============================================================================
// ORDER NUMBER GENERATION
// =============================================================================

/**
 * Generate next order number for a tenant
 * Format: KM-{YEAR}-{PADDED_SEQUENCE}
 */
async function generateOrderNumber(
  tx: Transaction,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();

  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        sql`EXTRACT(YEAR FROM ${orders.createdAt}) = ${year}`
      )
    );

  const nextNumber = (result[0]?.count || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(6, "0");

  return `KM-${year}-${paddedNumber}`;
}

/**
 * Generate receipt number for offline sale
 * Format: RCP-{YEAR}-{PADDED_SEQUENCE}
 */
async function generateReceiptNumber(
  tx: Transaction,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();

  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        sql`${orders.receiptNumber} IS NOT NULL`,
        sql`EXTRACT(YEAR FROM ${orders.createdAt}) = ${year}`
      )
    );

  const nextNumber = (result[0]?.count || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(6, "0");

  return `RCP-${year}-${paddedNumber}`;
}

// =============================================================================
// STORE CUSTOMER MANAGEMENT
// =============================================================================

/**
 * Get or create store customer by phone number (for offline sales)
 * Phone number is the primary identifier for walk-in customers
 */
async function getOrCreateStoreCustomerByPhone(
  tx: Transaction,
  tenantId: string,
  phone: string | null | undefined
): Promise<string | null> {
  // If no phone provided, can't create/link customer
  if (!phone) return null;

  // Try to find existing customer by phone in their notes/tags
  // Since we don't have a dedicated phone field on store_customers,
  // we'll search through orders for matching phone numbers
  const existingOrder = await tx.query.orders.findFirst({
    where: and(
      eq(orders.tenantId, tenantId),
      sql`${orders.customerSnapshot}->>'phone' = ${phone}`
    ),
    columns: { storeCustomerId: true },
  });

  if (existingOrder?.storeCustomerId) {
    return existingOrder.storeCustomerId;
  }

  // Create new store customer (without userId since this is a walk-in)
  // We need to handle this specially since storeCustomers requires userId
  // For now, return null - offline customers are tracked via customerSnapshot
  return null;
}

// =============================================================================
// INVENTORY MANAGEMENT
// =============================================================================

/**
 * Reduce stock for an item and create inventory movement
 */
async function reduceStock(
  tx: Transaction,
  tenantId: string,
  item: {
    productId: string;
    variantId?: string | null;
    quantity: number;
    productName: string;
  },
  orderId: string,
  orderNumber: string
): Promise<void> {
  if (item.variantId) {
    // Get current variant stock
    const variant = await tx.query.productVariants.findFirst({
      where: eq(productVariants.id, item.variantId),
      columns: { stock: true },
    });

    const currentStock = variant?.stock ?? 0;
    const newStock = Math.max(0, currentStock - item.quantity);

    // Update variant stock
    await tx
      .update(productVariants)
      .set({
        stock: newStock,
        stockStatus:
          newStock === 0
            ? "out_of_stock"
            : newStock <= 5
              ? "low_stock"
              : "in_stock",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(productVariants.id, item.variantId));

    // Create inventory movement
    await tx.insert(inventoryMovements).values({
      tenantId,
      productId: item.productId,
      variantId: item.variantId,
      type: "sale",
      quantity: -item.quantity,
      previousStock: currentStock,
      newStock,
      orderId,
      reason: `Offline Sale ${orderNumber}`,
    });
  } else {
    // Get current product stock
    const product = await tx.query.products.findFirst({
      where: eq(products.id, item.productId),
      columns: { stock: true },
    });

    const currentStock = product?.stock ?? 0;
    const newStock = Math.max(0, currentStock - item.quantity);

    // Update product stock
    await tx
      .update(products)
      .set({
        stock: newStock,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(products.id, item.productId));

    // Create inventory movement
    await tx.insert(inventoryMovements).values({
      tenantId,
      productId: item.productId,
      variantId: null,
      type: "sale",
      quantity: -item.quantity,
      previousStock: currentStock,
      newStock,
      orderId,
      reason: `Offline Sale ${orderNumber}`,
    });
  }
}

// =============================================================================
// MAIN ACTIONS
// =============================================================================

/**
 * Record an offline sale
 * Creates an order with salesChannel set to 'offline' or 'phone'
 */
export async function recordOfflineSale(
  tenantId: string,
  storeSlug: string,
  input: RecordOfflineSaleInput
): Promise<OfflineSaleResult> {
  try {
    // Verify user is authenticated and has permission
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        error: { message: "Not authenticated", code: "UNAUTHORIZED" },
      };
    }

    // Validate input
    const validation = recordOfflineSaleSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: {
          message: firstError?.message || "Invalid data",
          code: "VALIDATION_ERROR",
        },
      };
    }

    const validatedInput = validation.data;

    // Execute within transaction
    const order = await withTransaction(async (tx) => {
      // Generate order and receipt numbers
      const orderNumber = await generateOrderNumber(tx, tenantId);
      const receiptNumber = await generateReceiptNumber(tx, tenantId);

      // Calculate totals
      let subtotal = 0;
      for (const item of validatedInput.items) {
        subtotal += item.price * item.quantity;
      }
      const discountTotal = validatedInput.discountAmount || 0;
      const total = subtotal - discountTotal;

      // Payment status derived from amountPaid
      const amountPaid = validatedInput.amountPaid ?? 0;
      const isFullyPaid = amountPaid >= total - 0.01; // Small tolerance for rounding

      // Try to link store customer
      const storeCustomerId = await getOrCreateStoreCustomerByPhone(
        tx,
        tenantId,
        validatedInput.customerPhone
      );

      // Build customer snapshot
      const customerSnapshot: CustomerSnapshot = {
        name: validatedInput.customerName || "Walk-in Customer",
        email: validatedInput.customerEmail || "",
        phone: validatedInput.customerPhone || undefined,
      };

      // Determine payment method for order record
      // If no payment, we don't store a payment method on the order
      // When payment is made later, it will be recorded separately
      const orderPaymentMethod =
        amountPaid > 0 ? validatedInput.paymentMethod : null;

      // Create order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          tenantId,
          orderNumber,
          receiptNumber,
          userId: null, // Offline sales don't link to platform users
          storeCustomerId,
          salesChannel: validatedInput.salesChannel,
          paymentMethod: orderPaymentMethod,
          isPaid: isFullyPaid,
          paidAt: isFullyPaid ? new Date().toISOString() : null,
          customerSnapshot,
          shippingAddress: null, // No shipping for offline sales
          billingAddress: null,
          subtotal: subtotal.toFixed(2),
          shippingTotal: "0",
          taxTotal: "0",
          discountTotal: discountTotal.toFixed(2),
          total: total.toFixed(2),
          status: isFullyPaid ? "confirmed" : "pending",
          staffNotes: validatedInput.staffNotes || null,
        })
        .returning();

      // Create payment record if any amount was paid
      if (amountPaid > 0 && validatedInput.paymentMethod) {
        await tx.insert(orderPayments).values({
          orderId: newOrder.id,
          amount: amountPaid.toFixed(2),
          paymentMethod: validatedInput.paymentMethod,
          notes: isFullyPaid ? null : "Partial payment at sale",
          recordedBy: user.id,
        });
      }

      // Create order items
      for (const item of validatedInput.items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId || null,
          productName: item.productName,
          variantName: item.variantName || null,
          sku: item.sku || null,
          price: item.price.toFixed(2),
          quantity: item.quantity,
        });

        // Reduce stock if product tracks inventory
        if (item.trackInventory) {
          await reduceStock(
            tx,
            tenantId,
            {
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.productName,
            },
            newOrder.id,
            orderNumber
          );
        }
      }

      // Update store customer stats if applicable
      if (storeCustomerId) {
        await tx
          .update(storeCustomers)
          .set({
            totalOrders: sql`${storeCustomers.totalOrders} + 1`,
            totalSpent: sql`${storeCustomers.totalSpent} + ${total}`,
            lastOrderAt: new Date().toISOString(),
            firstOrderAt: sql`COALESCE(${storeCustomers.firstOrderAt}, NOW())`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(storeCustomers.id, storeCustomerId));
      }

      return newOrder;
    });

    // Revalidate relevant paths
    revalidatePath(`/dashboard/${storeSlug}/offline-sales`);
    revalidatePath(`/dashboard/${storeSlug}/orders`);
    revalidatePath(`/dashboard/${storeSlug}/inventory`);
    revalidatePath(`/dashboard/${storeSlug}`);

    // Send push notification to store owners/admins (non-blocking)
    // Calculate total for notification
    let notificationTotal = 0;
    for (const item of validatedInput.items) {
      notificationTotal += item.price * item.quantity;
    }
    notificationTotal -= validatedInput.discountAmount || 0;

    sendOrderNotificationToTenant(tenantId, storeSlug, {
      orderNumber: order.orderNumber,
      orderId: order.id,
      customerName: validatedInput.customerName || "Walk-in Customer",
      total: notificationTotal.toFixed(2),
      currency: "AFN",
      isOffline: true,
    }).catch((error) => {
      console.error("Failed to send offline sale notification:", error);
    });

    return {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        receiptNumber: order.receiptNumber!,
      },
    };
  } catch (error) {
    console.error("Failed to record offline sale:", error);
    return {
      success: false,
      error: { message: "Failed to record sale", code: "UNKNOWN" },
    };
  }
}

/**
 * Mark an order as paid (for unpaid/partially paid sales)
 */
export async function markOrderPaid(
  tenantId: string,
  storeSlug: string,
  orderId: string,
  paymentMethod: PaymentMethod
): Promise<MarkOrderPaidResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: { message: "Not authenticated" } };
    }

    // Validate input
    const validation = markOrderPaidSchema.safeParse({
      orderId,
      paymentMethod,
    });
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: validation.error.issues[0]?.message || "Invalid data",
        },
      };
    }

    // Find and update the order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: { id: true, isPaid: true },
    });

    if (!order) {
      return { success: false, error: { message: "Order not found" } };
    }

    if (order.isPaid) {
      return { success: false, error: { message: "Order is already paid" } };
    }

    // Update order
    await db
      .update(orders)
      .set({
        isPaid: true,
        paidAt: new Date().toISOString(),
        paymentMethod,
        status: "confirmed",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    revalidatePath(`/dashboard/${storeSlug}/offline-sales`);
    revalidatePath(`/dashboard/${storeSlug}/orders`);

    return { success: true };
  } catch (error) {
    console.error("Failed to mark order as paid:", error);
    return { success: false, error: { message: "Failed to update order" } };
  }
}

/**
 * Record a partial payment on an order
 * Automatically marks order as fully paid when total payments >= order total
 */
export async function recordOrderPayment(
  tenantId: string,
  storeSlug: string,
  input: RecordOrderPaymentInput
): Promise<RecordPaymentResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: { message: "Not authenticated" } };
    }

    // Validate input
    const validation = recordOrderPaymentSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: {
          message: validation.error.issues[0]?.message || "Invalid data",
        },
      };
    }

    const { orderId, amount, paymentMethod, notes } = validation.data;

    // Find the order
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      columns: { id: true, total: true, isPaid: true },
      with: {
        payments: {
          columns: { amount: true },
        },
      },
    });

    if (!order) {
      return { success: false, error: { message: "Order not found" } };
    }

    if (order.isPaid) {
      return {
        success: false,
        error: { message: "Order is already fully paid" },
      };
    }

    const orderTotal = parseFloat(order.total);
    const previouslyPaid = order.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );
    const remaining = orderTotal - previouslyPaid;

    // Don't allow payment more than remaining
    if (amount > remaining + 0.01) {
      // Small tolerance for rounding
      return {
        success: false,
        error: {
          message: `Payment amount exceeds remaining balance (${remaining.toFixed(2)})`,
        },
      };
    }

    // Record the payment
    const [payment] = await db
      .insert(orderPayments)
      .values({
        orderId,
        amount: amount.toFixed(2),
        paymentMethod,
        notes: notes || null,
        recordedBy: user.id,
      })
      .returning();

    const newTotalPaid = previouslyPaid + amount;
    const newRemaining = orderTotal - newTotalPaid;
    const isFullyPaid = newRemaining <= 0.01; // Small tolerance for rounding

    // If fully paid, update the order
    if (isFullyPaid) {
      await db
        .update(orders)
        .set({
          isPaid: true,
          paidAt: new Date().toISOString(),
          status: "confirmed",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId));
    }

    // Revalidate paths
    revalidatePath(`/dashboard/${storeSlug}/offline-sales`);
    revalidatePath(`/dashboard/${storeSlug}/orders`);
    revalidatePath(`/dashboard/${storeSlug}/orders/${orderId}`);

    return {
      success: true,
      payment: {
        id: payment.id,
        amount: amount.toFixed(2),
        totalPaid: newTotalPaid.toFixed(2),
        remaining: Math.max(0, newRemaining).toFixed(2),
        isFullyPaid,
      },
    };
  } catch (error) {
    console.error("Failed to record payment:", error);
    return { success: false, error: { message: "Failed to record payment" } };
  }
}

/**
 * Get products for offline sale product search
 * Returns active products with their variants and current stock
 */
export async function searchProductsForSale(
  tenantId: string,
  search: string
): Promise<{
  success: boolean;
  products?: Array<{
    id: string;
    name: string;
    price: string;
    stock: number;
    trackInventory: boolean;
    hasVariants: boolean;
    variants: Array<{
      id: string;
      displayName: string;
      sku: string | null;
      price: string | null;
      stock: number;
    }>;
    image: string | null;
  }>;
  error?: { message: string };
}> {
  try {
    const searchPattern = `%${search}%`;

    const result = await db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        ilike(products.name, searchPattern)
      ),
      columns: {
        id: true,
        name: true,
        price: true,
        stock: true,
        trackInventory: true,
        hasVariants: true,
      },
      with: {
        variants: {
          where: eq(productVariants.isActive, true),
          columns: {
            id: true,
            displayName: true,
            sku: true,
            price: true,
            stock: true,
          },
        },
        images: {
          limit: 1,
          columns: {},
          with: {
            media: {
              columns: { url: true },
            },
          },
        },
      },
      limit: 20,
    });

    return {
      success: true,
      products: result.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        trackInventory: p.trackInventory,
        hasVariants: p.hasVariants,
        variants: p.variants.map((v) => ({
          id: v.id,
          displayName: v.displayName || "",
          sku: v.sku,
          price: v.price,
          stock: v.stock,
        })),
        image: p.images[0]?.media?.url || null,
      })),
    };
  } catch (error) {
    console.error("Failed to search products:", error);
    return { success: false, error: { message: "Failed to search products" } };
  }
}
