import { db } from "@/lib/db";
import {
  analyticsDailySnapshots,
  analyticsProductPerformance,
  orders,
  products,
  reviews,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql, count, sum, isNull } from "drizzle-orm";

// Types for dashboard data
export type DashboardStats = {
  totalOrders: number;
  totalRevenue: string;
  totalProducts: number;
  pendingOrders: number;
  ordersToShip: number;
  lowStockProducts: number;
  unrepliedReviews: number;
  todayOrders: number;
  todayRevenue: string;
  revenueChange: number; // percentage vs yesterday
  ordersChange: number; // percentage vs yesterday
};

export type DailyMetric = {
  date: string;
  revenue: number;
  orders: number;
};

export type TopProduct = {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
};

export type RecentOrder = {
  id: string;
  customerName: string;
  total: string;
  status: string;
  createdAt: string;
  itemCount: number;
};

/**
 * Get dashboard statistics for a store
 * Optimized to use aggregate queries instead of loading all records
 */
export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Convert to ISO strings for comparison (orders.createdAt is mode: "string")
  const todayStr = today.toISOString();
  const yesterdayStr = yesterday.toISOString();

  // Run queries in parallel for performance
  const [
    orderStats,
    productCount,
    ordersToShipCount,
    lowStockCount,
    pendingReviewsCount,
    todayStats,
    yesterdayStats,
  ] = await Promise.all([
    // Total orders and revenue
    db
      .select({
        totalOrders: count(),
        totalRevenue: sum(orders.total),
        pendingOrders: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId)),

    // Product count
    db
      .select({ count: count() })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true))),

    // Orders ready to ship (confirmed status)
    db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "confirmed"))),

    // Low stock products (stock <= 5 and trackInventory is true)
    db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          eq(products.trackInventory, true),
          lte(products.stock, 5)
        )
      ),

    // Reviews awaiting response (no reply yet)
    db
      .select({ count: count() })
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), isNull(reviews.replyContent))),

    // Today's stats
    db
      .select({
        orders: count(),
        revenue: sum(orders.total),
      })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, todayStr))),

    // Yesterday's stats (for comparison)
    db
      .select({
        orders: count(),
        revenue: sum(orders.total),
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, yesterdayStr),
          lte(orders.createdAt, todayStr)
        )
      ),
  ]);

  const stats = orderStats[0];
  const todayData = todayStats[0];
  const yesterdayData = yesterdayStats[0];

  // Calculate percentage changes
  const todayRev = parseFloat(todayData?.revenue || "0");
  const yesterdayRev = parseFloat(yesterdayData?.revenue || "0");
  const todayOrd = todayData?.orders || 0;
  const yesterdayOrd = yesterdayData?.orders || 0;

  const revenueChange =
    yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : todayRev > 0 ? 100 : 0;
  const ordersChange =
    yesterdayOrd > 0 ? ((todayOrd - yesterdayOrd) / yesterdayOrd) * 100 : todayOrd > 0 ? 100 : 0;

  return {
    totalOrders: stats?.totalOrders || 0,
    totalRevenue: stats?.totalRevenue || "0",
    totalProducts: productCount[0]?.count || 0,
    pendingOrders: stats?.pendingOrders || 0,
    ordersToShip: ordersToShipCount[0]?.count || 0,
    lowStockProducts: lowStockCount[0]?.count || 0,
    unrepliedReviews: pendingReviewsCount[0]?.count || 0,
    todayOrders: todayOrd,
    todayRevenue: todayRev.toFixed(2),
    revenueChange: Math.round(revenueChange),
    ordersChange: Math.round(ordersChange),
  };
}

/**
 * Get daily metrics for the last N days (for charts)
 * Falls back to orders table if analytics snapshots don't exist
 */
export async function getDailyMetrics(
  tenantId: string,
  days: number = 7
): Promise<DailyMetric[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Try to get from analytics snapshots first (faster)
  const snapshots = await db
    .select({
      date: analyticsDailySnapshots.snapshotDate,
      revenue: analyticsDailySnapshots.netRevenue,
      orders: analyticsDailySnapshots.totalOrders,
    })
    .from(analyticsDailySnapshots)
    .where(
      and(
        eq(analyticsDailySnapshots.tenantId, tenantId),
        gte(analyticsDailySnapshots.snapshotDate, startDate.toISOString().split("T")[0])
      )
    )
    .orderBy(analyticsDailySnapshots.snapshotDate);

  if (snapshots.length > 0) {
    return snapshots.map((s) => ({
      date: s.date,
      revenue: parseFloat(s.revenue),
      orders: s.orders,
    }));
  }

  // Fall back to aggregating from orders table
  const startDateStr = startDate.toISOString();
  const result = await db
    .select({
      date: sql<string>`date(${orders.createdAt})`,
      revenue: sum(orders.total),
      orders: count(),
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, startDateStr)))
    .groupBy(sql`date(${orders.createdAt})`)
    .orderBy(sql`date(${orders.createdAt})`);

  // Fill in missing days with zeros
  const metrics: DailyMetric[] = [];
  const dateMap = new Map(result.map((r) => [r.date, r]));

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const data = dateMap.get(dateStr);

    metrics.push({
      date: dateStr,
      revenue: parseFloat(data?.revenue || "0"),
      orders: data?.orders || 0,
    });
  }

  return metrics;
}

/**
 * Get top selling products for a date range
 */
export async function getTopProducts(
  tenantId: string,
  days: number = 30,
  limit: number = 5
): Promise<TopProduct[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Try analytics table first
  const fromAnalytics = await db
    .select({
      id: analyticsProductPerformance.productId,
      name: products.name,
      quantitySold: sum(analyticsProductPerformance.quantitySold),
      revenue: sum(analyticsProductPerformance.revenue),
    })
    .from(analyticsProductPerformance)
    .innerJoin(products, eq(analyticsProductPerformance.productId, products.id))
    .where(
      and(
        eq(analyticsProductPerformance.tenantId, tenantId),
        gte(analyticsProductPerformance.snapshotDate, startDate.toISOString().split("T")[0])
      )
    )
    .groupBy(analyticsProductPerformance.productId, products.name)
    .orderBy(desc(sum(analyticsProductPerformance.quantitySold)))
    .limit(limit);

  if (fromAnalytics.length > 0) {
    return fromAnalytics.map((p) => ({
      id: p.id,
      name: p.name,
      quantitySold: Number(p.quantitySold) || 0,
      revenue: parseFloat(String(p.revenue) || "0"),
    }));
  }

  // Fall back to order items (slower but works without analytics data)
  // This is a placeholder - would need orderItems join in production
  return [];
}

/**
 * Get recent orders for the dashboard
 */
export async function getRecentOrders(
  tenantId: string,
  limit: number = 5
): Promise<RecentOrder[]> {
  const recentOrders = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  // Get item counts for each order
  // For now, return without item counts to keep it simple
  return recentOrders.map((o) => ({
    ...o,
    itemCount: 0, // Would need a subquery or join to get this
  }));
}

/**
 * Get actionable items for the dashboard sidebar
 */
export async function getActionableItems(tenantId: string) {
  const [ordersToShip, lowStock, pendingReviews] = await Promise.all([
    // Orders ready to ship
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "confirmed")))
      .orderBy(orders.createdAt)
      .limit(5),

    // Low stock products
    db
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          eq(products.trackInventory, true),
          lte(products.stock, 5)
        )
      )
      .orderBy(products.stock)
      .limit(5),

    // Reviews awaiting response
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), isNull(reviews.replyContent)))
      .orderBy(desc(reviews.createdAt))
      .limit(5),
  ]);

  return {
    ordersToShip,
    lowStock,
    pendingReviews,
  };
}
