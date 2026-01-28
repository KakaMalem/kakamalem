"use server";

import { db } from "@/lib/db";
import {
  products,
  productVariants,
  inventoryMovements,
  categories,
  user,
} from "@/lib/db/schema";
import { eq, and, sql, desc, lte, gte, inArray } from "drizzle-orm";

export type StockSummary = {
  totalProducts: number;
  totalTrackedProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
  totalStockUnits: number;
};

export type LowStockProduct = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  categoryName: string | null;
  stock: number;
  lowStockThreshold: number;
  price: string;
  hasVariants: boolean;
  // Variant-specific fields (null for simple products)
  variantId: string | null;
  variantName: string | null;
  sku: string | null;
};

export type StockByCategory = {
  categoryId: string | null;
  categoryName: string | null;
  productCount: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStock: number;
};

export type InventoryMovementWithDetails = {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  variantDisplayName: string | null;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  orderId: string | null;
  userId: string | null;
  userName: string | null;
  reason: string | null;
  createdAt: string;
};

/**
 * Get stock summary for a tenant (includes both simple products and variants)
 */
export async function getStockSummary(tenantId: string): Promise<StockSummary> {
  // Get ALL products count (including those with variants)
  const allProductsResult = await db
    .select({
      totalProducts: sql<number>`COUNT(*)::int`,
      totalTrackedProducts: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true)::int`,
    })
    .from(products)
    .where(eq(products.tenantId, tenantId));

  // Get simple products stats (stock counts only for simple products)
  const simpleProductsResult = await db
    .select({
      inStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} > ${products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} > 0 AND ${products.stock} <= ${products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} = 0)::int`,
      totalStockValue: sql<number>`COALESCE(ROUND(SUM(${products.stock} * ${products.price}::numeric), 2), 0)::numeric`,
      totalStockUnits: sql<number>`COALESCE(SUM(${products.stock}), 0)::int`,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.hasVariants, false),
        eq(products.trackInventory, true)
      )
    );

  // Get variant stock stats (including stock status counts)
  const variantStockResult = await db
    .select({
      inStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} > ${products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} > 0 AND ${productVariants.stock} <= ${products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} = 0)::int`,
      totalStockValue: sql<number>`COALESCE(ROUND(SUM(
        CASE WHEN ${productVariants.isActive} = true
        THEN ${productVariants.stock} * COALESCE(${productVariants.price}, ${products.price})::numeric
        ELSE 0 END
      ), 2), 0)::numeric`,
      totalStockUnits: sql<number>`COALESCE(SUM(
        CASE WHEN ${productVariants.isActive} = true THEN ${productVariants.stock} ELSE 0 END
      ), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(products.trackInventory, true)
      )
    );

  const allStats = allProductsResult[0];
  const simpleStats = simpleProductsResult[0];
  const variantStats = variantStockResult[0];

  const totalStockValue =
    Number(simpleStats?.totalStockValue ?? 0) +
    Number(variantStats?.totalStockValue ?? 0);

  return {
    totalProducts: allStats?.totalProducts ?? 0,
    totalTrackedProducts: allStats?.totalTrackedProducts ?? 0,
    // Combine simple product and variant counts
    inStockCount:
      (simpleStats?.inStockCount ?? 0) + (variantStats?.inStockCount ?? 0),
    lowStockCount:
      (simpleStats?.lowStockCount ?? 0) + (variantStats?.lowStockCount ?? 0),
    outOfStockCount:
      (simpleStats?.outOfStockCount ?? 0) +
      (variantStats?.outOfStockCount ?? 0),
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    totalStockUnits:
      (simpleStats?.totalStockUnits ?? 0) +
      (variantStats?.totalStockUnits ?? 0),
  };
}

/**
 * Get products and variants at or below low stock threshold
 */
export async function getLowStockProducts(
  tenantId: string,
  options?: { limit?: number }
): Promise<LowStockProduct[]> {
  const limit = options?.limit ?? 20;

  // Get low stock simple products
  const lowStockSimpleProducts = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      categoryId: products.categoryId,
      categoryName: categories.name,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
      price: products.price,
      hasVariants: products.hasVariants,
      variantId: sql<string | null>`NULL`,
      variantName: sql<string | null>`NULL`,
      sku: products.sku,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.trackInventory, true),
        eq(products.hasVariants, false),
        lte(products.stock, products.lowStockThreshold)
      )
    );

  // Get low stock variants
  const lowStockVariants = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      categoryId: products.categoryId,
      categoryName: categories.name,
      stock: productVariants.stock,
      lowStockThreshold: products.lowStockThreshold,
      price: sql<string>`COALESCE(${productVariants.price}, ${products.price})`,
      hasVariants: sql<boolean>`true`,
      variantId: productVariants.id,
      variantName: productVariants.displayName,
      sku: productVariants.sku,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(products.trackInventory, true),
        eq(productVariants.isActive, true),
        lte(productVariants.stock, products.lowStockThreshold)
      )
    );

  // Combine and sort by stock (lowest first), then limit
  const allLowStock: LowStockProduct[] = [
    ...lowStockSimpleProducts.map((p) => ({
      ...p,
      variantId: null,
      variantName: null,
    })),
    ...lowStockVariants.map((v) => ({
      ...v,
      hasVariants: true as const,
    })),
  ]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit);

  return allLowStock;
}

/**
 * Get stock breakdown by category (includes both simple products and variants)
 */
export async function getStockByCategory(
  tenantId: string
): Promise<StockByCategory[]> {
  // Get simple products by category
  const simpleProductsResult = await db
    .select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      productCount: sql<number>`COUNT(*)::int`,
      inStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.stock} > ${products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.stock} > 0 AND ${products.stock} <= ${products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.stock} = 0)::int`,
      totalStock: sql<number>`COALESCE(SUM(${products.stock}), 0)::int`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.trackInventory, true),
        eq(products.hasVariants, false)
      )
    )
    .groupBy(products.categoryId, categories.name);

  // Get variant stats by category
  const variantResult = await db
    .select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      variantCount: sql<number>`COUNT(*)::int`,
      inStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} > ${products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} > 0 AND ${productVariants.stock} <= ${products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${productVariants.isActive} = true AND ${productVariants.stock} = 0)::int`,
      totalStock: sql<number>`COALESCE(SUM(CASE WHEN ${productVariants.isActive} = true THEN ${productVariants.stock} ELSE 0 END), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(products.trackInventory, true)
      )
    )
    .groupBy(products.categoryId, categories.name);

  // Merge results by category
  const categoryMap = new Map<string | null, StockByCategory>();

  // Add simple products
  for (const row of simpleProductsResult) {
    categoryMap.set(row.categoryId, {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      productCount: row.productCount,
      inStockCount: row.inStockCount,
      lowStockCount: row.lowStockCount,
      outOfStockCount: row.outOfStockCount,
      totalStock: row.totalStock,
    });
  }

  // Merge variant stats
  for (const row of variantResult) {
    const existing = categoryMap.get(row.categoryId);
    if (existing) {
      existing.productCount += row.variantCount;
      existing.inStockCount += row.inStockCount;
      existing.lowStockCount += row.lowStockCount;
      existing.outOfStockCount += row.outOfStockCount;
      existing.totalStock += row.totalStock;
    } else {
      categoryMap.set(row.categoryId, {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        productCount: row.variantCount,
        inStockCount: row.inStockCount,
        lowStockCount: row.lowStockCount,
        outOfStockCount: row.outOfStockCount,
        totalStock: row.totalStock,
      });
    }
  }

  // Convert to array and sort by category name
  return Array.from(categoryMap.values()).sort((a, b) => {
    if (a.categoryName === null) return 1;
    if (b.categoryName === null) return -1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

/**
 * Get inventory movements with product and user details
 */
export async function getInventoryMovements(
  tenantId: string,
  options?: {
    productId?: string;
    variantId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }
): Promise<{
  movements: InventoryMovementWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [eq(inventoryMovements.tenantId, tenantId)];

  if (options?.productId) {
    conditions.push(eq(inventoryMovements.productId, options.productId));
  }

  if (options?.variantId) {
    conditions.push(eq(inventoryMovements.variantId, options.variantId));
  }

  if (options?.type) {
    conditions.push(sql`${inventoryMovements.type} = ${options.type}`);
  }

  if (options?.startDate) {
    conditions.push(
      gte(inventoryMovements.createdAt, options.startDate.toISOString())
    );
  }

  if (options?.endDate) {
    conditions.push(
      lte(inventoryMovements.createdAt, options.endDate.toISOString())
    );
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(inventoryMovements)
    .where(and(...conditions));

  const total = countResult[0]?.count ?? 0;

  // Get movements with details
  const movements = await db
    .select({
      id: inventoryMovements.id,
      tenantId: inventoryMovements.tenantId,
      productId: inventoryMovements.productId,
      productName: products.name,
      productSlug: products.slug,
      variantId: inventoryMovements.variantId,
      variantDisplayName: productVariants.displayName,
      type: inventoryMovements.type,
      quantity: inventoryMovements.quantity,
      previousStock: inventoryMovements.previousStock,
      newStock: inventoryMovements.newStock,
      orderId: inventoryMovements.orderId,
      userId: inventoryMovements.userId,
      userName: user.name,
      reason: inventoryMovements.reason,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(
      productVariants,
      eq(productVariants.id, inventoryMovements.variantId)
    )
    .leftJoin(user, eq(user.id, inventoryMovements.userId))
    .where(and(...conditions))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get product stock details for adjustment
 */
export async function getProductForAdjustment(
  tenantId: string,
  productId: string
) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
    columns: {
      id: true,
      name: true,
      slug: true,
      stock: true,
      trackInventory: true,
      hasVariants: true,
      lowStockThreshold: true,
    },
    with: {
      variants: {
        columns: {
          id: true,
          displayName: true,
          sku: true,
          stock: true,
          stockStatus: true,
        },
        where: eq(productVariants.isActive, true),
      },
    },
  });

  return product;
}

/**
 * Get all products for stock adjustment dropdown
 */
export async function getProductsForAdjustment(tenantId: string) {
  const productsList = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      stock: products.stock,
      hasVariants: products.hasVariants,
      trackInventory: products.trackInventory,
    })
    .from(products)
    .where(
      and(eq(products.tenantId, tenantId), eq(products.trackInventory, true))
    )
    .orderBy(products.name);

  return productsList;
}

// ============================================================
// ENTERPRISE INVENTORY FEATURES
// ============================================================

export type InventoryProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  stock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  price: string;
  costPrice: string | null;
  stockValue: number;
  hasVariants: boolean;
  variantCount: number;
  lastMovementDate: string | null;
  trackInventory: boolean;
  allowBackorder: boolean;
};

export type InventoryFilters = {
  search?: string;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "all";
  categoryId?: string;
  hasVariants?: boolean;
  sortBy?: "name" | "stock" | "value" | "lastMovement" | "sku";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

/**
 * Get paginated inventory products with advanced filtering
 */
export async function getInventoryProducts(
  tenantId: string,
  filters: InventoryFilters = {}
): Promise<{
  products: InventoryProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalProducts: number;
    totalValue: number;
    totalUnits: number;
  };
}> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [
    eq(products.tenantId, tenantId),
    eq(products.trackInventory, true),
  ];

  // Search filter
  if (filters.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${products.name}) LIKE ${searchTerm} OR
        LOWER(${products.sku}) LIKE ${searchTerm} OR
        LOWER(${products.barcode}) LIKE ${searchTerm}
      )`
    );
  }

  // Category filter
  if (filters.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }

  // Has variants filter
  if (filters.hasVariants !== undefined) {
    conditions.push(eq(products.hasVariants, filters.hasVariants));
  }

  // Stock status filter (only for simple products)
  if (filters.status && filters.status !== "all") {
    if (filters.status === "out_of_stock") {
      conditions.push(sql`${products.stock} = 0`);
    } else if (filters.status === "low_stock") {
      conditions.push(
        sql`${products.stock} > 0 AND ${products.stock} <= ${products.lowStockThreshold}`
      );
    } else if (filters.status === "in_stock") {
      conditions.push(sql`${products.stock} > ${products.lowStockThreshold}`);
    }
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(products)
    .where(and(...conditions));

  const total = countResult[0]?.count ?? 0;

  // Build order by clause
  let orderByClause;
  switch (filters.sortBy) {
    case "stock":
      orderByClause =
        filters.sortOrder === "asc" ? products.stock : desc(products.stock);
      break;
    case "value":
      orderByClause =
        filters.sortOrder === "asc"
          ? sql`${products.stock} * ${products.price}::numeric`
          : desc(sql`${products.stock} * ${products.price}::numeric`);
      break;
    case "sku":
      orderByClause =
        filters.sortOrder === "asc" ? products.sku : desc(products.sku);
      break;
    case "name":
    default:
      orderByClause =
        filters.sortOrder === "asc" ? products.name : desc(products.name);
      break;
  }

  // Get products with category info
  const productsResult = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
      price: products.price,
      costPrice: products.costPrice,
      hasVariants: products.hasVariants,
      trackInventory: products.trackInventory,
      allowBackorder: products.allowBackorder,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  // Get variant counts for products with variants
  const productIds = productsResult.map((p) => p.id);
  const variantCounts =
    productIds.length > 0
      ? await db
          .select({
            productId: productVariants.productId,
            count: sql<number>`COUNT(*)::int`,
            totalStock: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)::int`,
            reservedStock: sql<number>`COALESCE(SUM(${productVariants.reservedStock}), 0)::int`,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, productIds))
          .groupBy(productVariants.productId)
      : [];

  const variantCountMap = new Map(
    variantCounts.map((vc) => [
      vc.productId,
      {
        count: vc.count,
        totalStock: vc.totalStock,
        reservedStock: vc.reservedStock,
      },
    ])
  );

  // Get last movement dates
  const lastMovements =
    productIds.length > 0
      ? await db
          .select({
            productId: inventoryMovements.productId,
            lastDate: sql<string>`MAX(${inventoryMovements.createdAt})`,
          })
          .from(inventoryMovements)
          .where(inArray(inventoryMovements.productId, productIds))
          .groupBy(inventoryMovements.productId)
      : [];

  const lastMovementMap = new Map(
    lastMovements.map((lm) => [lm.productId, lm.lastDate])
  );

  // Transform results
  const inventoryProducts: InventoryProduct[] = productsResult.map((p) => {
    const variantInfo = variantCountMap.get(p.id);
    const stock = p.hasVariants ? (variantInfo?.totalStock ?? 0) : p.stock;
    const reservedStock = p.hasVariants ? (variantInfo?.reservedStock ?? 0) : 0;
    const availableStock = stock - reservedStock;
    const priceNum = parseFloat(p.price) || 0;
    const stockValue = stock * priceNum;

    let stockStatus: "in_stock" | "low_stock" | "out_of_stock";
    if (stock === 0) {
      stockStatus = "out_of_stock";
    } else if (stock <= p.lowStockThreshold) {
      stockStatus = "low_stock";
    } else {
      stockStatus = "in_stock";
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      stock,
      reservedStock,
      availableStock,
      lowStockThreshold: p.lowStockThreshold,
      stockStatus,
      price: p.price,
      costPrice: p.costPrice,
      stockValue,
      hasVariants: p.hasVariants,
      variantCount: variantInfo?.count ?? 0,
      lastMovementDate: lastMovementMap.get(p.id) ?? null,
      trackInventory: p.trackInventory,
      allowBackorder: p.allowBackorder,
    };
  });

  // Calculate summary
  const summaryResult = await db
    .select({
      totalProducts: sql<number>`COUNT(*)::int`,
      totalValue: sql<number>`COALESCE(SUM(
        CASE WHEN ${products.hasVariants} = false
        THEN ${products.stock} * ${products.price}::numeric
        ELSE 0 END
      ), 0)::numeric`,
      totalUnits: sql<number>`COALESCE(SUM(
        CASE WHEN ${products.hasVariants} = false
        THEN ${products.stock}
        ELSE 0 END
      ), 0)::int`,
    })
    .from(products)
    .where(and(...conditions));

  // Add variant stock to summary
  const variantSummary = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(
        ${productVariants.stock} * COALESCE(${productVariants.price}, ${products.price})::numeric
      ), 0)::numeric`,
      totalUnits: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(products.tenantId, tenantId), eq(products.trackInventory, true))
    );

  const summary = {
    totalProducts: summaryResult[0]?.totalProducts ?? 0,
    totalValue:
      (summaryResult[0]?.totalValue ?? 0) +
      (variantSummary[0]?.totalValue ?? 0),
    totalUnits:
      (summaryResult[0]?.totalUnits ?? 0) +
      (variantSummary[0]?.totalUnits ?? 0),
  };

  return {
    products: inventoryProducts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary,
  };
}

export type StockMovementTrend = {
  date: string;
  additions: number;
  reductions: number;
  netChange: number;
};

/**
 * Get stock movement trends over time
 */
export async function getStockMovementTrends(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    productId?: string;
    groupBy?: "day" | "week" | "month";
  } = {}
): Promise<StockMovementTrend[]> {
  const { startDate, endDate, productId, groupBy = "day" } = options;

  const conditions = [eq(inventoryMovements.tenantId, tenantId)];

  if (productId) {
    conditions.push(eq(inventoryMovements.productId, productId));
  }

  if (startDate) {
    conditions.push(gte(inventoryMovements.createdAt, startDate.toISOString()));
  }

  if (endDate) {
    conditions.push(lte(inventoryMovements.createdAt, endDate.toISOString()));
  }

  let dateFormat: string;
  switch (groupBy) {
    case "week":
      dateFormat = "YYYY-IW";
      break;
    case "month":
      dateFormat = "YYYY-MM";
      break;
    case "day":
    default:
      dateFormat = "YYYY-MM-DD";
      break;
  }

  // Use sql.raw() for the date format to avoid parameterization
  const dateFormatSql = sql.raw(`'${dateFormat}'`);

  const result = await db
    .select({
      date: sql<string>`TO_CHAR(${inventoryMovements.createdAt}::date, ${dateFormatSql})`,
      additions: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.quantity} > 0 THEN ${inventoryMovements.quantity} ELSE 0 END), 0)::int`,
      reductions: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${inventoryMovements.quantity} < 0 THEN ${inventoryMovements.quantity} ELSE 0 END)), 0)::int`,
      netChange: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)::int`,
    })
    .from(inventoryMovements)
    .where(and(...conditions))
    .groupBy(
      sql`TO_CHAR(${inventoryMovements.createdAt}::date, ${dateFormatSql})`
    )
    .orderBy(
      sql`TO_CHAR(${inventoryMovements.createdAt}::date, ${dateFormatSql})`
    );

  return result;
}

export type MovementsByType = {
  type: string;
  count: number;
  totalQuantity: number;
};

/**
 * Get movement statistics by type
 */
export async function getMovementsByType(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<MovementsByType[]> {
  const conditions = [eq(inventoryMovements.tenantId, tenantId)];

  if (options.startDate) {
    conditions.push(
      gte(inventoryMovements.createdAt, options.startDate.toISOString())
    );
  }

  if (options.endDate) {
    conditions.push(
      lte(inventoryMovements.createdAt, options.endDate.toISOString())
    );
  }

  const result = await db
    .select({
      type: inventoryMovements.type,
      count: sql<number>`COUNT(*)::int`,
      totalQuantity: sql<number>`COALESCE(SUM(ABS(${inventoryMovements.quantity})), 0)::int`,
    })
    .from(inventoryMovements)
    .where(and(...conditions))
    .groupBy(inventoryMovements.type);

  return result;
}

export type TopMovingProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  categoryName: string | null;
  totalMovements: number;
  totalQuantity: number;
  additions: number;
  reductions: number;
};

/**
 * Get top moving products by activity
 */
export async function getTopMovingProducts(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    type?: "all" | "additions" | "reductions";
  } = {}
): Promise<TopMovingProduct[]> {
  const { startDate, endDate, limit = 10, type = "all" } = options;

  const conditions = [eq(inventoryMovements.tenantId, tenantId)];

  if (startDate) {
    conditions.push(gte(inventoryMovements.createdAt, startDate.toISOString()));
  }

  if (endDate) {
    conditions.push(lte(inventoryMovements.createdAt, endDate.toISOString()));
  }

  if (type === "additions") {
    conditions.push(sql`${inventoryMovements.quantity} > 0`);
  } else if (type === "reductions") {
    conditions.push(sql`${inventoryMovements.quantity} < 0`);
  }

  const result = await db
    .select({
      productId: inventoryMovements.productId,
      productName: products.name,
      productSlug: products.slug,
      categoryName: categories.name,
      totalMovements: sql<number>`COUNT(*)::int`,
      totalQuantity: sql<number>`COALESCE(SUM(ABS(${inventoryMovements.quantity})), 0)::int`,
      additions: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryMovements.quantity} > 0 THEN ${inventoryMovements.quantity} ELSE 0 END), 0)::int`,
      reductions: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${inventoryMovements.quantity} < 0 THEN ${inventoryMovements.quantity} ELSE 0 END)), 0)::int`,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .groupBy(
      inventoryMovements.productId,
      products.name,
      products.slug,
      categories.name
    )
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  return result;
}

/**
 * Get products for bulk adjustment (with current stock info)
 */
export async function getProductsForBulkAdjustment(
  tenantId: string,
  productIds: string[]
): Promise<
  Array<{
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    hasVariants: boolean;
    variants: Array<{
      id: string;
      displayName: string | null;
      sku: string | null;
      stock: number;
    }>;
  }>
> {
  if (productIds.length === 0) return [];

  const productsList = await db.query.products.findMany({
    where: and(
      eq(products.tenantId, tenantId),
      inArray(products.id, productIds)
    ),
    columns: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      hasVariants: true,
    },
    with: {
      variants: {
        columns: {
          id: true,
          displayName: true,
          sku: true,
          stock: true,
        },
        where: eq(productVariants.isActive, true),
      },
    },
  });

  return productsList;
}
