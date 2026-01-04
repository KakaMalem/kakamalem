"use server";

import { db } from "@/lib/db";
import { products, categories, tenants } from "@/lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { slugify } from "@/lib/utils/slug";

/**
 * Generate a unique product slug for a tenant
 * Automatically appends numbers if slug already exists
 * This is the industry-standard approach used by Amazon, eBay, etc.
 */
export async function generateUniqueProductSlug(
  tenantId: string,
  name: string,
  existingProductId?: string
): Promise<string> {
  const baseSlug = slugify(name);

  // If no base slug could be generated, use fallback
  if (!baseSlug) {
    return generateUniqueProductSlug(tenantId, `product-${Date.now()}`, existingProductId);
  }

  // Check if base slug is available (excluding current product if updating)
  const existingProduct = existingProductId
    ? await db.query.products.findFirst({
        where: and(
          eq(products.tenantId, tenantId),
          eq(products.slug, baseSlug),
          ne(products.id, existingProductId)
        ),
      })
    : await db.query.products.findFirst({
        where: and(eq(products.tenantId, tenantId), eq(products.slug, baseSlug)),
      });

  // If slug is available, return it
  if (!existingProduct) {
    return baseSlug;
  }

  // Slug exists, find the next available number suffix
  // Query for all slugs that match the pattern: baseSlug, baseSlug-1, baseSlug-2, etc.
  const pattern = `${baseSlug}%`;
  const conditions = existingProductId
    ? [
        eq(products.tenantId, tenantId),
        sql`${products.slug} LIKE ${pattern}`,
        ne(products.id, existingProductId),
      ]
    : [eq(products.tenantId, tenantId), sql`${products.slug} LIKE ${pattern}`];

  const existingSlugs = await db
    .select({ slug: products.slug })
    .from(products)
    .where(and(...conditions));

  const slugSet = new Set(existingSlugs.map((p) => p.slug));

  // Find the next available number
  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (slugSet.has(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;

    // Safety check to prevent infinite loops
    if (counter > 10000) {
      // Use timestamp as last resort
      return `${baseSlug}-${Date.now()}`;
    }
  }

  return candidateSlug;
}

/**
 * Generate a unique category slug for a tenant
 */
export async function generateUniqueCategorySlug(
  tenantId: string,
  name: string,
  existingCategoryId?: string
): Promise<string> {
  const baseSlug = slugify(name);

  if (!baseSlug) {
    return generateUniqueCategorySlug(tenantId, `category-${Date.now()}`, existingCategoryId);
  }

  const existingCategory = existingCategoryId
    ? await db.query.categories.findFirst({
        where: and(
          eq(categories.tenantId, tenantId),
          eq(categories.slug, baseSlug),
          ne(categories.id, existingCategoryId)
        ),
      })
    : await db.query.categories.findFirst({
        where: and(eq(categories.tenantId, tenantId), eq(categories.slug, baseSlug)),
      });

  if (!existingCategory) {
    return baseSlug;
  }

  const pattern = `${baseSlug}%`;
  const conditions = existingCategoryId
    ? [
        eq(categories.tenantId, tenantId),
        sql`${categories.slug} LIKE ${pattern}`,
        ne(categories.id, existingCategoryId),
      ]
    : [eq(categories.tenantId, tenantId), sql`${categories.slug} LIKE ${pattern}`];

  const existingSlugs = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(and(...conditions));

  const slugSet = new Set(existingSlugs.map((c) => c.slug));

  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (slugSet.has(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;

    if (counter > 10000) {
      return `${baseSlug}-${Date.now()}`;
    }
  }

  return candidateSlug;
}

/**
 * Generate a unique store/tenant slug (global, not tenant-scoped)
 */
export async function generateUniqueStoreSlug(
  name: string,
  existingTenantId?: string
): Promise<string> {
  const baseSlug = slugify(name);

  if (!baseSlug) {
    return generateUniqueStoreSlug(`store-${Date.now()}`, existingTenantId);
  }

  const existingTenant = existingTenantId
    ? await db.query.tenants.findFirst({
        where: and(eq(tenants.slug, baseSlug), ne(tenants.id, existingTenantId)),
      })
    : await db.query.tenants.findFirst({
        where: eq(tenants.slug, baseSlug),
      });

  if (!existingTenant) {
    return baseSlug;
  }

  const pattern = `${baseSlug}%`;
  const conditions = existingTenantId
    ? [sql`${tenants.slug} LIKE ${pattern}`, ne(tenants.id, existingTenantId)]
    : [sql`${tenants.slug} LIKE ${pattern}`];

  const existingSlugs = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(and(...conditions));

  const slugSet = new Set(existingSlugs.map((t) => t.slug));

  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (slugSet.has(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;

    if (counter > 10000) {
      return `${baseSlug}-${Date.now()}`;
    }
  }

  return candidateSlug;
}
