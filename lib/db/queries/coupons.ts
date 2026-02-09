"use server";

import { db } from "@/lib/db";
import { coupons, couponUsages, orders } from "@/lib/db/schema";
import { eq, and, desc, sql, isNull, or, gte, lte } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

export type CouponWithStats = Awaited<
  ReturnType<typeof getCouponsWithStats>
>[number];

export type CouponDetails = Awaited<ReturnType<typeof getCouponById>>;

export type CouponUsageRecord = Awaited<
  ReturnType<typeof getCouponUsageHistory>
>[number];

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all coupons for a tenant with usage stats
 */
export async function getCouponsWithStats(tenantId: string) {
  const results = await db.query.coupons.findMany({
    where: and(eq(coupons.tenantId, tenantId), isNull(coupons.deletedAt)),
    orderBy: [desc(coupons.createdAt)],
  });

  return results;
}

/**
 * Get a single coupon by ID with full details
 */
export async function getCouponById(tenantId: string, couponId: string) {
  return db.query.coupons.findFirst({
    where: and(
      eq(coupons.id, couponId),
      eq(coupons.tenantId, tenantId),
      isNull(coupons.deletedAt)
    ),
  });
}

/**
 * Get coupon by code (for validation)
 */
export async function getCouponByCode(tenantId: string, code: string) {
  return db.query.coupons.findFirst({
    where: and(
      eq(coupons.tenantId, tenantId),
      eq(coupons.code, code.toUpperCase()),
      isNull(coupons.deletedAt)
    ),
  });
}

/**
 * Get active coupons (currently valid)
 */
export async function getActiveCoupons(tenantId: string) {
  const now = new Date().toISOString();

  return db.query.coupons.findMany({
    where: and(
      eq(coupons.tenantId, tenantId),
      eq(coupons.isActive, true),
      isNull(coupons.deletedAt),
      lte(coupons.startsAt, now),
      or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now))
    ),
    orderBy: [desc(coupons.createdAt)],
  });
}

/**
 * Check if a store has any active coupons (for conditional promo code input display)
 */
export async function hasActiveCoupons(tenantId: string): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await db.query.coupons.findFirst({
    where: and(
      eq(coupons.tenantId, tenantId),
      eq(coupons.isActive, true),
      isNull(coupons.deletedAt),
      lte(coupons.startsAt, now),
      or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now))
    ),
    columns: { id: true },
  });

  return !!result;
}

/**
 * Get coupon usage history with order details
 */
export async function getCouponUsageHistory(
  tenantId: string,
  couponId: string,
  limit = 50
) {
  // First verify the coupon belongs to this tenant
  const coupon = await db.query.coupons.findFirst({
    where: and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)),
    columns: { id: true },
  });

  if (!coupon) {
    return [];
  }

  return db.query.couponUsages.findMany({
    where: eq(couponUsages.couponId, couponId),
    orderBy: [desc(couponUsages.createdAt)],
    limit,
    with: {
      order: {
        columns: {
          id: true,
          orderNumber: true,
          total: true,
          createdAt: true,
        },
      },
      customer: {
        columns: {
          id: true,
        },
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get coupon statistics for dashboard
 */
export async function getCouponStats(tenantId: string, couponId: string) {
  // First verify the coupon belongs to this tenant
  const coupon = await db.query.coupons.findFirst({
    where: and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)),
    columns: { id: true },
  });

  if (!coupon) {
    return null;
  }

  const result = await db
    .select({
      totalUsage: sql<number>`count(*)::int`,
      totalDiscountGiven: sql<number>`COALESCE(SUM(${couponUsages.discountAmount}::numeric), 0)`,
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${couponUsages.customerId})::int`,
    })
    .from(couponUsages)
    .where(eq(couponUsages.couponId, couponId));

  return (
    result[0] || { totalUsage: 0, totalDiscountGiven: 0, uniqueCustomers: 0 }
  );
}

/**
 * Get revenue generated from orders using a coupon
 */
export async function getCouponRevenueImpact(
  tenantId: string,
  couponId: string
) {
  // First verify the coupon belongs to this tenant
  const coupon = await db.query.coupons.findFirst({
    where: and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)),
    columns: { id: true },
  });

  if (!coupon) {
    return null;
  }

  const result = await db
    .select({
      totalOrderValue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(couponUsages)
    .innerJoin(orders, eq(orders.id, couponUsages.orderId))
    .where(eq(couponUsages.couponId, couponId));

  return result[0] || { totalOrderValue: 0, orderCount: 0 };
}

/**
 * Count customer usage of a specific coupon
 */
export async function getCustomerCouponUsageCount(
  couponId: string,
  customerId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(
      and(
        eq(couponUsages.couponId, couponId),
        eq(couponUsages.customerId, customerId)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Check if coupon code is unique within tenant
 */
export async function isCouponCodeUnique(
  tenantId: string,
  code: string,
  excludeCouponId?: string
): Promise<boolean> {
  const existing = await db.query.coupons.findFirst({
    where: and(
      eq(coupons.tenantId, tenantId),
      eq(coupons.code, code.toUpperCase()),
      isNull(coupons.deletedAt),
      excludeCouponId ? sql`${coupons.id} != ${excludeCouponId}` : undefined
    ),
    columns: { id: true },
  });

  return !existing;
}
