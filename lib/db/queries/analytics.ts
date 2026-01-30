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
// Note: "returned" orders may still count as revenue if not fully refunded
// Use payment status for refund-based exclusions
const EXCLUDED_REVENUE_STATUSES: ("cancelled" | "returned")[] = [
  "cancelled",
  "returned",
];

// ============================================================================
// Analytics Page Types
// ============================================================================

export type TimeRange =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

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

// Enhanced KPIs with additional metrics
export type EnhancedAnalyticsKPIs = AnalyticsKPIs & {
  conversionRate: number;
  conversionRateChange: number;
  cartAbandonmentRate: number;
  cartAbandonmentChange: number;
  averageItemsPerOrder: number;
  itemsPerOrderChange: number;
  productViews: number;
  productViewsChange: number;
};

// Time series data with optional comparison
export type TimeSeriesData = {
  current: DailyAnalyticsPoint[];
  previous?: DailyAnalyticsPoint[];
};

// Category performance for donut charts
export type CategoryPerformance = {
  categoryId: string;
  categoryName: string;
  revenue: number;
  orders: number;
  quantitySold: number;
  percentOfTotal: number;
};

// Product performance for data tables
export type ProductPerformanceRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantitySold: number;
  revenue: number;
  orders: number;
  views: number;
  conversionRate: number;
  averagePrice: number;
};

// Traffic source data
export type TrafficSourceData = {
  source: string;
  medium: string | null;
  campaign: string | null;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
};

// Conversion funnel stages
export type ConversionFunnelData = {
  stage: "product_view" | "add_to_cart" | "checkout_start" | "purchase";
  label: string;
  count: number;
  dropoff: number;
  dropoffPercent: number;
};

// Geographic sales data
export type GeographicData = {
  countryCode: string;
  countryName: string;
  state: string | null;
  city: string | null;
  orders: number;
  revenue: number;
  uniqueCustomers: number;
};

// Sales heatmap data (hour x day of week)
export type HeatmapData = {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday = 0)
  value: number; // Order count or revenue
};

// Real-time metrics
export type RealTimeMetrics = {
  ordersToday: number;
  revenueToday: number;
  activeVisitors: number;
  lastOrderAt: string | null;
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

  // Fall back to order items (works without analytics data)
  const startDateStr = startDate.toISOString();
  const fromOrderItems = await db
    .select({
      id: products.id,
      name: products.name,
      quantitySold: sum(orderItems.quantity),
      revenue: sum(sql`${orderItems.quantity} * ${orderItems.price}`),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDateStr),
        notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
      )
    )
    .groupBy(products.id, products.name)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(limit);

  return fromOrderItems.map((p) => ({
    id: p.id,
    name: p.name,
    quantitySold: Number(p.quantitySold) || 0,
    revenue: parseFloat(String(p.revenue) || "0"),
  }));
}

/**
 * Get recent orders for the dashboard
 */
export async function getRecentOrders(
  tenantId: string,
  limit: number = 5
): Promise<RecentOrder[]> {
  // Query orders with item count using a subquery
  const recentOrders = await db
    .select({
      id: orders.id,
      customerSnapshot: orders.customerSnapshot,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
      itemCount: sql<number>`(
        SELECT COALESCE(SUM(${orderItems.quantity}), 0)::int
        FROM ${orderItems}
        WHERE ${orderItems.orderId} = ${orders.id}
      )`,
    })
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return recentOrders.map((o) => ({
    id: o.id,
    customerName: o.customerSnapshot?.name || "Guest",
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
    itemCount: o.itemCount || 0,
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
    case "90d": {
      const quarterAgo = new Date(today);
      quarterAgo.setDate(quarterAgo.getDate() - 90);
      const twoQuartersAgo = new Date(quarterAgo);
      twoQuartersAgo.setDate(twoQuartersAgo.getDate() - 90);
      return {
        current: { start: quarterAgo, end: now },
        previous: { start: twoQuartersAgo, end: quarterAgo },
      };
    }
    case "this_year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear(), 0, 1);
      return {
        current: { start: yearStart, end: now },
        previous: { start: lastYearStart, end: lastYearEnd },
      };
    }
    case "custom":
      // For custom, caller must provide dates separately
      // Default to 7d as fallback
      return getDateRangeFromTimeRange("7d");
    default:
      return getDateRangeFromTimeRange("7d");
  }
}

/**
 * Get date range from custom start/end dates
 */
export function getCustomDateRange(
  startDate: string,
  endDate: string
): { current: DateRange; previous: DateRange } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();

  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(start.getTime() - durationMs);

  return {
    current: { start, end },
    previous: { start: previousStart, end: previousEnd },
  };
}

/**
 * Get the number of days in a time range
 */
export function getDaysInRange(range: TimeRange): number {
  switch (range) {
    case "today":
    case "yesterday":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "this_month": {
      const now = new Date();
      return now.getDate();
    }
    case "last_month": {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return lastMonth.getDate();
    }
    case "this_year": {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return Math.ceil(
        (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    case "custom":
      return 7; // Default, caller should calculate
    default:
      return 7;
  }
}

/**
 * Get days between two dates
 */
export function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
  const [
    currentPeriodStats,
    previousPeriodStats,
    dailyData,
    topProductsData,
    returningCustomersData,
  ] = await Promise.all([
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

    // Count returning customers (customers who ordered in current period AND had previous orders)
    db
      .select({
        count: sql<number>`count(distinct current_period.email)`,
      })
      .from(
        sql`(
          SELECT DISTINCT ${orders.customerSnapshot}->>'email' as email
          FROM ${orders}
          WHERE ${orders.tenantId} = ${tenantId}
            AND ${orders.createdAt} >= ${currentStartStr}
            AND ${orders.createdAt} <= ${currentEndStr}
            AND ${orders.status} NOT IN ('cancelled', 'returned')
        ) as current_period`
      )
      .innerJoin(
        sql`(
          SELECT DISTINCT ${orders.customerSnapshot}->>'email' as email
          FROM ${orders}
          WHERE ${orders.tenantId} = ${tenantId}
            AND ${orders.createdAt} < ${currentStartStr}
            AND ${orders.status} NOT IN ('cancelled', 'returned')
        ) as previous_orders`,
        sql`current_period.email = previous_orders.email`
      ),
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

  // Calculate new vs returning customers
  const returningCustomers = returningCustomersData[0]?.count || 0;
  const newCustomers = Math.max(0, totalCustomers - returningCustomers);

  // Calculate KPIs
  const kpis: AnalyticsKPIs = {
    totalRevenue,
    revenueChange: calculateChange(totalRevenue, prevRevenue),
    totalOrders,
    ordersChange: calculateChange(totalOrders, prevOrders),
    averageOrderValue: Math.round(averageOrderValue),
    aovChange: calculateChange(averageOrderValue, prevAov),
    totalCustomers,
    newCustomers,
    returningCustomers,
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

// ============================================================================
// Enhanced Analytics Functions
// ============================================================================

/**
 * Get enhanced KPIs including conversion rate, cart abandonment, etc.
 * These require analytics event tracking to be fully accurate
 */
export async function getEnhancedKPIs(
  tenantId: string,
  timeRange: TimeRange = "7d"
): Promise<EnhancedAnalyticsKPIs> {
  const baseData = await getAnalyticsData(tenantId, timeRange);
  const { current, previous } = getDateRangeFromTimeRange(timeRange);

  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();
  const previousStartStr = previous.start.toISOString();
  const previousEndStr = previous.end.toISOString();

  // Get items per order metrics
  const [currentItemsPerOrder, previousItemsPerOrder] = await Promise.all([
    db
      .select({
        avgItems: sql<number>`avg(item_count)::numeric`,
      })
      .from(
        sql`(
          SELECT ${orders.id}, COALESCE(SUM(${orderItems.quantity}), 0) as item_count
          FROM ${orders}
          LEFT JOIN ${orderItems} ON ${orderItems.orderId} = ${orders.id}
          WHERE ${orders.tenantId} = ${tenantId}
            AND ${orders.createdAt} >= ${currentStartStr}
            AND ${orders.createdAt} <= ${currentEndStr}
            AND ${orders.status} NOT IN ('cancelled', 'returned')
          GROUP BY ${orders.id}
        ) as order_items`
      ),
    db
      .select({
        avgItems: sql<number>`avg(item_count)::numeric`,
      })
      .from(
        sql`(
          SELECT ${orders.id}, COALESCE(SUM(${orderItems.quantity}), 0) as item_count
          FROM ${orders}
          LEFT JOIN ${orderItems} ON ${orderItems.orderId} = ${orders.id}
          WHERE ${orders.tenantId} = ${tenantId}
            AND ${orders.createdAt} >= ${previousStartStr}
            AND ${orders.createdAt} <= ${previousEndStr}
            AND ${orders.status} NOT IN ('cancelled', 'returned')
          GROUP BY ${orders.id}
        ) as order_items`
      ),
  ]);

  const avgItems = parseFloat(String(currentItemsPerOrder[0]?.avgItems || 0));
  const prevAvgItems = parseFloat(
    String(previousItemsPerOrder[0]?.avgItems || 0)
  );

  return {
    ...baseData.kpis,
    // These would require page view / conversion event tracking
    conversionRate: 0,
    conversionRateChange: 0,
    cartAbandonmentRate: 0,
    cartAbandonmentChange: 0,
    // Items per order can be calculated from existing data
    averageItemsPerOrder: Math.round(avgItems * 10) / 10,
    itemsPerOrderChange: calculateChange(avgItems, prevAvgItems),
    // Product views would require page view tracking
    productViews: 0,
    productViewsChange: 0,
  };
}

/**
 * Get category performance data for pie/donut charts
 */
export async function getCategoryPerformance(
  tenantId: string,
  timeRange: TimeRange = "7d"
): Promise<CategoryPerformance[]> {
  const { current } = getDateRangeFromTimeRange(timeRange);
  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();

  const categoryStats = await db
    .select({
      categoryId: sql<string>`COALESCE(${products.categoryId}::text, 'uncategorized')`,
      categoryName: sql<string>`COALESCE(c.name, 'Uncategorized')`,
      revenue: sum(sql`${orderItems.quantity} * ${orderItems.price}`),
      orders: sql<number>`count(distinct ${orders.id})`,
      quantitySold: sum(orderItems.quantity),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(sql`categories c`, sql`c.id = ${products.categoryId}`)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, currentStartStr),
        lte(orders.createdAt, currentEndStr),
        notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
      )
    )
    .groupBy(
      sql`COALESCE(${products.categoryId}::text, 'uncategorized'), COALESCE(c.name, 'Uncategorized')`
    )
    .orderBy(desc(sum(sql`${orderItems.quantity} * ${orderItems.price}`)));

  const totalRevenue = categoryStats.reduce(
    (acc, c) => acc + parseFloat(String(c.revenue) || "0"),
    0
  );

  return categoryStats.map((c) => {
    const revenue = parseFloat(String(c.revenue) || "0");
    return {
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      revenue,
      orders: c.orders || 0,
      quantitySold: Number(c.quantitySold) || 0,
      percentOfTotal: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    };
  });
}

/**
 * Get sales heatmap data (hour x day of week)
 */
export async function getSalesHeatmap(
  tenantId: string,
  timeRange: TimeRange = "30d"
): Promise<HeatmapData[]> {
  const { current } = getDateRangeFromTimeRange(timeRange);
  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();

  const heatmapStats = await db
    .select({
      hour: sql<number>`extract(hour from ${orders.createdAt}::timestamp)::int`,
      dayOfWeek: sql<number>`extract(dow from ${orders.createdAt}::timestamp)::int`,
      value: count(),
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
    .groupBy(
      sql`extract(hour from ${orders.createdAt}::timestamp)`,
      sql`extract(dow from ${orders.createdAt}::timestamp)`
    );

  // Fill in missing hour/day combinations with 0
  const heatmapMap = new Map<string, number>();
  heatmapStats.forEach((h) => {
    heatmapMap.set(`${h.hour}-${h.dayOfWeek}`, h.value);
  });

  const result: HeatmapData[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      result.push({
        hour,
        dayOfWeek: day,
        value: heatmapMap.get(`${hour}-${day}`) || 0,
      });
    }
  }

  return result;
}

/**
 * Get product performance data for the table
 */
export async function getProductPerformance(
  tenantId: string,
  timeRange: TimeRange = "7d",
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}
): Promise<{ data: ProductPerformanceRow[]; total: number }> {
  const { page = 1, pageSize = 10, sortOrder = "desc" } = options;
  const { current } = getDateRangeFromTimeRange(timeRange);
  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();

  // Get product stats
  const productStats = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      category: sql<string>`c.name`,
      quantitySold: sum(orderItems.quantity),
      revenue: sum(sql`${orderItems.quantity} * ${orderItems.price}`),
      orders: sql<number>`count(distinct ${orders.id})`,
    })
    .from(products)
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .leftJoin(
      orders,
      and(
        eq(orderItems.orderId, orders.id),
        gte(orders.createdAt, currentStartStr),
        lte(orders.createdAt, currentEndStr),
        notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
      )
    )
    .leftJoin(sql`categories c`, sql`c.id = ${products.categoryId}`)
    .where(eq(products.tenantId, tenantId))
    .groupBy(products.id, products.name, products.sku, sql`c.name`)
    .orderBy(
      sortOrder === "desc"
        ? desc(sum(sql`${orderItems.quantity} * ${orderItems.price}`))
        : sum(sql`${orderItems.quantity} * ${orderItems.price}`)
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Get total count
  const totalCount = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.tenantId, tenantId));

  const data: ProductPerformanceRow[] = productStats.map((p) => {
    const revenue = parseFloat(String(p.revenue) || "0");
    const qty = Number(p.quantitySold) || 0;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      quantitySold: qty,
      revenue,
      orders: p.orders || 0,
      views: 0, // Would need page view tracking
      conversionRate: 0, // Would need page view tracking
      averagePrice: qty > 0 ? revenue / qty : 0,
    };
  });

  return {
    data,
    total: totalCount[0]?.count || 0,
  };
}

/**
 * Get traffic source data (requires UTM tracking implementation)
 * Currently returns empty array as UTM tracking is not implemented
 */
export async function getTrafficSources(
  _tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _timeRange: TimeRange = "7d"
): Promise<TrafficSourceData[]> {
  // Traffic source tracking requires:
  // 1. Capturing UTM params in orders
  // 2. Or analytics_traffic_sources table population
  // For now, return empty array
  return [];
}

/**
 * Get conversion funnel data (requires event tracking implementation)
 * Currently returns placeholder data based on orders
 */
export async function getConversionFunnel(
  tenantId: string,
  timeRange: TimeRange = "7d"
): Promise<ConversionFunnelData[]> {
  const { current } = getDateRangeFromTimeRange(timeRange);
  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();

  // Get order count as the "purchase" stage
  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, currentStartStr),
        lte(orders.createdAt, currentEndStr),
        notInArray(orders.status, EXCLUDED_REVENUE_STATUSES)
      )
    );

  const purchases = orderCount?.count || 0;

  // Without event tracking, we can only show purchase stage
  // A full funnel would require: page views → add to cart → checkout start → purchase
  if (purchases === 0) {
    return [];
  }

  // Return purchase stage only (other stages require event tracking)
  return [
    {
      stage: "purchase",
      label: "Purchases",
      count: purchases,
      dropoff: 0,
      dropoffPercent: 0,
    },
  ];
}

/**
 * Get geographic sales data
 */
export async function getGeographicSales(
  tenantId: string,
  timeRange: TimeRange = "7d"
): Promise<GeographicData[]> {
  const { current } = getDateRangeFromTimeRange(timeRange);
  const currentStartStr = current.start.toISOString();
  const currentEndStr = current.end.toISOString();

  const geoStats = await db
    .select({
      countryCode: sql<string>`COALESCE(${orders.shippingAddress}->>'countryCode', 'AF')`,
      countryName: sql<string>`COALESCE(${orders.shippingAddress}->>'country', 'Afghanistan')`,
      state: sql<string | null>`${orders.shippingAddress}->>'state'`,
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
      orders: count(),
      revenue: sum(orders.total),
      uniqueCustomers: sql<number>`count(distinct ${orders.customerSnapshot}->>'email')`,
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
    .groupBy(
      sql`${orders.shippingAddress}->>'countryCode'`,
      sql`${orders.shippingAddress}->>'country'`,
      sql`${orders.shippingAddress}->>'state'`,
      sql`${orders.shippingAddress}->>'city'`
    )
    .orderBy(desc(sum(orders.total)));

  return geoStats.map((g) => ({
    countryCode: g.countryCode,
    countryName: g.countryName,
    state: g.state,
    city: g.city,
    orders: g.orders,
    revenue: parseFloat(String(g.revenue) || "0"),
    uniqueCustomers: g.uniqueCustomers || 0,
  }));
}
