"use client";

import { posDb } from "./db";
import type {
  OfflineProduct,
  OfflineVariant,
  OfflineCategory,
  OfflineStoreSettings,
} from "./db";
import { seedProducts, seedCategories, seedStoreSettings } from "./seed";
import type { POSProduct } from "@/lib/stores/use-pos-products-store";

// ============================================================================
// TYPES
// ============================================================================

interface SyncResponse {
  success: boolean;
  data?: {
    products: OfflineProduct[];
    variants: OfflineVariant[];
    categories: OfflineCategory[];
    storeSettings: OfflineStoreSettings;
  };
  syncedAt?: string;
  error?: string;
}

interface SyncResult {
  success: boolean;
  productsCount: number;
  categoriesCount: number;
  error?: string;
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

/**
 * Fetch and seed all POS data from server to IndexedDB.
 * This is the main sync function called on POS page load.
 */
export async function syncPOSData(storeSlug: string): Promise<SyncResult> {
  try {
    const response = await fetch(`/api/dashboard/${storeSlug}/pos/sync`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        productsCount: 0,
        categoriesCount: 0,
        error: error.error || "Failed to fetch sync data",
      };
    }

    const data: SyncResponse = await response.json();

    if (!data.success || !data.data) {
      return {
        success: false,
        productsCount: 0,
        categoriesCount: 0,
        error: data.error || "Invalid sync response",
      };
    }

    // Seed all data to IndexedDB
    await seedProducts(data.data.products, data.data.variants);
    await seedCategories(data.data.categories);
    await seedStoreSettings(data.data.storeSettings);

    return {
      success: true,
      productsCount: data.data.products.length,
      categoriesCount: data.data.categories.length,
    };
  } catch (error) {
    console.error("POS sync error:", error);
    return {
      success: false,
      productsCount: 0,
      categoriesCount: 0,
      error: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}

/**
 * Check if we need to sync (no data or stale data).
 * Returns true if sync is needed.
 */
export async function needsSync(
  tenantId: string,
  maxAgeMs: number = 5 * 60 * 1000 // Default 5 minutes
): Promise<boolean> {
  try {
    const settings = await posDb.storeSettings.get(tenantId);

    if (!settings) {
      return true; // Never synced
    }

    const lastSynced = new Date(settings.lastSyncedAt).getTime();
    const now = Date.now();

    return now - lastSynced > maxAgeMs;
  } catch {
    return true; // Error reading, assume needs sync
  }
}

/**
 * Get the last sync timestamp for a tenant.
 */
export async function getLastSyncTime(tenantId: string): Promise<Date | null> {
  try {
    const settings = await posDb.storeSettings.get(tenantId);
    return settings ? new Date(settings.lastSyncedAt) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// DATA CONVERSION
// ============================================================================

/**
 * Convert offline products + variants to POSProduct format for Zustand store.
 * This bridges the gap between IndexedDB storage and the UI format.
 */
export async function getOfflineProductsAsPOS(
  tenantId: string,
  categoryId?: string | null,
  search?: string
): Promise<POSProduct[]> {
  // Get all products for this tenant
  let products = await posDb.products
    .where("tenantId")
    .equals(tenantId)
    .and((p) => p.showOnPos)
    .toArray();

  // Filter by category if specified
  if (categoryId) {
    products = products.filter(
      (p) => p.categoryId === categoryId || p.categoryIds.includes(categoryId)
    );
  }

  // Filter by search if specified
  if (search && search.trim().length >= 2) {
    const q = search.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode === search.trim() // Exact match for barcode scanner
    );
  }

  // Get all variants for these products in one query
  const productIds = products.map((p) => p.id);
  const allVariants = await posDb.variants
    .where("productId")
    .anyOf(productIds)
    .and((v) => v.isActive)
    .toArray();

  // Group variants by product ID
  const variantsByProduct = new Map<string, OfflineVariant[]>();
  for (const v of allVariants) {
    const existing = variantsByProduct.get(v.productId) || [];
    existing.push(v);
    variantsByProduct.set(v.productId, existing);
  }

  // Also search variants by barcode if we have a search term
  if (search && search.trim().length >= 2) {
    const variantMatches = await posDb.variants
      .where("tenantId")
      .equals(tenantId)
      .and((v) => v.isActive && v.barcode === search.trim())
      .toArray();

    // Add parent products of matching variants
    for (const v of variantMatches) {
      if (!productIds.includes(v.productId)) {
        const parentProduct = await posDb.products.get(v.productId);
        if (parentProduct && parentProduct.showOnPos) {
          products.push(parentProduct);
          productIds.push(v.productId);
          // Also get all variants for this product
          const productVariants = await posDb.variants
            .where("productId")
            .equals(v.productId)
            .and((v) => v.isActive)
            .toArray();
          variantsByProduct.set(v.productId, productVariants);
        }
      }
    }
  }

  // Convert to POSProduct format
  const posProducts: POSProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    stock: p.stock,
    trackInventory: p.trackInventory,
    hasVariants: p.hasVariants,
    image: p.imageUrl,
    variants: (variantsByProduct.get(p.id) || []).map((v) => ({
      id: v.id,
      displayName: v.displayName,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      stock: v.stock,
      image: v.imageUrl,
    })),
  }));

  // Limit to 50 products for performance (same as server limit)
  return posProducts.slice(0, 50);
}

/**
 * Search offline products by barcode (exact match).
 * Used for barcode scanner integration.
 */
export async function searchOfflineByBarcode(
  tenantId: string,
  barcode: string
): Promise<POSProduct | null> {
  // First check product barcodes
  const product = await posDb.products
    .where("barcode")
    .equals(barcode)
    .and((p) => p.tenantId === tenantId && p.showOnPos)
    .first();

  if (product) {
    const variants = await posDb.variants
      .where("productId")
      .equals(product.id)
      .and((v) => v.isActive)
      .toArray();

    return {
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      trackInventory: product.trackInventory,
      hasVariants: product.hasVariants,
      image: product.imageUrl,
      variants: variants.map((v) => ({
        id: v.id,
        displayName: v.displayName,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        stock: v.stock,
        image: v.imageUrl,
      })),
    };
  }

  // Check variant barcodes
  const variant = await posDb.variants
    .where("barcode")
    .equals(barcode)
    .and((v) => v.tenantId === tenantId && v.isActive)
    .first();

  if (variant) {
    const parentProduct = await posDb.products.get(variant.productId);
    if (parentProduct && parentProduct.showOnPos) {
      const allVariants = await posDb.variants
        .where("productId")
        .equals(parentProduct.id)
        .and((v) => v.isActive)
        .toArray();

      return {
        id: parentProduct.id,
        name: parentProduct.name,
        price: parentProduct.price,
        stock: parentProduct.stock,
        trackInventory: parentProduct.trackInventory,
        hasVariants: parentProduct.hasVariants,
        image: parentProduct.imageUrl,
        variants: allVariants.map((v) => ({
          id: v.id,
          displayName: v.displayName,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          stock: v.stock,
          image: v.imageUrl,
        })),
      };
    }
  }

  return null;
}

/**
 * Get offline categories in display format.
 */
export async function getOfflineCategories(tenantId: string) {
  const categories = await posDb.categories
    .where("tenantId")
    .equals(tenantId)
    .sortBy("displayOrder");

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.imageUrl,
    productCount: c.productCount,
  }));
}

/**
 * Get offline store settings.
 */
export async function getOfflineSettings(tenantId: string) {
  return posDb.storeSettings.get(tenantId);
}
