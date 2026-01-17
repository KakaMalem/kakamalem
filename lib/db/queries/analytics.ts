import { db } from "@/lib/db";
import {
  analyticsDailySnapshots,
  analyticsProductPerformance,
  orders,
  orderItems,
  products,
  reviews,
} from "@/lib/db/schema";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  sql,
  count,
  sum,
  isNull,
  notInArray,
} from "drizzle-orm";

// Order statuses that should be excluded from revenue calculations
const EXCLUDED_REVENUE_STATUSES: (
  | "cancelled"
  | "refunded"
)[] = ["cancelled", "refunded"];

// ============================================================================
// Analytics Page Types
// ============================================================================

export type TimeRange =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month";

export type DateRange = {
  start: Date;
  end: Date;
};

export type AnalyticsKPIs = {
  totalRevenue: number;
  revenueChange: number;
  totalOrders: number;
  ordersChange: number;
  averageOrderValue: number;
  aovChange: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  customersChange: number;
};

export type DailyAnalyticsPoint = {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
};

export type AnalyticsTopProduct = {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
  ordersContaining: number;
  percentOfTotal: number;
};

export type AnalyticsData = {
  kpis: AnalyticsKPIs;
  dailyData: DailyAnalyticsPoint[];
  topProducts: AnalyticsTopProduct[];
};

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
export async function getDashboardStats(
  tenantId: string
): Promise<DashboardStats> {
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
    // Total orders and revenue (excluding cancelled/refunded)
    db
      .select({
        totalOrders: count(),
        totalRevenue: sum(orders.total),
        pendingOrders: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
        )
      ),

    // Product count
    db
      .select({ count: count() })
      .from(products)
      .where(
        and(eq(products.tenantId, tenantId), eq(products.status, "active"))
      ),

    // Orders ready to ship (confirmed status)
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(eq(orders.tenantId, tenantId), eq(orders.status, "confirmed"))
      ),

    // Low stock products (stock <= 5 and trackInventory is true)
    db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.status, "active"),
          eq(products.trackInventory, true),
          lte(products.stock, 5)
        )
      ),

    // Reviews awaiting response (no reply yet)
    db
      .select({ count: count() })
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), isNull(reviews.replyContent))),

    // Today's stats (excluding cancelled/refunded)
    db
      .select({
        orders: count(),
        revenue: sum(orders.total),
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, todayStr),
          notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
        )
      ),

    // Yesterday's stats (for comparison, excluding cancelled/refunded)
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
          lte(orders.createdAt, todayStr),
          notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
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
    yesterdayRev > 0
      ? ((todayRev - yesterdayRev) / yesterdayRev) * 100
      : todayRev > 0
        ? 100
        : 0;
  const ordersChange =
    yesterdayOrd > 0
      ? ((todayOrd - yesterdayOrd) / yesterdayOrd) * 100
      : todayOrd > 0
        ? 100
        : 0;

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
        gte(
          analyticsDailySnapshots.snapshotDate,
          startDate.toISOString().split("T")[0]
        )
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

  // Fall back to aggregating from orders table (excluding cancelled/refunded)
  const startDateStr = startDate.toISOString();
  const result = await db
    .select({
      date: sql<string>`date(${orders.createdAt})`,
      revenue: sum(orders.total),
      orders: count(),
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDateStr),
        notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
      )
    )
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
        gte(
          analyticsProductPerformance.snapshotDate,
          startDate.toISOString().split("T")[0]
        )
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
      customerSnapshot: orders.customerSnapshot,
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
    id: o.id,
    customerName: o.customerSnapshot?.name || "Guest",
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
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
        customerSnapshot: orders.customerSnapshot,
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
          eq(products.status, "active"),
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

// ============================================================================
// Analytics Page Functions
// ============================================================================

/**
 * Convert a time range to date boundaries for current and comparison periods
 */
export function getDateRangeFromTimeRange(range: TimeRange): {
  current: DateRange;
  previous: DateRange;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case "today": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);
      return {
        current: { start: today, end: now },
        previous: { start: yesterday, end: today },
      };
    }
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);
      return {
        current: { start: yesterday, end: today },
        previous: { start: dayBefore, end: yesterday },
      };
    }
    case "7d": {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(weekAgo);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
      return {
        current: { start: weekAgo, end: now },
        previous: { start: twoWeeksAgo, end: weekAgo },
      };
    }
    case "30d": {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const twoMonthsAgo = new Date(monthAgo);
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 30);
      return {
        current: { start: monthAgo, end: now },
        previous: { start: twoMonthsAgo, end: monthAgo },
      };
    }
    case "this_month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
      return {
        current: { start: monthStart, end: now },
        previous: { start: lastMonthStart, end: monthStart },
      };
    }
    case "last_month": {
      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const twoMonthsAgoStart = new Date(
        today.getFullYear(),
        today.getMonth() - 2,
        1
      );
      return {
        current: { start: lastMonthStart, end: thisMonthStart },
        previous: { start: twoMonthsAgoStart, end: lastMonthStart },
      };
    }
    default:
      return getDateRangeFromTimeRange("7d");
  }
}

/**
 * Get the number of days in a time range
 */
function getDaysInRange(range: TimeRange): number {
  switch (range) {
    case "today":
    case "yesterday":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "this_month": {
      const now = new Date();
      return now.getDate();
    }
    case "last_month": {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return lastMonth.getDate();
    }
    default:
      return 7;
  }
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get analytics data for a store for a given time range
 * Returns KPIs, daily data for charts, and top products
 */
export async function getAnalyticsData(
  tenantId: string,
  timeRange: TimeRange = "7d"
): Promise<AnalyticsData> {
  const { current, previous } = getDateRangeFromTimeRange(timeRange);
  const days = getDaysInRange(timeRange);

  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();
  const previousStartStr = previous.start.toISOString();
  const previousEndStr = previous.end.toISOString();

  // Run all queries in parallel (excluding cancelled/refunded orders)
  const [currentPeriodStats, previousPeriodStats, dailyData, topProductsData] =
    await Promise.all([
      // Current period aggregate stats
      db
        .select({
          totalRevenue: sum(orders.total),
          totalOrders: count(),
          // Count unique customers by extracting email from JSONB customerSnapshot
          uniqueCustomers: sql<number>`count(distinct (${orders.customerSnapshot}->>'email'))`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            gte(orders.createdAt, currentStartStr),
            lte(orders.createdAt, currentEndStr),
            notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
          )
        ),

      // Previous period aggregate stats (for comparison)
      db
        .select({
          totalRevenue: sum(orders.total),
          totalOrders: count(),
          uniqueCustomers: sql<number>`count(distinct (${orders.customerSnapshot}->>'email'))`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            gte(orders.createdAt, previousStartStr),
            lte(orders.createdAt, previousEndStr),
            notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
          )
        ),

      // Daily breakdown for charts
      db
        .select({
          date: sql<string>`date(${orders.createdAt})`,
          revenue: sum(orders.total),
          orders: count(),
          uniqueCustomers: sql<number>`count(distinct (${orders.customerSnapshot}->>'email'))`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            gte(orders.createdAt, currentStartStr),
            lte(orders.createdAt, currentEndStr),
            notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
          )
        )
        .groupBy(sql`date(${orders.createdAt})`)
        .orderBy(sql`date(${orders.createdAt})`),

      // Top products by quantity sold
      db
        .select({
          id: products.id,
          name: products.name,
          quantitySold: sum(orderItems.quantity),
          revenue: sum(sql`${orderItems.quantity} * ${orderItems.price}`),
          ordersContaining: sql<number>`count(distinct ${orders.id})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(
          and(
            eq(orders.tenantId, tenantId),
            gte(orders.createdAt, currentStartStr),
            lte(orders.createdAt, currentEndStr),
            notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
          )
        )
        .groupBy(products.id, products.name)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(5),
    ]);

  // Process current period stats
  const currentStats = currentPeriodStats[0];
  const previousStats = previousPeriodStats[0];

  const totalRevenue = parseFloat(currentStats?.totalRevenue || "0");
  const totalOrders = currentStats?.totalOrders || 0;
  const totalCustomers = currentStats?.uniqueCustomers || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const prevRevenue = parseFloat(previousStats?.totalRevenue || "0");
  const prevOrders = previousStats?.totalOrders || 0;
  const prevCustomers = previousStats?.uniqueCustomers || 0;
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  // Calculate KPIs
  const kpis: AnalyticsKPIs = {
    totalRevenue,
    revenueChange: calculateChange(totalRevenue, prevRevenue),
    totalOrders,
    ordersChange: calculateChange(totalOrders, prevOrders),
    averageOrderValue: Math.round(averageOrderValue),
    aovChange: calculateChange(averageOrderValue, prevAov),
    totalCustomers,
    newCustomers: totalCustomers, // Simplified: treating all as new for this period
    returningCustomers: 0, // Would need historical customer data to calculate
    customersChange: calculateChange(totalCustomers, prevCustomers),
  };

  // Fill in missing days with zeros
  const dailyPoints: DailyAnalyticsPoint[] = [];
  const dateMap = new Map(dailyData.map((d) => [d.date, d]));

  for (let i = 0; i < days; i++) {
    const date = new Date(current.start);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const data = dateMap.get(dateStr);

    const dayRevenue = parseFloat(data?.revenue || "0");
    const dayOrders = data?.orders || 0;

    dailyPoints.push({
      date: dateStr,
      revenue: dayRevenue,
      orders: dayOrders,
      averageOrderValue: dayOrders > 0 ? dayRevenue / dayOrders : 0,
      newCustomers: data?.uniqueCustomers || 0,
      returningCustomers: 0,
    });
  }

  // Calculate top products with percentage
  const totalProductRevenue = topProductsData.reduce(
    (acc, p) => acc + parseFloat(String(p.revenue) || "0"),
    0
  );

  const topProducts: AnalyticsTopProduct[] = topProductsData.map((p) => {
    const revenue = parseFloat(String(p.revenue) || "0");
    return {
      id: p.id,
      name: p.name,
      quantitySold: Number(p.quantitySold) || 0,
      revenue,
      ordersContaining: p.ordersContaining || 0,
      percentOfTotal:
        totalProductRevenue > 0 ? (revenue / totalProductRevenue) * 100 : 0,
    };
  });

  return {
    kpis,
    dailyData: dailyPoints,
    topProducts,
  };
}
