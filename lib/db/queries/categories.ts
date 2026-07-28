"use server";

import { db } from "@/lib/db";
import {
  categories,
  products,
  media,
  productCategories,
  productImages,
} from "@/lib/db/schema";
import { eq, and, asc, countDistinct, sql } from "drizzle-orm";

export type CategoryWithProductCount = Awaited<
  ReturnType<typeof getCategoriesWithCounts>
>[number];

/**
 * Get all categories for a tenant with their product counts and image URLs.
 *
 * Category membership is the many-to-many `product_categories` junction table
 * (the same source of truth the storefront uses to list products by category),
 * NOT the legacy single `products.category_id` column — counting via that
 * column reports 0 for products assigned through the junction.
 *
 * Counts every active product by default, because the dashboard needs the true
 * number — the delete confirmation gates its "these products will become
 * uncategorized" warning on it, so under-counting there silently hides real
 * data loss. Storefront callers pass `storefrontOnly` to match the predicate
 * the category detail page lists with, so a badge never promises more items
 * than the page actually shows.
 */
export async function getCategoriesWithCounts(
  tenantId: string,
  options?: { storefrontOnly?: boolean }
) {
  const productJoin = [
    eq(products.id, productCategories.productId),
    eq(products.status, "active"),
  ];
  if (options?.storefrontOnly) {
    productJoin.push(eq(products.showOnStorefront, true));
  }

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
      productCount: countDistinct(products.id),
    })
    .from(categories)
    .leftJoin(media, eq(media.id, categories.imageId))
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id)
    )
    .leftJoin(products, and(...productJoin))
    .where(eq(categories.tenantId, tenantId))
    .groupBy(categories.id, media.url)
    .orderBy(asc(categories.displayOrder), asc(categories.name));

  return categoriesList;
}

/**
 * Pick one product photo per category, to use as a cover when the seller never
 * uploaded a category image (the common case — otherwise the categories page
 * renders as a wall of grey placeholders).
 *
 * One query for the whole tenant, not one per category. The LATERAL stops at
 * the first match per category (`LIMIT 1`), so the work scales with the number
 * of categories rather than the size of the catalog — a plain DISTINCT ON here
 * would sort every (product x image) row the tenant owns.
 *
 * The ordering ends in `id` columns on purpose: display_order and position both
 * default to 0, so without a unique tiebreaker Postgres could pick a different
 * cover per execution and the same category would flicker between photos.
 *
 * Tenant isolation comes from `categories`, the tenant-scoped table driving the
 * query — copy this into another context and you must re-check that.
 */
export async function getCategoryCoverFallbacks(
  tenantId: string
): Promise<Map<string, string>> {
  const rows = await db.execute<{ categoryId: string; imageUrl: string }>(sql`
    SELECT
      ${categories.id} AS "categoryId",
      cover.url AS "imageUrl"
    FROM ${categories}
    CROSS JOIN LATERAL (
      SELECT ${media.url}
      FROM ${productCategories}
      JOIN ${products} ON ${products.id} = ${productCategories.productId}
      JOIN ${productImages} ON ${productImages.productId} = ${products.id}
      JOIN ${media} ON ${media.id} = ${productImages.mediaId}
      WHERE ${productCategories.categoryId} = ${categories.id}
        AND ${products.status} = 'active'
        AND ${products.showOnStorefront} = true
      ORDER BY
        ${products.displayOrder} ASC,
        ${products.id} ASC,
        ${productImages.position} ASC,
        ${productImages.id} ASC
      LIMIT 1
    ) AS cover
    WHERE ${categories.tenantId} = ${tenantId}
  `);

  // drizzle-orm/postgres-js returns an array-like RowList, not { rows }.
  const covers = new Map<string, string>();
  for (const row of rows) {
    if (row.categoryId && row.imageUrl)
      covers.set(row.categoryId, row.imageUrl);
  }
  return covers;
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
