"use server";

import { db } from "@/lib/db";
import { products, tenants, notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { scrapeAliExpressPage } from "@/lib/aliexpress/scraper";
import { parseAliExpressPage } from "@/lib/aliexpress/parser";
import { revalidatePath } from "next/cache";

/**
 * Syncs a single product with AliExpress.
 * Updates the sourcePrice and stock, and creates a notification if the price changed by >10%.
 * @param productId The ID of the product
 * @param tenantId The store ID
 * @param isManual If true, throws errors instead of failing silently, and forces sync even if recently synced
 */
export async function syncAliExpressProduct(
  productId: string,
  tenantId: string,
  isManual = false
) {
  // 1. Fetch product and tenant info
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.tenantId, tenantId),
      eq(products.sourceType, "aliexpress")
    ),
  });

  if (!product) {
    if (isManual)
      throw new Error("Product not found or not an AliExpress product");
    return { success: false, reason: "Not found" };
  }

  if (!product.sourceUrl) {
    if (isManual) throw new Error("Product has no source URL");
    return { success: false, reason: "No URL" };
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { ownerId: true, slug: true },
  });

  if (!tenant) {
    if (isManual) throw new Error("Store not found");
    return { success: false, reason: "No store" };
  }

  // 2. Scrape data
  const scrapeResult = await scrapeAliExpressPage(product.sourceUrl);
  if (!scrapeResult.success || !scrapeResult.data) {
    if (isManual)
      throw new Error("Failed to scrape product page from AliExpress");
    return { success: false, reason: "Scrape failed" };
  }

  const aliData = parseAliExpressPage(scrapeResult.data, product.sourceUrl);
  if (!aliData || !aliData.price) {
    if (isManual) throw new Error("Failed to parse pricing data");
    return { success: false, reason: "Parse failed" };
  }

  const oldSourcePrice = parseFloat(product.sourcePrice || "0");
  const newSourcePrice = aliData.price;

  // Calculate percentage change (absolute)
  let percentChange = 0;
  if (oldSourcePrice > 0) {
    percentChange =
      Math.abs((newSourcePrice - oldSourcePrice) / oldSourcePrice) * 100;
  } else if (newSourcePrice > 0) {
    percentChange = 100; // From free to non-free? Unlikely, but just in case
  }

  const hasPriceChanged =
    newSourcePrice.toString() !== product.sourcePrice && percentChange > 0;
  const isSignificantChange = percentChange > 10;

  // 3. Update product in database
  const updates: Partial<typeof products.$inferInsert> = {
    sourceLastSyncedAt: new Date().toISOString(),
    sourcePrice: newSourcePrice.toString(),
    sourceData: scrapeResult.data,
  };

  // If simple product, update stock directly (for variants, we skip for now as per plan)
  if (!product.hasVariants && aliData.variants.length > 0) {
    updates.stock = aliData.variants[0].stock;
  }

  await db.update(products).set(updates).where(eq(products.id, productId));

  // 4. Create Notification if price changed significantly
  if (hasPriceChanged && isSignificantChange) {
    const direction =
      newSourcePrice > oldSourcePrice ? "increased" : "decreased";

    await db.insert(notifications).values({
      userId: tenant.ownerId,
      tenantId: tenantId,
      type: "aliexpress_price_change",
      title: "Supplier Price Change Detected 🚨",
      body: `The AliExpress supplier price for "${product.name}" has ${direction} by ${percentChange.toFixed(1)}%. It changed from $${oldSourcePrice} to $${newSourcePrice}. You may want to update your selling price.`,
      actionUrl: `/dashboard/${tenant.slug}/products/${productId}/edit`,
      actionLabel: "Review Product",
      avatarUrl: product.hasVariants ? null : null, // (You'd pass product image if available, skipped for brevity)
    });
  }

  revalidatePath(`/dashboard/${tenant.slug}/products/${productId}/edit`);
  revalidatePath(`/dashboard/${tenant.slug}/products`);

  return {
    success: true,
    hasPriceChanged,
    percentChange,
    oldPrice: oldSourcePrice,
    newPrice: newSourcePrice,
    stockUpdatedAt: new Date().toISOString(),
  };
}

export async function syncAliExpressProductAction(
  productId: string,
  tenantId: string
) {
  try {
    const { requireAuth } = await import("@/lib/auth/server");
    const { canManageStore } = await import("@/lib/auth/context");

    await requireAuth();

    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return {
        success: false,
        error: "You don't have permission to manage this store",
      };
    }

    const result = await syncAliExpressProduct(productId, tenantId, true);
    return result;
  } catch (error) {
    console.error("Manual sync failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}
