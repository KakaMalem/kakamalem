"use server";

import { db } from "@/lib/db";
import {
  products,
  categories,
  media,
  productImages,
  productCategories,
  productVariants,
  priceTiers,
  reviews,
} from "@/lib/db/schema";
import {
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  avg,
  min,
  sql,
  inArray,
} from "drizzle-orm";

export type ProductWithCategory = Awaited<
  ReturnType<typeof getProducts>
>["products"][number];

export type ProductFilters = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
  showOnStorefront?: boolean;
  showOnPos?: boolean;
};

export type ProductSort = {
  field: "name" | "price" | "stock" | "createdAt" | "displayOrder";
  direction: "asc" | "desc";
};

/**
 * Get products for a tenant with pagination, filtering, and sorting
 */
export async function getProducts(
  tenantId: string,
  options: {
    page?: number;
    limit?: number;
    filters?: ProductFilters;
    sort?: ProductSort;
  } = {}
) {
  const { page = 1, limit = 10, filters = {}, sort } = options;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(products.tenantId, tenantId)];

  if (filters.search) {
    conditions.push(
      or(
        ilike(products.name, `%${filters.search}%`),
        ilike(products.slug, `%${filters.search}%`)
      )!
    );
  }

  if (filters.categoryId) {
    // Filter by category using the productCategories junction table
    const productsInCategory = db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .where(eq(productCategories.categoryId, filters.categoryId));

    conditions.push(inArray(products.id, productsInCategory));
  }

  if (filters.isActive !== undefined) {
    // isActive maps to status: 'active' (true) or 'draft'/'archived' (false)
    if (filters.isActive) {
      conditions.push(eq(products.status, "active"));
    } else {
      conditions.push(sql`${products.status} != 'active'`);
    }
  }

  if (filters.stockStatus) {
    switch (filters.stockStatus) {
      case "out_of_stock":
        conditions.push(eq(products.stock, 0));
        break;
      case "low_stock":
        conditions.push(
          and(
            sql`${products.stock} > 0`,
            sql`${products.stock} <= ${products.lowStockThreshold}`
          )!
        );
        break;
      case "in_stock":
        conditions.push(sql`${products.stock} > ${products.lowStockThreshold}`);
        break;
    }
  }

  // Channel visibility filters
  if (filters.showOnStorefront !== undefined) {
    conditions.push(eq(products.showOnStorefront, filters.showOnStorefront));
  }

  if (filters.showOnPos !== undefined) {
    conditions.push(eq(products.showOnPos, filters.showOnPos));
  }

  // Build order by (with secondary sort by createdAt for stability)
  let orderByColumns;
  if (sort) {
    const column =
      sort.field === "name"
        ? products.name
        : sort.field === "price"
          ? products.price
          : sort.field === "stock"
            ? products.stock
            : sort.field === "displayOrder"
              ? products.displayOrder
              : products.createdAt;

    const primarySort = sort.direction === "asc" ? asc(column) : desc(column);
    // Add secondary sort by createdAt desc for stability when primary values are equal
    orderByColumns = [primarySort, desc(products.createdAt)];
  } else {
    // Default sort by displayOrder (for drag-and-drop reordering)
    // Secondary sort by createdAt desc ensures newest products appear first when displayOrder is equal
    orderByColumns = [asc(products.displayOrder), desc(products.createdAt)];
  }

  // Get products with category and first image
  const productsList = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
      stock: products.stock,
      hasVariants: products.hasVariants,
      trackInventory: products.trackInventory,
      allowBackorder: products.allowBackorder,
      lowStockThreshold: products.lowStockThreshold,
      showStock: products.showStock,
      weight: products.weight,
      displayOrder: products.displayOrder,
      status: products.status,
      categoryId: products.categoryId,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(...orderByColumns)
    .limit(limit)
    .offset(offset);

  const productIds = productsList.map((p) => p.id);

  // Get images for products, ordered by position to pick the first one as primary
  const allImages =
    productIds.length > 0
      ? await db
          .select({
            productId: productImages.productId,
            url: media.url,
            altText: media.altText,
          })
          .from(productImages)
          .innerJoin(media, eq(productImages.mediaId, media.id))
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.position))
      : [];

  // Map first image to each product
  const imageMap = new Map<string, { url: string; altText: string | null }>();
  allImages.forEach((img) => {
    if (!imageMap.has(img.productId)) {
      imageMap.set(img.productId, img);
    }
  });

  // Get all categories for each product from junction table
  const productCategoriesData =
    productIds.length > 0
      ? await db
          .select({
            productId: sql<string>`${productCategories.productId}`.as(
              "productId"
            ),
            categoryId: categories.id,
            categoryName: categories.name,
            categorySlug: categories.slug,
          })
          .from(productCategories)
          .innerJoin(
            categories,
            eq(productCategories.categoryId, categories.id)
          )
          .where(inArray(productCategories.productId, productIds))
      : [];

  // Get variant stock sums for products with variants (only active variants)
  const variantStockSums =
    productIds.length > 0
      ? await db
          .select({
            productId: sql<string>`${productVariants.productId}`.as(
              "productId"
            ),
            totalStock:
              sql<number>`COALESCE(SUM(${productVariants.stock}), 0)`.as(
                "totalStock"
              ),
          })
          .from(productVariants)
          .where(
            and(
              inArray(productVariants.productId, productIds),
              eq(productVariants.isActive, true)
            )
          )
          .groupBy(productVariants.productId)
      : [];

  // Get min/max variant prices for products with variants
  // Uses subquery to get product base price for COALESCE when variant price is null
  const variantPriceRanges =
    productIds.length > 0
      ? await db
          .select({
            productId: sql<string>`${productVariants.productId}`.as(
              "productId"
            ),
            minPrice:
              sql<string>`MIN(COALESCE(${productVariants.price}, (SELECT price FROM products WHERE id = ${productVariants.productId})))`.as(
                "minPrice"
              ),
            maxPrice:
              sql<string>`MAX(COALESCE(${productVariants.price}, (SELECT price FROM products WHERE id = ${productVariants.productId})))`.as(
                "maxPrice"
              ),
          })
          .from(productVariants)
          .where(
            and(
              inArray(productVariants.productId, productIds),
              eq(productVariants.isActive, true)
            )
          )
          .groupBy(productVariants.productId)
      : [];

  // Get review stats (average rating and count) for each product
  const reviewStats =
    productIds.length > 0
      ? await db
          .select({
            productId: reviews.productId,
            averageRating: avg(reviews.rating),
            reviewCount: count(),
          })
          .from(reviews)
          .where(inArray(reviews.productId, productIds))
          .groupBy(reviews.productId)
      : [];

  // Get lowest bulk price tier for each product (for "As low as $X" display)
  const bulkPriceTiers =
    productIds.length > 0
      ? await db
          .select({
            productId: priceTiers.productId,
            lowestPrice: min(priceTiers.price).as("lowestPrice"),
          })
          .from(priceTiers)
          .where(inArray(priceTiers.productId, productIds))
          .groupBy(priceTiers.productId)
      : [];

  // Map categories, variant stocks, price ranges, and review stats to products
  const variantStockMap = new Map(
    variantStockSums.map((vs) => [vs.productId, vs.totalStock])
  );
  const variantPriceMap = new Map(
    variantPriceRanges.map((vp) => [
      vp.productId,
      { minPrice: vp.minPrice, maxPrice: vp.maxPrice },
    ])
  );
  const reviewStatsMap = new Map(
    reviewStats.map((rs) => [
      rs.productId,
      {
        rating: rs.averageRating ? parseFloat(rs.averageRating) : null,
        reviewCount: rs.reviewCount,
      },
    ])
  );
  const bulkPriceMap = new Map(
    bulkPriceTiers.map((bp) => [bp.productId, bp.lowestPrice])
  );

  // Group categories by product
  const categoriesMap = new Map<
    string,
    Array<{ id: string; name: string; slug: string }>
  >();
  productCategoriesData.forEach((pc) => {
    if (!categoriesMap.has(pc.productId)) {
      categoriesMap.set(pc.productId, []);
    }
    categoriesMap.get(pc.productId)!.push({
      id: pc.categoryId,
      name: pc.categoryName,
      slug: pc.categorySlug,
    });
  });

  const productsWithImages = productsList.map((product) => {
    const productCategories = categoriesMap.get(product.id) || [];
    const variantTotalStock = variantStockMap.get(product.id) || 0;
    const variantPrices = variantPriceMap.get(product.id);
    const productReviewStats = reviewStatsMap.get(product.id);

    // Use variant stock sum if product has variants, otherwise use product.stock
    const effectiveStock = product.hasVariants
      ? variantTotalStock
      : product.stock;

    return {
      ...product,
      image: imageMap.get(product.id) || null,
      categories: productCategories,
      // Keep the first category for backwards compatibility
      categoryName: productCategories[0]?.name || product.categoryName,
      categorySlug: productCategories[0]?.slug || product.categorySlug,
      // Override stock with variant sum if applicable
      stock: effectiveStock,
      // Variant price range (for "From $X" display logic)
      minVariantPrice: variantPrices?.minPrice ?? undefined,
      maxVariantPrice: variantPrices?.maxPrice ?? undefined,
      // Review stats
      rating: productReviewStats?.rating ?? undefined,
      reviewCount: productReviewStats?.reviewCount ?? undefined,
      // Bulk pricing (lowest tier price for "As low as $X" display)
      lowestBulkPrice: bulkPriceMap.get(product.id) ?? undefined,
    };
  });

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(and(...conditions));

  return {
    products: productsWithImages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single product by ID with all related data
 */
export async function getProductById(tenantId: string, productId: string) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
    with: {
      category: true,
      productCategories: {
        columns: {
          categoryId: true,
        },
      },
      images: {
        with: {
          media: true,
        },
        orderBy: (pi, { asc }) => [asc(pi.position)],
      },
      variants: {
        with: {
          options: {
            with: {
              optionValue: {
                with: {
                  option: true,
                },
              },
            },
          },
          image: true,
          images: {
            with: {
              media: true,
            },
            orderBy: (vi, { asc }) => [asc(vi.position)],
          },
        },
        orderBy: (v, { asc }) => [asc(v.displayOrder)],
      },
      // Option value to image mappings for gallery filtering
      optionValueImages: {
        with: {
          optionValue: {
            with: {
              option: true,
            },
          },
        },
        orderBy: (ovi, { asc }) => [asc(ovi.position)],
      },
    },
  });

  return product;
}

/**
 * Get product by slug
 */
export async function getProductBySlug(tenantId: string, slug: string) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.slug, slug)),
  });

  return product;
}

/**
 * Get product by slug with all details (for product detail page)
 */
export async function getProductBySlugWithDetails(
  tenantId: string,
  slug: string
) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.slug, slug)),
    with: {
      category: true,
      images: {
        with: {
          media: true,
        },
        orderBy: (pi, { asc }) => [asc(pi.position)],
      },
      variants: {
        with: {
          options: {
            with: {
              optionValue: {
                with: {
                  option: true,
                },
              },
            },
          },
          image: true,
          images: {
            with: {
              media: true,
            },
            orderBy: (vi, { asc }) => [asc(vi.position)],
          },
        },
        orderBy: (v, { asc }) => [asc(v.displayOrder)],
      },
      // Option value to image mappings (for filtering gallery by selected options)
      optionValueImages: {
        with: {
          optionValue: {
            with: {
              option: true,
            },
          },
          media: true,
        },
        orderBy: (ovi, { asc }) => [asc(ovi.position)],
      },
    },
  });

  return product;
}

export type ProductWithDetails = NonNullable<
  Awaited<ReturnType<typeof getProductBySlugWithDetails>>
>;

/**
 * Check if a product slug is available within a tenant
 */
export async function checkProductSlugAvailable(
  tenantId: string,
  slug: string,
  excludeProductId?: string
): Promise<boolean> {
  const conditions = [eq(products.tenantId, tenantId), eq(products.slug, slug)];

  if (excludeProductId) {
    conditions.push(sql`${products.id} != ${excludeProductId}`);
  }

  const existing = await db.query.products.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !existing;
}

/**
 * Get categories for a tenant (for product form dropdown)
 */
export async function getTenantCategories(tenantId: string) {
  const categoriesList = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenantId),
    orderBy: [asc(categories.displayOrder), asc(categories.name)],
  });

  return categoriesList;
}

/**
 * Get product counts by status for dashboard
 */
export async function getProductCounts(tenantId: string) {
  const [totalResult] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.tenantId, tenantId));

  const [activeResult] = await db
    .select({ count: count() })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.status, "active")));

  const [draftResult] = await db
    .select({ count: count() })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.status, "draft")));

  const [lowStockResult] = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.trackInventory, true),
        sql`${products.stock} > 0`,
        sql`${products.stock} <= ${products.lowStockThreshold}`
      )
    );

  const [outOfStockResult] = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.trackInventory, true),
        eq(products.stock, 0)
      )
    );

  return {
    total: totalResult.count,
    active: activeResult.count,
    draft: draftResult.count,
    lowStock: lowStockResult.count,
    outOfStock: outOfStockResult.count,
  };
}

/**
 * Get the maximum display order for products in a tenant
 */
export async function getMaxProductDisplayOrder(
  tenantId: string
): Promise<number> {
  const result = await db
    .select({
      maxOrder: sql<number>`COALESCE(MAX(${products.displayOrder}), -1)`,
    })
    .from(products)
    .where(eq(products.tenantId, tenantId));

  return result[0]?.maxOrder ?? -1;
}

/**
 * Resolves image swatch URLs for a product's variant options.
 * Image swatches store media IDs in swatchValue - this function fetches
 * the actual URLs from the media table.
 *
 * Returns a map of media ID -> URL for all image swatches in the product.
 */
export async function getProductImageSwatchUrls(
  product: ProductWithDetails
): Promise<Map<string, string>> {
  if (!product.variants || product.variants.length === 0) {
    return new Map();
  }

  // Collect all media IDs from image swatches
  const mediaIds = new Set<string>();
  for (const variant of product.variants) {
    if (!variant.options) continue;
    for (const opt of variant.options) {
      if (
        opt.optionValue?.swatchType === "image" &&
        opt.optionValue?.swatchValue
      ) {
        mediaIds.add(opt.optionValue.swatchValue);
      }
    }
  }

  if (mediaIds.size === 0) {
    return new Map();
  }

  // Fetch media URLs in a single query
  const mediaRecords = await db.query.media.findMany({
    where: inArray(media.id, Array.from(mediaIds)),
    columns: { id: true, url: true },
  });

  return new Map(mediaRecords.map((m) => [m.id, m.url]));
}
