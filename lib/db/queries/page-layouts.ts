"use server";

import { db } from "@/lib/db";
import {
  pageLayouts,
  pageLayoutVersions,
  products,
  media,
  productImages,
  categories,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { unstable_cache, CACHE_TTL, cacheTags } from "@/lib/cache";
import type {
  PuckPageData,
  ResolvedProduct,
  ResolvedCategory,
} from "@/lib/page-builder/types";

/**
 * Get the full page layout record for a tenant + page ID.
 * Returns both draft and published data for the editor.
 */
export async function getPageLayout(tenantId: string, pageId: string) {
  return db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.id, pageId)
    ),
  });
}

/**
 * Get the full page layout record for a tenant by slug (for storefront rendering).
 */
export async function getPageLayoutBySlug(tenantId: string, slug: string) {
  return db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.slug, slug)
    ),
  });
}

/**
 * Get all page layouts for a tenant, ordered by displayOrder.
 * Used by the page management dashboard.
 */
export async function getPageLayouts(tenantId: string) {
  return db
    .select({
      id: pageLayouts.id,
      title: pageLayouts.title,
      slug: pageLayouts.slug,
      pageType: pageLayouts.pageType,
      isHomepage: pageLayouts.isHomepage,
      displayOrder: pageLayouts.displayOrder,
      publishedAt: pageLayouts.publishedAt,
      updatedAt: pageLayouts.updatedAt,
      hasPublished: sql<boolean>`(${pageLayouts.publishedData} IS NOT NULL)`,
      hasDraft: sql<boolean>`(${pageLayouts.draftData} IS NOT NULL)`,
    })
    .from(pageLayouts)
    .where(eq(pageLayouts.tenantId, tenantId))
    .orderBy(pageLayouts.displayOrder, pageLayouts.createdAt);
}

/**
 * Get the homepage layout (isHomepage = true).
 */
export async function getHomepageLayout(tenantId: string) {
  return db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.isHomepage, true)
    ),
  });
}

async function _getPublishedPageLayoutBySlug(
  tenantId: string,
  slug: string
): Promise<PuckPageData | null> {
  const result = await db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.slug, slug)
    ),
    columns: {
      publishedData: true,
    },
  });

  if (!result?.publishedData) return null;
  return result.publishedData as PuckPageData;
}

async function _getPublishedHomepageLayout(
  tenantId: string
): Promise<PuckPageData | null> {
  const result = await db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.isHomepage, true)
    ),
    columns: {
      publishedData: true,
    },
  });

  if (!result?.publishedData) return null;
  return result.publishedData as PuckPageData;
}

/**
 * Get only the published layout data for storefront rendering by slug.
 * Cached with 1-hour TTL, invalidated on publish/revert.
 */
export async function getPublishedPageLayoutBySlug(
  tenantId: string,
  slug: string
): Promise<PuckPageData | null> {
  return unstable_cache(
    () => _getPublishedPageLayoutBySlug(tenantId, slug),
    ["layout-slug", tenantId, slug],
    {
      revalidate: CACHE_TTL.layout,
      tags: [cacheTags.layout(tenantId, slug)],
    }
  )();
}

/**
 * Get the published homepage layout data for storefront rendering.
 * Falls back to the legacy "homepage" pageType if no isHomepage is set.
 * Cached with 1-hour TTL.
 */
export async function getPublishedHomepageLayout(
  tenantId: string
): Promise<PuckPageData | null> {
  return unstable_cache(
    () => _getPublishedHomepageLayout(tenantId),
    ["layout-homepage", tenantId],
    {
      revalidate: CACHE_TTL.layout,
      tags: [cacheTags.layout(tenantId, "homepage")],
    }
  )();
}

/**
 * @deprecated Use getPublishedHomepageLayout or getPublishedPageLayoutBySlug instead.
 * Kept for backward compatibility during migration.
 */
export async function getPublishedPageLayout(
  tenantId: string,
  _pageType: string
): Promise<PuckPageData | null> {
  return getPublishedHomepageLayout(tenantId);
}

/**
 * Get products by specific IDs for section rendering.
 * Maintains the order of input IDs. Filters to active products only.
 */
export async function getProductsByIds(
  tenantId: string,
  productIds: string[]
): Promise<ResolvedProduct[]> {
  if (productIds.length === 0) return [];

  // Fetch products with their first image
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      hasVariants: products.hasVariants,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        inArray(products.id, productIds)
      )
    );

  if (rows.length === 0) return [];

  // Fetch first two images for each product (primary + hover swap)
  const rowIds = rows.map((r) => r.id);
  const imageRows = await db
    .select({
      productId: productImages.productId,
      position: productImages.position,
      url: media.url,
      altText: media.altText,
    })
    .from(productImages)
    .innerJoin(media, eq(productImages.mediaId, media.id))
    .where(
      and(
        inArray(productImages.productId, rowIds),
        inArray(productImages.position, [0, 1])
      )
    );

  // Build image maps: position 0 = primary, position 1 = second (hover)
  const primaryImageMap = new Map<
    string,
    { url: string; altText: string | null }
  >();
  const secondImageMap = new Map<
    string,
    { url: string; altText: string | null }
  >();
  for (const img of imageRows) {
    if (img.position === 0) {
      primaryImageMap.set(img.productId, img);
    } else if (img.position === 1) {
      secondImageMap.set(img.productId, img);
    }
  }

  // Map and maintain input order
  const productMap = new Map<string, ResolvedProduct>(
    rows.map((r) => {
      const img = primaryImageMap.get(r.id);
      const secondImg = secondImageMap.get(r.id);
      return [
        r.id,
        {
          id: r.id,
          name: r.name,
          slug: r.slug,
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          imageUrl: img?.url ?? null,
          imageAlt: img?.altText ?? null,
          secondImageUrl: secondImg?.url ?? null,
          hasVariants: r.hasVariants,
        },
      ];
    })
  );

  return productIds
    .map((id) => productMap.get(id))
    .filter((p): p is ResolvedProduct => p != null);
}

/**
 * Get categories by specific IDs for section rendering.
 * Maintains the order of input IDs.
 */
export async function getCategoriesByIds(
  tenantId: string,
  categoryIds: string[]
): Promise<ResolvedCategory[]> {
  if (categoryIds.length === 0) return [];

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: media.url,
      productCount: sql<number>`(
          SELECT COUNT(*)::int FROM product_categories pc
          INNER JOIN products p ON p.id = pc.product_id
          WHERE pc.category_id = ${categories.id}
          AND p.tenant_id = ${tenantId}
          AND p.status = 'active'
        )`.as("product_count"),
    })
    .from(categories)
    .leftJoin(media, eq(categories.imageId, media.id))
    .where(
      and(
        eq(categories.tenantId, tenantId),
        inArray(categories.id, categoryIds)
      )
    );

  // Maintain input order
  const catMap = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        imageUrl: r.imageUrl,
        productCount: r.productCount,
      },
    ])
  );

  return categoryIds
    .map((id) => catMap.get(id))
    .filter((c): c is ResolvedCategory => c != null);
}

/**
 * Search products for the editor's product picker field.
 * Returns lightweight product data.
 */
export async function searchProductsForEditor(
  tenantId: string,
  query: string,
  limit: number = 20
): Promise<ResolvedProduct[]> {
  const { getProducts } = await import("./products");

  const result = await getProducts(tenantId, {
    page: 1,
    limit,
    filters: { isActive: true, search: query || undefined },
    sort: { field: "name", direction: "asc" },
  });

  return result.products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: null,
    imageUrl: p.image?.url ?? null,
    imageAlt: p.image?.altText ?? null,
    hasVariants: p.hasVariants,
    minVariantPrice: p.minVariantPrice,
    maxVariantPrice: p.maxVariantPrice,
  }));
}

/**
 * Get all categories for the editor's category picker field.
 */
export async function getCategoriesForEditor(
  tenantId: string
): Promise<ResolvedCategory[]> {
  const { getCategoriesWithCounts } = await import("./categories");

  const cats = await getCategoriesWithCounts(tenantId);
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    productCount: c.productCount,
  }));
}

// ============================================================================
// VERSION HISTORY QUERIES
// ============================================================================

/**
 * Get version history for a page layout, ordered by version descending.
 */
export async function getPageLayoutVersions(
  pageLayoutId: string,
  limit: number = 50
) {
  return db
    .select({
      id: pageLayoutVersions.id,
      version: pageLayoutVersions.version,
      publishedByName: pageLayoutVersions.publishedByName,
      label: pageLayoutVersions.label,
      createdAt: pageLayoutVersions.createdAt,
    })
    .from(pageLayoutVersions)
    .where(eq(pageLayoutVersions.pageLayoutId, pageLayoutId))
    .orderBy(desc(pageLayoutVersions.version))
    .limit(limit);
}

/**
 * Get a single version with its full data snapshot.
 */
export async function getPageLayoutVersion(versionId: string) {
  return db.query.pageLayoutVersions.findFirst({
    where: eq(pageLayoutVersions.id, versionId),
  });
}
