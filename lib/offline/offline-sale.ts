"use client";

import { posDb, type SyncQueueItem, type OfflineReceipt } from "./db";

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineSaleInput {
  tenantId: string;
  storeSlug: string;
  items: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    sku: string | null;
    price: number;
    quantity: number;
    trackInventory: boolean;
  }>;
  discountAmount: number;
  amountPaid: number;
  paymentMethod: string | null;
  customerName?: string;
  customerPhone?: string;
  orderDate?: string;
  staffNotes?: string;
}

export interface OfflineSaleResult {
  success: boolean;
  order?: {
    id: string;
    orderNumber: string;
    receiptNumber: string;
  };
  updatedStock?: Array<{
    productId: string;
    variantId: string | null;
    newStock: number;
  }>;
  isQueued: boolean;
  error?: { message: string };
}

// ============================================================================
// OFFLINE SALE HANDLING
// ============================================================================

/**
 * Generate a unique client ID for idempotency.
 */
function generateClientId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a local order number for offline sales.
 * Format: OFF-YYYYMMDD-XXXX (e.g., OFF-20240115-0001)
 */
async function generateLocalOrderNumber(
  tenantId: string,
  orderDate?: string
): Promise<string> {
  const dateObj = orderDate ? new Date(orderDate) : new Date();
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, "");

  // Count that day's offline orders for this tenant
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);

  const todaysOrders = await posDb.syncQueue
    .where("tenantId")
    .equals(tenantId)
    .and(
      (item) => item.type === "sale" && new Date(item.createdAt) >= startOfDay
    )
    .count();

  const sequence = String(todaysOrders + 1).padStart(4, "0");
  return `OFF-${dateStr}-${sequence}`;
}

/**
 * Generate a local receipt number.
 */
function generateReceiptNumber(): string {
  const now = Date.now();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `R${now}-${random}`;
}

/**
 * Record a sale offline by adding it to the sync queue.
 * This function should be called when the user is offline.
 */
export async function recordOfflineSale(
  input: OfflineSaleInput
): Promise<OfflineSaleResult> {
  try {
    const clientId = generateClientId();
    const orderNumber = await generateLocalOrderNumber(
      input.tenantId,
      input.orderDate
    );
    const receiptNumber = generateReceiptNumber();
    const now = new Date().toISOString();
    const orderTimestamp = input.orderDate || now;

    // Calculate totals
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const total = subtotal - input.discountAmount;

    // Create sync queue item
    const syncItem: SyncQueueItem = {
      type: "sale",
      tenantId: input.tenantId,
      payload: {
        storeSlug: input.storeSlug,
        orderNumber,
        receiptNumber,
        items: input.items,
        discountAmount: input.discountAmount,
        amountPaid: input.amountPaid,
        paymentMethod: input.paymentMethod,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        staffNotes: input.staffNotes,
        subtotal,
        total,
        orderDate: input.orderDate,
        createdAt: orderTimestamp,
      },
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
      lastAttemptAt: null,
      errorMessage: null,
      clientId,
    };

    // Create local receipt for reprint capability
    const receipt: OfflineReceipt = {
      id: clientId,
      tenantId: input.tenantId,
      orderNumber,
      receiptNumber,
      items: input.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal,
      discountAmount: input.discountAmount,
      total,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
      customerName: input.customerName || null,
      createdAt: orderTimestamp,
      syncStatus: "pending",
      serverOrderId: null,
    };

    // Calculate stock updates
    const stockUpdates = input.items
      .filter((item) => item.trackInventory)
      .map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantitySold: item.quantity,
      }));

    // Perform all operations in a transaction
    await posDb.transaction(
      "rw",
      [posDb.syncQueue, posDb.receipts, posDb.products, posDb.variants],
      async () => {
        // Add to sync queue
        await posDb.syncQueue.add(syncItem);

        // Save receipt locally
        await posDb.receipts.add(receipt);

        // Update local stock (decrement)
        for (const update of stockUpdates) {
          if (update.variantId) {
            const variant = await posDb.variants.get(update.variantId);
            if (variant) {
              await posDb.variants.update(update.variantId, {
                stock: Math.max(0, variant.stock - update.quantitySold),
              });
            }
          } else {
            const product = await posDb.products.get(update.productId);
            if (product) {
              await posDb.products.update(update.productId, {
                stock: Math.max(0, product.stock - update.quantitySold),
              });
            }
          }
        }
      }
    );

    // Get the updated stock values to return
    const updatedStockResults: OfflineSaleResult["updatedStock"] = [];
    for (const update of stockUpdates) {
      if (update.variantId) {
        const variant = await posDb.variants.get(update.variantId);
        if (variant) {
          updatedStockResults.push({
            productId: update.productId,
            variantId: update.variantId,
            newStock: variant.stock,
          });
        }
      } else {
        const product = await posDb.products.get(update.productId);
        if (product) {
          updatedStockResults.push({
            productId: update.productId,
            variantId: null,
            newStock: product.stock,
          });
        }
      }
    }

    return {
      success: true,
      order: {
        id: clientId,
        orderNumber,
        receiptNumber,
      },
      updatedStock: updatedStockResults,
      isQueued: true,
    };
  } catch (error) {
    console.error("Failed to record offline sale:", error);
    return {
      success: false,
      isQueued: false,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Failed to save sale offline",
      },
    };
  }
}

/**
 * Get pending sales count.
 */
export async function getPendingSalesCount(): Promise<number> {
  return posDb.syncQueue
    .where("status")
    .equals("pending")
    .and((item) => item.type === "sale")
    .count();
}

/**
 * Get all pending sales for display.
 */
export async function getPendingSales(): Promise<SyncQueueItem[]> {
  return posDb.syncQueue
    .where("status")
    .equals("pending")
    .and((item) => item.type === "sale")
    .toArray();
}

/**
 * Get local receipt by ID for reprinting.
 */
export async function getLocalReceipt(
  receiptId: string
): Promise<OfflineReceipt | undefined> {
  return posDb.receipts.get(receiptId);
}
