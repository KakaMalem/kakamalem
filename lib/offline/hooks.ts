"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { posDb } from "./db";
import type {
  OfflineProduct,
  OfflineVariant,
  OfflineCategory,
  OfflineStoreSettings,
} from "./db";

/**
 * Live query for offline products with optional category and search filtering.
 * Returns a reactive array that auto-updates when IndexedDB changes.
 */
export function useOfflineProducts(
  tenantId: string,
  categoryId?: string | null,
  search?: string
): OfflineProduct[] | undefined {
  return useLiveQuery(
    async () => {
      // Get all products for tenant that are shown on POS
      let results = await posDb.products
        .where("tenantId")
        .equals(tenantId)
        .and((p) => p.showOnPos)
        .toArray();

      // Filter by category if specified
      if (categoryId) {
        results = results.filter(
          (p) =>
            p.categoryId === categoryId || p.categoryIds.includes(categoryId)
        );
      }

      // Filter by search term if specified
      if (search && search.trim().length >= 2) {
        const q = search.trim().toLowerCase();
        results = results.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode === search.trim() // Exact match for barcode
        );
      }

      return results;
    },
    [tenantId, categoryId, search],
    undefined // Default value while loading
  );
}

/**
 * Live query for offline variants for a specific product.
 */
export function useOfflineVariants(
  productId: string
): OfflineVariant[] | undefined {
  return useLiveQuery(
    () =>
      posDb.variants
        .where("productId")
        .equals(productId)
        .and((v) => v.isActive)
        .toArray(),
    [productId],
    undefined
  );
}

/**
 * Live query for offline categories ordered by displayOrder.
 */
export function useOfflineCategories(
  tenantId: string
): OfflineCategory[] | undefined {
  return useLiveQuery(
    () =>
      posDb.categories
        .where("tenantId")
        .equals(tenantId)
        .sortBy("displayOrder"),
    [tenantId],
    undefined
  );
}

/**
 * Live query for offline store settings.
 */
export function useOfflineStoreSettings(
  tenantId: string
): OfflineStoreSettings | undefined {
  return useLiveQuery(
    () => posDb.storeSettings.get(tenantId),
    [tenantId],
    undefined
  );
}

/**
 * Live query for pending sync queue count.
 */
export function useSyncQueueCount(): number {
  return (
    useLiveQuery(
      () => posDb.syncQueue.where("status").equals("pending").count(),
      [],
      0
    ) ?? 0
  );
}

/**
 * Live query for failed sync queue count.
 */
export function useFailedSyncCount(): number {
  return (
    useLiveQuery(
      () => posDb.syncQueue.where("status").equals("failed").count(),
      [],
      0
    ) ?? 0
  );
}

/**
 * Live query for syncing items count.
 */
export function useSyncingCount(): number {
  return (
    useLiveQuery(
      () => posDb.syncQueue.where("status").equals("syncing").count(),
      [],
      0
    ) ?? 0
  );
}
