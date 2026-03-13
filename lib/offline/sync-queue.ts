"use client";

import { posDb, type SyncQueueItem } from "./db";
import { recordOfflineSale as recordSaleOnServer } from "@/lib/actions/offline-sales";

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ============================================================================
// SYNC QUEUE PROCESSOR
// ============================================================================

/**
 * Process all pending items in the sync queue.
 * This should be called when connectivity is restored.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  // Get all pending items, ordered by creation time (oldest first)
  const pendingItems = await posDb.syncQueue
    .where("status")
    .equals("pending")
    .sortBy("createdAt");

  if (pendingItems.length === 0) {
    return result;
  }

  for (const item of pendingItems) {
    result.processed++;

    try {
      // Mark as syncing
      await posDb.syncQueue.update(item.id!, {
        status: "syncing",
        lastAttemptAt: new Date().toISOString(),
      });

      // Process based on type
      let success = false;
      let serverOrderId: string | null = null;

      if (item.type === "sale") {
        const syncResult = await syncSale(item);
        success = syncResult.success;
        serverOrderId = syncResult.orderId;
      }

      if (success) {
        // Mark as synced and remove from queue
        await posDb.syncQueue.update(item.id!, { status: "synced" });

        // Update receipt with server order ID if applicable
        if (serverOrderId && item.type === "sale") {
          await posDb.receipts.update(item.clientId, {
            syncStatus: "synced",
            serverOrderId,
          });
        }

        // Delete the queue item (or keep for audit trail)
        await posDb.syncQueue.delete(item.id!);

        result.succeeded++;
      } else {
        throw new Error("Sync failed without specific error");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const attempts = (item.attempts || 0) + 1;

      // Update with error info
      await posDb.syncQueue.update(item.id!, {
        status: attempts >= item.maxAttempts ? "failed" : "pending",
        attempts,
        errorMessage,
        lastAttemptAt: new Date().toISOString(),
      });

      result.failed++;
      result.errors.push({ clientId: item.clientId, error: errorMessage });
    }
  }

  return result;
}

/**
 * Sync a single sale to the server.
 */
async function syncSale(
  item: SyncQueueItem
): Promise<{ success: boolean; orderId: string | null }> {
  const payload = item.payload as {
    storeSlug: string;
    orderNumber: string;
    receiptNumber: string;
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
    staffNotes?: string;
    orderDate?: string;
    createdAt: string;
  };

  // Call the server action with the offline sale data
  // Note: Server generates its own order/receipt numbers. The original offline
  // numbers are preserved in the local receipt for user reference.
  const result = await recordSaleOnServer(item.tenantId, payload.storeSlug, {
    orderDate: payload.orderDate,
    amountPaid: payload.amountPaid,
    paymentMethod: payload.paymentMethod as
      | "cash"
      | "card"
      | "mobile_money"
      | "bank_transfer"
      | null,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    items: payload.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      variantName: i.variantName,
      sku: i.sku,
      price: i.price,
      quantity: i.quantity,
      trackInventory: i.trackInventory,
    })),
    discountAmount: payload.discountAmount,
    staffNotes: payload.staffNotes,
  });

  if (result.success && result.order) {
    return { success: true, orderId: result.order.id };
  }

  throw new Error(result.error?.message || "Failed to sync sale");
}

/**
 * Retry a specific failed item.
 */
export async function retryFailedItem(itemId: number): Promise<boolean> {
  const item = await posDb.syncQueue.get(itemId);
  if (!item || item.status !== "failed") {
    return false;
  }

  // Reset status to pending
  await posDb.syncQueue.update(itemId, {
    status: "pending",
    attempts: 0,
    errorMessage: null,
  });

  // Process immediately
  const result = await processSyncQueue();
  return result.succeeded > 0;
}

/**
 * Get sync queue status.
 */
export async function getSyncQueueStatus() {
  const pending = await posDb.syncQueue
    .where("status")
    .equals("pending")
    .count();
  const syncing = await posDb.syncQueue
    .where("status")
    .equals("syncing")
    .count();
  const failed = await posDb.syncQueue.where("status").equals("failed").count();

  return { pending, syncing, failed, total: pending + syncing + failed };
}

/**
 * Get failed items for manual review.
 */
export async function getFailedItems(): Promise<SyncQueueItem[]> {
  return posDb.syncQueue.where("status").equals("failed").toArray();
}

/**
 * Reset all failed items to pending status for retry.
 */
export async function resetFailedItems(): Promise<number> {
  const failed = await getFailedItems();
  if (failed.length === 0) return 0;

  await posDb.syncQueue.bulkUpdate(
    failed.map((item) => ({
      key: item.id!,
      changes: {
        status: "pending" as const,
        attempts: 0,
        errorMessage: null,
      },
    }))
  );

  return failed.length;
}

/**
 * Clear all synced items (cleanup).
 */
export async function clearSyncedItems(): Promise<number> {
  const synced = await posDb.syncQueue
    .where("status")
    .equals("synced")
    .toArray();
  await posDb.syncQueue.bulkDelete(synced.map((i) => i.id!));
  return synced.length;
}
