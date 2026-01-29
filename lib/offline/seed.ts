"use client";

import { posDb } from "./db";
import type {
  OfflineProduct,
  OfflineVariant,
  OfflineCategory,
  OfflineStoreSettings,
} from "./db";

/**
 * Check if the local DB has been seeded for this tenant.
 */
export async function isSeeded(tenantId: string): Promise<boolean> {
  const settings = await posDb.storeSettings.get(tenantId);
  return settings !== undefined;
}

/**
 * Get the last sync timestamp for a tenant.
 */
export async function getLastSyncedAt(
  tenantId: string
): Promise<string | null> {
  const settings = await posDb.storeSettings.get(tenantId);
  return settings?.lastSyncedAt ?? null;
}

/**
 * Seed store settings into IndexedDB.
 */
export async function seedStoreSettings(
  settings: OfflineStoreSettings
): Promise<void> {
  await posDb.storeSettings.put(settings);
}

/**
 * Seed products and variants into IndexedDB (bulk upsert).
 */
export async function seedProducts(
  products: OfflineProduct[],
  variants: OfflineVariant[]
): Promise<void> {
  await posDb.transaction("rw", [posDb.products, posDb.variants], async () => {
    await posDb.products.bulkPut(products);
    await posDb.variants.bulkPut(variants);
  });
}

/**
 * Seed categories into IndexedDB.
 */
export async function seedCategories(
  categories: OfflineCategory[]
): Promise<void> {
  await posDb.categories.bulkPut(categories);
}

/**
 * Update stock for a single product or variant.
 */
export async function updateOfflineStock(
  productId: string,
  variantId: string | null,
  newStock: number
): Promise<void> {
  if (variantId) {
    await posDb.variants.update(variantId, { stock: newStock });
  } else {
    await posDb.products.update(productId, { stock: newStock });
  }
}

/**
 * Bulk update stock from sync results.
 */
export async function bulkUpdateStock(
  updates: Array<{
    productId: string;
    variantId: string | null;
    newStock: number;
  }>
): Promise<void> {
  await posDb.transaction("rw", [posDb.products, posDb.variants], async () => {
    for (const update of updates) {
      if (update.variantId) {
        await posDb.variants.update(update.variantId, {
          stock: update.newStock,
        });
      } else {
        await posDb.products.update(update.productId, {
          stock: update.newStock,
        });
      }
    }
  });
}

/**
 * Clear all data for a tenant (for re-sync).
 */
export async function clearTenantData(tenantId: string): Promise<void> {
  await posDb.transaction(
    "rw",
    [posDb.products, posDb.variants, posDb.categories, posDb.storeSettings],
    async () => {
      await posDb.products.where("tenantId").equals(tenantId).delete();
      await posDb.variants.where("tenantId").equals(tenantId).delete();
      await posDb.categories.where("tenantId").equals(tenantId).delete();
      await posDb.storeSettings.delete(tenantId);
    }
  );
}

/**
 * Delete products that no longer exist on server.
 */
export async function deleteRemovedProducts(
  tenantId: string,
  deletedProductIds: string[]
): Promise<void> {
  if (deletedProductIds.length === 0) return;

  await posDb.transaction("rw", [posDb.products, posDb.variants], async () => {
    // Delete products
    await posDb.products.bulkDelete(deletedProductIds);

    // Delete associated variants
    for (const productId of deletedProductIds) {
      await posDb.variants.where("productId").equals(productId).delete();
    }
  });
}
