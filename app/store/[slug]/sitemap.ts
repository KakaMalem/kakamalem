import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenants, products, categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Per-store dynamic sitemap generation
 * Includes all products, categories, and static pages for each store
 *
 * This enables Google to discover all products in each store automatically
 * No store owner action required - SEO works out of the box
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-multiple-sitemaps
 */

/**
 * Generate sitemap entries for all active stores
 * Next.js will call sitemap() once for each entry returned here
 * Note: id property is required by Next.js - we use the store slug as the id
 */
export async function generateSitemaps(): Promise<{ id: string }[]> {
  const activeStores = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.status, "active"));

  return activeStores.map((store) => ({ id: store.slug }));
}

/**
 * Generate sitemap for a specific store
 * Includes: homepage, all products page, categories, individual products
 */
export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const slug = id;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const storeUrl = `${baseUrl}/store/${slug}`;

  // Get store to verify it exists and is active
  const store = await db
    .select({
      id: tenants.id,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.status, "active")))
    .limit(1);

  if (store.length === 0) {
    return [];
  }

  const tenantId = store[0].id;
  const storeUpdatedAt = store[0].updatedAt
    ? new Date(store[0].updatedAt)
    : new Date();

  // Get all active, visible products
  const storeProducts = await db
    .select({
      slug: products.slug,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        eq(products.showOnStorefront, true)
      )
    );

  // Get all categories
  const storeCategories = await db
    .select({
      slug: categories.slug,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.tenantId, tenantId));

  // Build sitemap entries
  const entries: MetadataRoute.Sitemap = [
    // Store homepage - highest priority
    {
      url: storeUrl,
      lastModified: storeUpdatedAt,
      changeFrequency: "daily",
      priority: 1,
    },
    // All products page
    {
      url: `${storeUrl}/products`,
      lastModified: storeUpdatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    // All categories page
    {
      url: `${storeUrl}/categories`,
      lastModified: storeUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Category pages
  for (const category of storeCategories) {
    entries.push({
      url: `${storeUrl}/category/${encodeURIComponent(category.slug)}`,
      lastModified: category.updatedAt
        ? new Date(category.updatedAt)
        : storeUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Product pages - highest priority after homepage
  for (const product of storeProducts) {
    entries.push({
      url: `${storeUrl}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt
        ? new Date(product.updatedAt)
        : storeUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  return entries;
}
