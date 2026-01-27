"use server";

import { db } from "@/lib/db";
import { categories, products, media } from "@/lib/db/schema";
import { eq, and, asc, count, sql } from "drizzle-orm";

export type CategoryWithProductCount = Awaited<
  ReturnType<typeof getCategoriesWithCounts>
>[number];

/**
 * Get all categories for a tenant with their product counts and image URLs
 * Only counts active products (consistent with POS and storefront views)
 */
export async function getCategoriesWithCounts(tenantId: string) {
  const categoriesList = await db
    .select({
      id: categories.id,
      tenantId: categories.tenantId,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageId: categories.imageId,
      imageUrl: media.url,
      displayOrder: categories.displayOrder,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(media, eq(media.id, categories.imageId))
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), eq(products.status, "active"))
    )
    .where(eq(categories.tenantId, tenantId))
    .groupBy(categories.id, media.url)
    .orderBy(asc(categories.displayOrder), asc(categories.name));

  return categoriesList;
}

/**
 * Get a single category by ID with image
 */
export async function getCategoryById(tenantId: string, categoryId: string) {
  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.tenantId, tenantId),
      eq(categories.id, categoryId)
    ),
    with: {
      image: true,
    },
  });

  return category;
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(tenantId: string, slug: string) {
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.tenantId, tenantId), eq(categories.slug, slug)),
  });

  return category;
}

/**
 * Get category by slug with image (for storefront)
 */
export async function getCategoryBySlugWithImage(
  tenantId: string,
  slug: string
) {
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.tenantId, tenantId), eq(categories.slug, slug)),
    with: {
      image: true,
    },
  });

  return category;
}

/**
 * Check if a category slug is available within a tenant
 */
export async function checkCategorySlugAvailable(
  tenantId: string,
  slug: string,
  excludeCategoryId?: string
): Promise<boolean> {
  const conditions = [
    eq(categories.tenantId, tenantId),
    eq(categories.slug, slug),
  ];

  if (excludeCategoryId) {
    conditions.push(sql`${categories.id} != ${excludeCategoryId}`);
  }

  const existing = await db.query.categories.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !existing;
}

/**
 * Get the maximum display order for categories in a tenant
 */
export async function getMaxCategoryDisplayOrder(
  tenantId: string
): Promise<number> {
  const result = await db
    .select({
      maxOrder: sql<number>`COALESCE(MAX(${categories.displayOrder}), -1)`,
    })
    .from(categories)
    .where(eq(categories.tenantId, tenantId));

  return result[0]?.maxOrder ?? -1;
}
