"use server";

import { db } from "@/lib/db";
import {
  products,
  productVariants,
  inventoryMovements,
  categories,
  profiles,
} from "@/lib/db/schema";
import { eq, and, sql, desc, lte, gte } from "drizzle-orm";

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
  createdAt: Date;
};

/**
 * Get stock summary for a tenant
 */
export async function getStockSummary(tenantId: string): Promise<StockSummary> {
  // Get simple products stats (not variant products)
  const simpleProductsResult = await db
    .select({
      totalProducts: sql<number>`COUNT(*)::int`,
      totalTrackedProducts: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true)::int`,
      inStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} > ${products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} > 0 AND ${products.stock} <= ${products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${products.trackInventory} = true AND ${products.stock} = 0)::int`,
      totalStockValue: sql<number>`COALESCE(SUM(CASE WHEN ${products.trackInventory} = true AND ${products.hasVariants} = false THEN ${products.stock} * ${products.price}::numeric ELSE 0 END), 0)::numeric`,
      totalStockUnits: sql<number>`COALESCE(SUM(CASE WHEN ${products.trackInventory} = true AND ${products.hasVariants} = false THEN ${products.stock} ELSE 0 END), 0)::int`,
    })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.hasVariants, false)));

  // Get variant products stock value
  const variantStockResult = await db
    .select({
      totalStockValue: sql<number>`COALESCE(SUM(${productVariants.stock} * COALESCE(${productVariants.price}, ${products.price})::numeric), 0)::numeric`,
      totalStockUnits: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(products.trackInventory, true)
      )
    );

  const simpleStats = simpleProductsResult[0];
  const variantStats = variantStockResult[0];

  return {
    totalProducts: simpleStats?.totalProducts ?? 0,
    totalTrackedProducts: simpleStats?.totalTrackedProducts ?? 0,
    inStockCount: simpleStats?.inStockCount ?? 0,
    lowStockCount: simpleStats?.lowStockCount ?? 0,
    outOfStockCount: simpleStats?.outOfStockCount ?? 0,
    totalStockValue:
      (simpleStats?.totalStockValue ?? 0) + (variantStats?.totalStockValue ?? 0),
    totalStockUnits:
      (simpleStats?.totalStockUnits ?? 0) + (variantStats?.totalStockUnits ?? 0),
  };
}

/**
 * Get products at or below low stock threshold
 */
export async function getLowStockProducts(
  tenantId: string,
  options?: { limit?: number }
): Promise<LowStockProduct[]> {
  const limit = options?.limit ?? 20;

  const lowStockItems = await db
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
    )
    .orderBy(products.stock)
    .limit(limit);

  return lowStockItems;
}

/**
 * Get stock breakdown by category
 */
export async function getStockByCategory(
  tenantId: string
): Promise<StockByCategory[]> {
  const result = await db
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
    .groupBy(products.categoryId, categories.name)
    .orderBy(categories.name);

  return result;
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
    conditions.push(
      sql`${inventoryMovements.type} = ${options.type}`
    );
  }

  if (options?.startDate) {
    conditions.push(gte(inventoryMovements.createdAt, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(inventoryMovements.createdAt, options.endDate));
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
      userName: profiles.fullName,
      reason: inventoryMovements.reason,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(
      productVariants,
      eq(productVariants.id, inventoryMovements.variantId)
    )
    .leftJoin(profiles, eq(profiles.id, inventoryMovements.userId))
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
    .where(and(eq(products.tenantId, tenantId), eq(products.trackInventory, true)))
    .orderBy(products.name);

  return productsList;
}
