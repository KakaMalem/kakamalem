"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, ilike, or, inArray } from "drizzle-orm";
import { db, withTransaction, type Transaction } from "@/lib/db";
import {
  orders,
  orderItems,
  orderPayments,
  products,
  productVariants,
  productCategories,
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
import { completeOnboardingItem } from "@/lib/db/queries/onboarding";

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
  /** Updated stock levels for items that track inventory */
  updatedStock?: Array<{
    productId: string;
    variantId: string | null;
    newStock: number;
  }>;
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

type StockValidationResult = {
  valid: boolean;
  insufficientItems?: Array<{
    productName: string;
    variantName?: string | null;
    requested: number;
    available: number;
  }>;
};

/**
 * Validate that all items have sufficient stock before processing sale
 */
async function validateStock(
  tx: Transaction,
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    productName: string;
    variantName?: string | null;
    trackInventory: boolean;
  }>
): Promise<StockValidationResult> {
  const insufficientItems: StockValidationResult["insufficientItems"] = [];

  for (const item of items) {
    // Skip items that don't track inventory
    if (!item.trackInventory) continue;

    if (item.variantId) {
      const variant = await tx.query.productVariants.findFirst({
        where: eq(productVariants.id, item.variantId),
        columns: { stock: true },
      });
      const currentStock = variant?.stock ?? 0;
      if (currentStock < item.quantity) {
        insufficientItems.push({
          productName: item.productName,
          variantName: item.variantName,
          requested: item.quantity,
          available: currentStock,
        });
      }
    } else {
      const product = await tx.query.products.findFirst({
        where: eq(products.id, item.productId),
        columns: { stock: true },
      });
      const currentStock = product?.stock ?? 0;
      if (currentStock < item.quantity) {
        insufficientItems.push({
          productName: item.productName,
          requested: item.quantity,
          available: currentStock,
        });
      }
    }
  }

  return {
    valid: insufficientItems.length === 0,
    insufficientItems:
      insufficientItems.length > 0 ? insufficientItems : undefined,
  };
}

/**
 * Reduce stock for an item and create inventory movement
 * Returns the new stock level
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
): Promise<number> {
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

    return newStock;
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

    return newStock;
  }
}

// =============================================================================
// MAIN ACTIONS
// =============================================================================

/**
 * Record a POS/in-store sale
 * Creates an order with channel='pos' and fulfillmentType='instant'
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

    // Track updated stock levels to return to client
    const updatedStock: Array<{
      productId: string;
      variantId: string | null;
      newStock: number;
    }> = [];

    // Execute within transaction
    const order = await withTransaction(async (tx) => {
      // Validate stock availability BEFORE creating the order
      const stockValidation = await validateStock(tx, validatedInput.items);
      if (!stockValidation.valid && stockValidation.insufficientItems) {
        const firstItem = stockValidation.insufficientItems[0];
        const itemName = firstItem.variantName
          ? `${firstItem.productName} (${firstItem.variantName})`
          : firstItem.productName;
        throw new Error(
          `Insufficient stock for "${itemName}": only ${firstItem.available} available, but ${firstItem.requested} requested`
        );
      }

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
      // For POS orders:
      // - channel = "pos" (identifies it as a point-of-sale transaction)
      // - fulfillmentType = "instant" (customer takes items immediately)
      // - status = "delivered" if paid (transaction complete), "pending" if unpaid
      const [newOrder] = await tx
        .insert(orders)
        .values({
          tenantId,
          orderNumber,
          receiptNumber,
          userId: null, // Offline sales don't link to platform users
          storeCustomerId,
          channel: "pos",
          fulfillmentType: "instant",
          paymentMethod: orderPaymentMethod,
          isPaid: isFullyPaid,
          paidAt: isFullyPaid ? new Date().toISOString() : null,
          customerSnapshot,
          shippingAddress: null, // No shipping for POS sales
          billingAddress: null,
          subtotal: subtotal.toFixed(2),
          shippingTotal: "0",
          taxTotal: "0",
          discountTotal: discountTotal.toFixed(2),
          total: total.toFixed(2),
          // For instant fulfillment, go directly to "delivered" if paid
          // (items are immediately handed to customer)
          status: isFullyPaid ? "delivered" : "pending",
          completedAt: isFullyPaid ? new Date().toISOString() : null,
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

      // Create order items and reduce stock
      for (const item of validatedInput.items) {
        const lineSubtotal = item.price * item.quantity;
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId || null,
          productName: item.productName,
          variantName: item.variantName || null,
          sku: item.sku || null,
          price: item.price.toFixed(2),
          unitPrice: item.price.toFixed(2),
          quantity: item.quantity,
          lineSubtotal: lineSubtotal.toFixed(2),
          lineTotal: lineSubtotal.toFixed(2),
        });

        // Reduce stock if product tracks inventory
        if (item.trackInventory) {
          const newStock = await reduceStock(
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
          // Track updated stock to return to client
          updatedStock.push({
            productId: item.productId,
            variantId: item.variantId || null,
            newStock,
          });
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

    // Mark onboarding item as complete (async, don't block)
    completeOnboardingItem(tenantId, "first_sale").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    // Revalidate relevant paths
    revalidatePath(`/dashboard/${storeSlug}/offline-sales`);
    revalidatePath(`/dashboard/${storeSlug}/orders`);
    revalidatePath(`/dashboard/${storeSlug}/inventory`);
    revalidatePath(`/dashboard/${storeSlug}`);

    return {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        receiptNumber: order.receiptNumber!,
      },
      updatedStock: updatedStock.length > 0 ? updatedStock : undefined,
    };
  } catch (error) {
    console.error("Failed to record offline sale:", error);
    // Return meaningful error message (e.g., stock validation errors)
    const message =
      error instanceof Error ? error.message : "Failed to record sale";
    return {
      success: false,
      error: { message, code: "UNKNOWN" },
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
      columns: { id: true, isPaid: true, fulfillmentType: true, channel: true },
    });

    if (!order) {
      return { success: false, error: { message: "Order not found" } };
    }

    if (order.isPaid) {
      return { success: false, error: { message: "Order is already paid" } };
    }

    // For instant fulfillment (POS), mark as delivered when paid
    // For other types, mark as confirmed
    const isPOSOrder =
      order.channel === "pos" || order.fulfillmentType === "instant";
    const now = new Date().toISOString();

    // Update order
    await db
      .update(orders)
      .set({
        isPaid: true,
        paidAt: now,
        paymentMethod,
        status: isPOSOrder ? "delivered" : "confirmed",
        completedAt: isPOSOrder ? now : null,
        updatedAt: now,
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
      columns: {
        id: true,
        total: true,
        isPaid: true,
        fulfillmentType: true,
        channel: true,
      },
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

    // Update the order with payment info
    const now = new Date().toISOString();

    if (isFullyPaid) {
      // For instant fulfillment (POS), mark as delivered when paid
      const isPOSOrder =
        order.channel === "pos" || order.fulfillmentType === "instant";

      await db
        .update(orders)
        .set({
          isPaid: true,
          paidAt: now,
          amountPaid: newTotalPaid.toFixed(2),
          amountDue: "0",
          paymentStatus: "paid",
          status: isPOSOrder ? "delivered" : "confirmed",
          completedAt: isPOSOrder ? now : null,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));
    } else {
      // Partial payment - update amounts but not status
      await db
        .update(orders)
        .set({
          amountPaid: newTotalPaid.toFixed(2),
          amountDue: Math.max(0, newRemaining).toFixed(2),
          paymentStatus: "partial",
          updatedAt: now,
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
  search: string,
  categoryId?: string | null
): Promise<{
  success: boolean;
  products?: Array<{
    id: string;
    name: string;
    price: string;
    sku: string | null;
    barcode: string | null;
    stock: number;
    trackInventory: boolean;
    hasVariants: boolean;
    variants: Array<{
      id: string;
      displayName: string;
      sku: string | null;
      barcode: string | null;
      price: string | null;
      stock: number;
    }>;
    image: string | null;
  }>;
  error?: { message: string };
}> {
  try {
    const searchTrimmed = search.trim();
    const searchPattern = `%${searchTrimmed}%`;

    // Build base conditions
    const baseConditions = [
      eq(products.tenantId, tenantId),
      eq(products.status, "active"),
      eq(products.showOnPos, true),
    ];

    // Add category filter if provided
    // Check both direct categoryId AND productCategories junction table
    if (categoryId) {
      // Get product IDs from the many-to-many productCategories table
      const productIdsInCategory = db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(eq(productCategories.categoryId, categoryId));

      // Filter products that have this category either directly or via junction table
      baseConditions.push(
        or(
          eq(products.categoryId, categoryId),
          inArray(products.id, productIdsInCategory)
        )!
      );
    }

    // Add search conditions if search term is provided
    const hasSearch = searchTrimmed.length > 0 && searchTrimmed !== " ";
    if (hasSearch) {
      baseConditions.push(
        or(
          ilike(products.name, searchPattern),
          ilike(products.sku, searchPattern),
          eq(products.barcode, searchTrimmed) // Exact match for barcode
        )!
      );
    }

    // Search by name, SKU, or barcode
    // For barcodes, prioritize exact matches (scanners send exact codes)
    const result = await db.query.products.findMany({
      where: and(...baseConditions),
      columns: {
        id: true,
        name: true,
        price: true,
        sku: true,
        barcode: true,
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
            barcode: true,
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

    // Also search for products where a variant matches the barcode/sku
    // Only do this if we have a search term (not just browsing by category)
    let additionalProducts: typeof result = [];

    if (hasSearch) {
      const variantMatches = await db.query.productVariants.findMany({
        where: and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.isActive, true),
          or(
            ilike(productVariants.sku, searchPattern),
            eq(productVariants.barcode, searchTrimmed) // Exact match for barcode
          )
        ),
        columns: { productId: true },
        limit: 20,
      });

      // Get unique product IDs from variant matches that aren't already in results
      const existingIds = new Set(result.map((p) => p.id));
      const additionalProductIds = [
        ...new Set(
          variantMatches
            .map((v) => v.productId)
            .filter((id) => !existingIds.has(id))
        ),
      ];

      // Fetch additional products if we found variant matches
      if (additionalProductIds.length > 0) {
        // Build conditions for additional products query
        const additionalConditions = [
          eq(products.tenantId, tenantId),
          eq(products.status, "active"),
          inArray(products.id, additionalProductIds),
        ];

        // Also filter by category if provided
        if (categoryId) {
          additionalConditions.push(eq(products.categoryId, categoryId));
        }

        additionalProducts = await db.query.products.findMany({
          where: and(...additionalConditions),
          columns: {
            id: true,
            name: true,
            price: true,
            sku: true,
            barcode: true,
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
                barcode: true,
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
        });
      }
    }

    const allProducts = [...result, ...additionalProducts];

    return {
      success: true,
      products: allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        sku: p.sku,
        barcode: p.barcode,
        stock: p.stock,
        trackInventory: p.trackInventory,
        hasVariants: p.hasVariants,
        variants: p.variants.map((v) => ({
          id: v.id,
          displayName: v.displayName || "",
          sku: v.sku,
          barcode: v.barcode,
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
