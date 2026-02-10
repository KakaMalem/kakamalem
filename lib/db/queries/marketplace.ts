"use server";

import { db } from "@/lib/db";
import {
  tenants,
  products,
  media,
  productImages,
  reviews,
  marketplaceProfiles,
  marketplaceCategories,
  marketplaceStoreCategories,
  storeFollows,
} from "@/lib/db/schema";
import {
  eq,
  and,
  ilike,
  desc,
  asc,
  count,
  avg,
  sql,
  inArray,
  or,
} from "drizzle-orm";

// =============================================================================
// MARKETPLACE TYPES
// =============================================================================

export type MarketplaceStore = Awaited<
  ReturnType<typeof getMarketplaceStores>
>["stores"][number];

export type MarketplaceStoreProfile = NonNullable<
  Awaited<ReturnType<typeof getMarketplaceStoreProfile>>
>;

export type MarketplaceCategoryItem = Awaited<
  ReturnType<typeof getMarketplacePlatformCategories>
>[number];

// =============================================================================
// HELPERS
// =============================================================================

/** Filter tenants.socialLinks to only URL/phone values (exclude booleans, config keys) */
function filterSocialLinksToUrls(
  links: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(links)) {
    if (
      typeof value === "string" &&
      value.trim() &&
      // Skip non-URL config fields
      key !== "preferredContactMethod" &&
      key !== "showWhatsAppButton"
    ) {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================
// GET MARKETPLACE STORES (primary query — store-directory focused)
// =============================================================================

export async function getMarketplaceStores(
  options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string; // marketplace category ID
    city?: string;
    sort?: "recommended" | "newest" | "rating" | "popular" | "name";
  } = {}
) {
  const {
    page = 1,
    limit = 12,
    search,
    category,
    city,
    sort = "recommended",
  } = options;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [
    eq(tenants.marketplaceEnabled, true),
    eq(tenants.status, "active"),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(tenants.name, `%${search}%`),
        ilike(tenants.tagline, `%${search}%`)
      )!
    );
  }

  if (city) {
    conditions.push(
      sql`LOWER(TRIM(${tenants.storeLocationCity})) = LOWER(TRIM(${city}))`
    );
  }

  // If filtering by category, only include stores assigned to that category
  if (category) {
    const storesInCategory = db
      .select({ tenantId: marketplaceStoreCategories.tenantId })
      .from(marketplaceStoreCategories)
      .where(eq(marketplaceStoreCategories.categoryId, category));

    conditions.push(inArray(tenants.id, storesInCategory));
  }

  // Build order by
  const orderBy =
    sort === "newest"
      ? [desc(tenants.createdAt)]
      : sort === "name"
        ? [asc(tenants.name)]
        : sort === "rating"
          ? [
              sql`(SELECT AVG(r.rating) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.tenant_id = tenants.id) DESC NULLS LAST`,
              desc(tenants.createdAt),
            ]
          : // "popular" and "recommended" — sort by order count then recency
            [
              sql`(${tenants.analytics}->>'totalOrders')::int DESC NULLS LAST`,
              desc(tenants.createdAt),
            ];

  // Fetch stores with marketplace profile
  const storesList = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      tagline: tenants.tagline,
      description: tenants.description,
      logoUrl: tenants.logoUrl,
      currency: tenants.currency,
      storeLocationCity: tenants.storeLocationCity,
      subscriptionPlan: tenants.subscriptionPlan,
      subscriptionStatus: tenants.subscriptionStatus,
      analytics: tenants.analytics,
      createdAt: tenants.createdAt,
      // Marketplace profile
      coverImage: marketplaceProfiles.coverImage,
      tags: marketplaceProfiles.tags,
      featuredProductIds: marketplaceProfiles.featuredProductIds,
      priceRange: marketplaceProfiles.priceRange,
      isVerified: marketplaceProfiles.isVerified,
      displayOrder: marketplaceProfiles.displayOrder,
    })
    .from(tenants)
    .leftJoin(marketplaceProfiles, eq(tenants.id, marketplaceProfiles.tenantId))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const storeIds = storesList.map((s) => s.id);

  // Batch queries: product counts, ratings, categories
  const [productCounts, storeRatings, storeCategoryRows] =
    storeIds.length > 0
      ? await Promise.all([
          // Product counts
          db
            .select({
              tenantId: products.tenantId,
              count: count(),
            })
            .from(products)
            .where(
              and(
                inArray(products.tenantId, storeIds),
                eq(products.status, "active"),
                eq(products.showOnStorefront, true)
              )
            )
            .groupBy(products.tenantId),

          // Average ratings per store
          db
            .select({
              tenantId: reviews.tenantId,
              averageRating: avg(reviews.rating),
              reviewCount: count(),
            })
            .from(reviews)
            .where(inArray(reviews.tenantId, storeIds))
            .groupBy(reviews.tenantId),

          // Store categories
          db
            .select({
              tenantId: marketplaceStoreCategories.tenantId,
              categoryId: marketplaceCategories.id,
              categoryName: marketplaceCategories.name,
              categorySlug: marketplaceCategories.slug,
              categoryIcon: marketplaceCategories.icon,
            })
            .from(marketplaceStoreCategories)
            .innerJoin(
              marketplaceCategories,
              eq(
                marketplaceStoreCategories.categoryId,
                marketplaceCategories.id
              )
            )
            .where(inArray(marketplaceStoreCategories.tenantId, storeIds)),
        ])
      : [[], [], []];

  // Build lookup maps
  const productCountMap = new Map(
    productCounts.map((pc) => [pc.tenantId, pc.count])
  );
  const ratingMap = new Map(
    storeRatings.map((sr) => [
      sr.tenantId,
      {
        rating: sr.averageRating ? parseFloat(sr.averageRating) : null,
        reviewCount: sr.reviewCount,
      },
    ])
  );
  const categoryMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
      slug: string;
      icon: string | null;
    }>
  >();
  for (const row of storeCategoryRows) {
    const existing = categoryMap.get(row.tenantId) ?? [];
    existing.push({
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
      icon: row.categoryIcon,
    });
    categoryMap.set(row.tenantId, existing);
  }

  const stores = storesList.map((store) => {
    const isPro =
      store.subscriptionPlan === "pro" && store.subscriptionStatus === "active";
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(store.createdAt).getTime()) / 86400000
    );

    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      tagline: store.tagline,
      description: store.description,
      logoUrl: store.logoUrl,
      currency: store.currency,
      storeLocationCity: store.storeLocationCity,
      createdAt: store.createdAt,
      // Marketplace profile
      coverImage: store.coverImage,
      about: store.description,
      tags: (store.tags ?? []) as string[],
      priceRange: store.priceRange ?? 2,
      isVerified: store.isVerified ?? false,
      isPro,
      isNew: daysSinceCreated <= 30,
      displayOrder: store.displayOrder ?? 0,
      // Aggregated data
      productCount: productCountMap.get(store.id) ?? 0,
      rating: ratingMap.get(store.id)?.rating ?? null,
      reviewCount: ratingMap.get(store.id)?.reviewCount ?? 0,
      categories: categoryMap.get(store.id) ?? [],
    };
  });

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(tenants)
    .where(and(...conditions));

  return {
    stores,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// =============================================================================
// GET MARKETPLACE STORE PROFILE (for /marketplace/stores/[slug])
// =============================================================================

export async function getMarketplaceStoreProfile(slug: string) {
  // Fetch store + marketplace profile
  const store = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      tagline: tenants.tagline,
      description: tenants.description,
      logoUrl: tenants.logoUrl,
      currency: tenants.currency,
      storeLocationCity: tenants.storeLocationCity,
      subscriptionPlan: tenants.subscriptionPlan,
      subscriptionStatus: tenants.subscriptionStatus,
      analytics: tenants.analytics,
      marketplaceEnabled: tenants.marketplaceEnabled,
      status: tenants.status,
      createdAt: tenants.createdAt,
      storeSocialLinks: tenants.socialLinks,
      // Marketplace profile
      coverImage: marketplaceProfiles.coverImage,
      tags: marketplaceProfiles.tags,
      featuredProductIds: marketplaceProfiles.featuredProductIds,
      priceRange: marketplaceProfiles.priceRange,
      highlights: marketplaceProfiles.highlights,
      isVerified: marketplaceProfiles.isVerified,
    })
    .from(tenants)
    .leftJoin(marketplaceProfiles, eq(tenants.id, marketplaceProfiles.tenantId))
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (
    !store[0] ||
    !store[0].marketplaceEnabled ||
    store[0].status !== "active"
  ) {
    return null;
  }

  const s = store[0];

  // Batch: categories, ratings, featured products, product count
  const [
    storeCategories,
    ratingResult,
    ratingDistribution,
    featuredProducts,
    productCountResult,
  ] = await Promise.all([
    // Categories
    db
      .select({
        id: marketplaceCategories.id,
        name: marketplaceCategories.name,
        slug: marketplaceCategories.slug,
        icon: marketplaceCategories.icon,
      })
      .from(marketplaceStoreCategories)
      .innerJoin(
        marketplaceCategories,
        eq(marketplaceStoreCategories.categoryId, marketplaceCategories.id)
      )
      .where(eq(marketplaceStoreCategories.tenantId, s.id)),

    // Average rating
    db
      .select({
        averageRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(eq(reviews.tenantId, s.id)),

    // Rating distribution (5,4,3,2,1)
    db
      .select({
        rating: reviews.rating,
        count: count(),
      })
      .from(reviews)
      .where(eq(reviews.tenantId, s.id))
      .groupBy(reviews.rating),

    // Featured products (up to 6)
    (() => {
      const featuredIds = (s.featuredProductIds ?? []) as string[];
      if (featuredIds.length === 0) {
        // Fall back to newest active products
        return db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            price: products.price,
            compareAtPrice: products.compareAtPrice,
            imageUrl: media.url,
            imageAlt: media.altText,
          })
          .from(products)
          .leftJoin(
            productImages,
            and(
              eq(productImages.productId, products.id),
              eq(productImages.position, 0)
            )
          )
          .leftJoin(media, eq(productImages.mediaId, media.id))
          .where(
            and(
              eq(products.tenantId, s.id),
              eq(products.status, "active"),
              eq(products.showOnStorefront, true)
            )
          )
          .orderBy(desc(products.createdAt))
          .limit(6);
      }

      return db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
          compareAtPrice: products.compareAtPrice,
          imageUrl: media.url,
          imageAlt: media.altText,
        })
        .from(products)
        .leftJoin(
          productImages,
          and(
            eq(productImages.productId, products.id),
            eq(productImages.position, 0)
          )
        )
        .leftJoin(media, eq(productImages.mediaId, media.id))
        .where(
          and(inArray(products.id, featuredIds), eq(products.status, "active"))
        )
        .limit(6);
    })(),

    // Product count
    db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          eq(products.tenantId, s.id),
          eq(products.status, "active"),
          eq(products.showOnStorefront, true)
        )
      ),
  ]);

  // Build rating distribution map (1-5)
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of ratingDistribution) {
    if (row.rating >= 1 && row.rating <= 5) {
      ratingDist[row.rating] = row.count;
    }
  }

  const isPro =
    s.subscriptionPlan === "pro" && s.subscriptionStatus === "active";
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(s.createdAt).getTime()) / 86400000
  );

  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    logoUrl: s.logoUrl,
    currency: s.currency,
    storeLocationCity: s.storeLocationCity,
    createdAt: s.createdAt,
    // Profile
    coverImage: s.coverImage,
    about: s.description,
    tags: (s.tags ?? []) as string[],
    priceRange: s.priceRange ?? 2,
    highlights: (s.highlights ?? []) as string[],
    socialLinks: filterSocialLinksToUrls(
      (s.storeSocialLinks ?? {}) as Record<string, unknown>
    ),
    isVerified: s.isVerified ?? false,
    isPro,
    isNew: daysSinceCreated <= 30,
    // Stats
    productCount: productCountResult[0]?.count ?? 0,
    rating: ratingResult[0]?.averageRating
      ? parseFloat(ratingResult[0].averageRating)
      : null,
    reviewCount: ratingResult[0]?.reviewCount ?? 0,
    ratingDistribution: ratingDist,
    // Related
    categories: storeCategories,
    featuredProducts: featuredProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.imageUrl ? { url: p.imageUrl, alt: p.imageAlt } : null,
    })),
    totalOrders:
      (s.analytics as { totalOrders?: number } | null)?.totalOrders ?? 0,
  };
}

// =============================================================================
// GET MARKETPLACE PLATFORM CATEGORIES
// =============================================================================

/**
 * Get all active platform-level marketplace categories with store counts
 */
export async function getMarketplacePlatformCategories() {
  const result = await db
    .select({
      id: marketplaceCategories.id,
      slug: marketplaceCategories.slug,
      name: marketplaceCategories.name,
      nameFa: marketplaceCategories.nameFa,
      namePs: marketplaceCategories.namePs,
      icon: marketplaceCategories.icon,
      displayOrder: marketplaceCategories.displayOrder,
      storeCount: count(marketplaceStoreCategories.id),
    })
    .from(marketplaceCategories)
    .leftJoin(
      marketplaceStoreCategories,
      eq(marketplaceCategories.id, marketplaceStoreCategories.categoryId)
    )
    .where(eq(marketplaceCategories.isActive, true))
    .groupBy(marketplaceCategories.id)
    .orderBy(asc(marketplaceCategories.displayOrder));

  return result;
}

// =============================================================================
// GET SIMILAR STORES
// =============================================================================

export async function getSimilarStores(tenantId: string, limit = 4) {
  // Get this store's categories
  const storeCategories = await db
    .select({ categoryId: marketplaceStoreCategories.categoryId })
    .from(marketplaceStoreCategories)
    .where(eq(marketplaceStoreCategories.tenantId, tenantId));

  const categoryIds = storeCategories.map((sc) => sc.categoryId);

  if (categoryIds.length === 0) {
    // No categories — return popular stores excluding this one
    return getMarketplaceStores({ limit: limit + 1, sort: "popular" }).then(
      (r) => r.stores.filter((s) => s.id !== tenantId).slice(0, limit)
    );
  }

  // Find stores sharing categories (excluding this store)
  const similarStoreIds = await db
    .selectDistinct({ tenantId: marketplaceStoreCategories.tenantId })
    .from(marketplaceStoreCategories)
    .innerJoin(tenants, eq(marketplaceStoreCategories.tenantId, tenants.id))
    .where(
      and(
        inArray(marketplaceStoreCategories.categoryId, categoryIds),
        eq(tenants.marketplaceEnabled, true),
        eq(tenants.status, "active"),
        sql`${marketplaceStoreCategories.tenantId} != ${tenantId}`
      )
    )
    .limit(limit);

  const ids = similarStoreIds.map((s) => s.tenantId);

  if (ids.length === 0) {
    // Fall back to popular stores
    return getMarketplaceStores({ limit: limit + 1, sort: "popular" }).then(
      (r) => r.stores.filter((s) => s.id !== tenantId).slice(0, limit)
    );
  }

  // Fetch those stores
  const result = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      tagline: tenants.tagline,
      logoUrl: tenants.logoUrl,
      storeLocationCity: tenants.storeLocationCity,
      coverImage: marketplaceProfiles.coverImage,
      isVerified: marketplaceProfiles.isVerified,
    })
    .from(tenants)
    .leftJoin(marketplaceProfiles, eq(tenants.id, marketplaceProfiles.tenantId))
    .where(inArray(tenants.id, ids));

  return result.map((s) => ({
    ...s,
    isVerified: s.isVerified ?? false,
  }));
}

// =============================================================================
// FOLLOW QUERIES
// =============================================================================

/**
 * Check if a user follows a store
 */
export async function isFollowingStore(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .select({ id: storeFollows.id })
    .from(storeFollows)
    .where(
      and(eq(storeFollows.userId, userId), eq(storeFollows.tenantId, tenantId))
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get stores a user follows
 */
export async function getFollowedStoreIds(userId: string): Promise<string[]> {
  const result = await db
    .select({ tenantId: storeFollows.tenantId })
    .from(storeFollows)
    .where(eq(storeFollows.userId, userId));

  return result.map((r) => r.tenantId);
}

// =============================================================================
// GET MARKETPLACE SETTINGS DATA (for dashboard settings form)
// =============================================================================

/**
 * Get marketplace profile data for the settings form (does NOT require marketplace enabled)
 */
export async function getMarketplaceSettingsData(tenantId: string) {
  const [profileResult, storeCategoryResult] = await Promise.all([
    db
      .select({
        coverImage: marketplaceProfiles.coverImage,
        tags: marketplaceProfiles.tags,
        featuredProductIds: marketplaceProfiles.featuredProductIds,
        priceRange: marketplaceProfiles.priceRange,
      })
      .from(marketplaceProfiles)
      .where(eq(marketplaceProfiles.tenantId, tenantId))
      .limit(1),
    db
      .select({ categoryId: marketplaceStoreCategories.categoryId })
      .from(marketplaceStoreCategories)
      .where(eq(marketplaceStoreCategories.tenantId, tenantId)),
  ]);

  const profile = profileResult[0] ?? null;
  return {
    coverImage: profile?.coverImage ?? null,
    tags: (profile?.tags ?? []) as string[],
    featuredProductIds: (profile?.featuredProductIds ?? []) as string[],
    priceRange: profile?.priceRange ?? 2,
    categoryIds: storeCategoryResult.map((r) => r.categoryId),
  };
}

/**
 * Get simple product list for featured products picker
 */
export async function getProductsForFeaturedPicker(tenantId: string) {
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      imageUrl: media.url,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0)
      )
    )
    .leftJoin(media, eq(productImages.mediaId, media.id))
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        eq(products.showOnStorefront, true)
      )
    )
    .orderBy(desc(products.createdAt))
    .limit(50);

  return result;
}

// =============================================================================
// MARKETPLACE CITIES (for location filter)
// =============================================================================

/**
 * Get distinct cities that have marketplace-enabled stores
 */
export async function getMarketplaceCities(): Promise<string[]> {
  const result = await db
    .select({
      city: sql<string>`TRIM(${tenants.storeLocationCity})`.as("city"),
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.marketplaceEnabled, true),
        eq(tenants.status, "active"),
        sql`${tenants.storeLocationCity} IS NOT NULL AND TRIM(${tenants.storeLocationCity}) != ''`
      )
    )
    .groupBy(sql`TRIM(${tenants.storeLocationCity})`)
    .orderBy(sql`TRIM(${tenants.storeLocationCity})`);

  return result.map((r) => r.city);
}
