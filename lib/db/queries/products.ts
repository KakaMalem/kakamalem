"use server";

import { db } from "@/lib/db";
import {
  products,
  categories,
  media,
  productImages,
} from "@/lib/db/schema";
import { eq, and, or, ilike, desc, asc, count, sql, inArray } from "drizzle-orm";

export type ProductWithCategory = Awaited<
  ReturnType<typeof getProducts>
>["products"][number];

export type ProductFilters = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
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
    conditions.push(eq(products.categoryId, filters.categoryId));
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(products.isActive, filters.isActive));
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

  // Build order by
  let orderBy;
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

    orderBy = sort.direction === "asc" ? asc(column) : desc(column);
  } else {
    orderBy = desc(products.createdAt);
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
      weight: products.weight,
      displayOrder: products.displayOrder,
      isActive: products.isActive,
      categoryId: products.categoryId,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get first image for each product
  const productIds = productsList.map((p) => p.id);
  const images =
    productIds.length > 0
      ? await db
          .select({
            productId: productImages.productId,
            url: media.url,
            altText: media.altText,
          })
          .from(productImages)
          .innerJoin(media, eq(productImages.mediaId, media.id))
          .where(
            and(
              inArray(productImages.productId, productIds),
              eq(productImages.position, 0)
            )
          )
      : [];

  // Map images to products
  const imageMap = new Map(images.map((img) => [img.productId, img]));
  const productsWithImages = productsList.map((product) => ({
    ...product,
    image: imageMap.get(product.id) || null,
  }));

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
        },
        orderBy: (v, { asc }) => [asc(v.displayOrder)],
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
 * Check if a product slug is available within a tenant
 */
export async function checkProductSlugAvailable(
  tenantId: string,
  slug: string,
  excludeProductId?: string
): Promise<boolean> {
  const conditions = [
    eq(products.tenantId, tenantId),
    eq(products.slug, slug),
  ];

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
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)));

  const [draftResult] = await db
    .select({ count: count() })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, false)));

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
