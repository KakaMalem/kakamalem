"use client";

import { useCallback } from "react";
import { OFFLINE_POS_ENABLED } from "@/lib/offline/feature-flag";
import { useConnectivityStatus } from "@/lib/stores/use-connectivity-store";
import { searchProductsForSale } from "@/lib/actions/offline-sales";
import {
  getOfflineProductsAsPOS,
  searchOfflineByBarcode,
} from "@/lib/offline/sync";
import { bulkUpdateStock } from "@/lib/offline/seed";
import { posDb } from "@/lib/offline/db";
import type { POSProduct } from "@/lib/stores/use-pos-products-store";

interface UseOfflinePOSProductsOptions {
  tenantId: string;
}

interface LoadProductsResult {
  success: boolean;
  products: POSProduct[];
  source: "server" | "offline";
  error?: string;
}

/**
 * Hook that provides offline-aware product loading for POS.
 *
 * When online: fetches from server and caches to IndexedDB
 * When offline: reads from IndexedDB cache
 */
export function useOfflinePOSProducts({
  tenantId,
}: UseOfflinePOSProductsOptions) {
  const connectivityStatus = useConnectivityStatus();
  const isOnline = connectivityStatus !== "offline";

  /**
   * Load products - automatically switches between server and offline based on connectivity.
   */
  const loadProducts = useCallback(
    async (
      query: string,
      categoryId: string | null
    ): Promise<LoadProductsResult> => {
      // If offline mode is disabled, always use server
      if (!OFFLINE_POS_ENABLED) {
        const result = await searchProductsForSale(
          tenantId,
          query || "",
          categoryId
        );

        return {
          success: result.success,
          products: result.products || [],
          source: "server",
          error: result.error?.message,
        };
      }

      // If online, try server first
      if (isOnline) {
        try {
          const result = await searchProductsForSale(
            tenantId,
            query || "",
            categoryId
          );

          if (result.success && result.products) {
            // Cache the results to IndexedDB (don't await, fire and forget)
            cacheProducts(result.products, tenantId).catch(console.error);

            return {
              success: true,
              products: result.products,
              source: "server",
            };
          }

          // Server failed, fall back to offline
          console.warn("Server request failed, falling back to offline data");
        } catch (error) {
          console.error("Server error, falling back to offline:", error);
        }
      }

      // Offline mode - read from IndexedDB
      try {
        const products = await getOfflineProductsAsPOS(
          tenantId,
          categoryId,
          query
        );

        return {
          success: true,
          products,
          source: "offline",
        };
      } catch (error) {
        console.error("Offline data error:", error);
        return {
          success: false,
          products: [],
          source: "offline",
          error:
            error instanceof Error
              ? error.message
              : "Failed to load offline data",
        };
      }
    },
    [tenantId, isOnline]
  );

  /**
   * Search by barcode - prioritizes exact matches.
   */
  const searchByBarcode = useCallback(
    async (barcode: string): Promise<LoadProductsResult> => {
      if (!OFFLINE_POS_ENABLED) {
        const result = await searchProductsForSale(tenantId, barcode, null);
        return {
          success: result.success,
          products: result.products || [],
          source: "server",
          error: result.error?.message,
        };
      }

      if (isOnline) {
        try {
          const result = await searchProductsForSale(tenantId, barcode, null);
          if (result.success && result.products) {
            return {
              success: true,
              products: result.products,
              source: "server",
            };
          }
        } catch {
          // Fall through to offline
        }
      }

      // Offline barcode search
      try {
        const product = await searchOfflineByBarcode(tenantId, barcode);
        return {
          success: true,
          products: product ? [product] : [],
          source: "offline",
        };
      } catch (error) {
        return {
          success: false,
          products: [],
          source: "offline",
          error:
            error instanceof Error ? error.message : "Barcode search failed",
        };
      }
    },
    [tenantId, isOnline]
  );

  /**
   * Update stock in both server response cache and IndexedDB.
   */
  const updateStock = useCallback(
    async (
      updates: Array<{
        productId: string;
        variantId: string | null;
        newStock: number;
      }>
    ) => {
      if (!OFFLINE_POS_ENABLED) return;

      try {
        await bulkUpdateStock(updates);
      } catch (error) {
        console.error("Failed to update offline stock:", error);
      }
    },
    []
  );

  return {
    loadProducts,
    searchByBarcode,
    updateStock,
    isOnline,
    isOfflineEnabled: OFFLINE_POS_ENABLED,
  };
}

/**
 * Cache products and their variants to IndexedDB.
 * This runs in the background after server responses.
 */
async function cacheProducts(products: POSProduct[], tenantId: string) {
  const now = new Date().toISOString();

  // Convert to offline format
  const offlineProducts = products.map((p) => ({
    id: p.id,
    tenantId,
    name: p.name,
    price: p.price,
    sku: null as string | null, // Not available in POSProduct
    barcode: null as string | null, // Would need to add to POSProduct type
    stock: p.stock,
    trackInventory: p.trackInventory,
    hasVariants: p.hasVariants,
    categoryId: null as string | null, // Not available in POSProduct
    categoryIds: [] as string[], // Not available in POSProduct
    imageUrl: p.image,
    showOnPos: true,
    lastSyncedAt: now,
  }));

  const offlineVariants = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      productId: p.id,
      tenantId,
      displayName: v.displayName,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      stock: v.stock,
      isActive: true,
      imageUrl: v.image,
    }))
  );

  // Upsert to IndexedDB
  await posDb.transaction("rw", [posDb.products, posDb.variants], async () => {
    await posDb.products.bulkPut(offlineProducts);
    await posDb.variants.bulkPut(offlineVariants);
  });
}
