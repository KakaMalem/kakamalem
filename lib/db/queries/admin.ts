import { db } from "@/lib/db";
import {
  tenants,
  orders,
  products,
  user,
  adminAuditLog,
} from "@/lib/db/schema";
import { eq, sql, desc, and, or, ilike, count } from "drizzle-orm";
import { cache } from "react";

// =============================================================================
// ADMIN QUERIES
// =============================================================================
// Database queries for the admin panel
// =============================================================================

/**
 * Get platform-wide statistics for admin dashboard
 */
export const getAdminDashboardStats = cache(async () => {
  // Count stores by status
  const storeStats = await db
    .select({
      status: tenants.status,
      subscriptionStatus: tenants.subscriptionStatus,
      count: count(),
    })
    .from(tenants)
    .groupBy(tenants.status, tenants.subscriptionStatus);

  // Count total users
  const [userCount] = await db.select({ count: count() }).from(user);

  // Count total products
  const [productCount] = await db.select({ count: count() }).from(products);

  // Count total orders
  const [orderCount] = await db.select({ count: count() }).from(orders);

  // Calculate totals from store stats
  let totalStores = 0;
  let activeStores = 0;
  let suspendedStores = 0;
  let trialingStores = 0;
  let expiredTrials = 0;

  storeStats.forEach((stat) => {
    const c = Number(stat.count);
    totalStores += c;

    if (stat.status === "active") activeStores += c;
    if (stat.status === "suspended") suspendedStores += c;
    if (stat.subscriptionStatus === "trialing") trialingStores += c;
    if (stat.subscriptionStatus === "expired") expiredTrials += c;
  });

  return {
    totalStores,
    activeStores,
    suspendedStores,
    trialingStores,
    expiredTrials,
    totalUsers: Number(userCount?.count ?? 0),
    totalProducts: Number(productCount?.count ?? 0),
    totalOrders: Number(orderCount?.count ?? 0),
  };
});

/**
 * Get stores with pagination and filters
 */
export async function getAdminStores(options: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  subscriptionStatus?: string;
  sortBy?: "createdAt" | "name" | "status";
  sortOrder?: "asc" | "desc";
}) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    subscriptionStatus,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(tenants.name, `%${search}%`),
        ilike(tenants.slug, `%${search}%`),
        ilike(tenants.contactEmail, `%${search}%`)
      )
    );
  }

  if (status) {
    conditions.push(
      eq(tenants.status, status as (typeof tenants.status.enumValues)[number])
    );
  }

  if (subscriptionStatus) {
    conditions.push(
      eq(
        tenants.subscriptionStatus,
        subscriptionStatus as (typeof tenants.subscriptionStatus.enumValues)[number]
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get stores
  const stores = await db.query.tenants.findMany({
    where: whereClause,
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: sortOrder === "desc" ? desc(tenants[sortBy]) : tenants[sortBy],
    limit,
    offset,
  });

  // Get total count for pagination
  const [{ total }] = await db
    .select({ total: count() })
    .from(tenants)
    .where(whereClause);

  return {
    stores,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

/**
 * Get a single store by ID with full details for admin view
 */
export async function getAdminStoreById(storeId: string) {
  const store = await db.query.tenants.findFirst({
    where: eq(tenants.id, storeId),
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });

  if (!store) return null;

  // Get additional stats
  const [productCount] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.tenantId, storeId));

  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.tenantId, storeId));

  // Get revenue — count all paid orders regardless of fulfillment status
  const [revenue] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(eq(orders.tenantId, storeId), eq(orders.isPaid, true))
    );

  return {
    ...store,
    stats: {
      products: Number(productCount?.count ?? 0),
      orders: Number(orderCount?.count ?? 0),
      revenue: parseFloat(revenue?.total ?? "0"),
    },
  };
}

/**
 * Get stores with trial ending soon (for warnings)
 */
export async function getStoresWithTrialEndingSoon(days: number = 3) {
  const now = new Date();
  const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return db.query.tenants.findMany({
    where: and(
      eq(tenants.subscriptionStatus, "trialing"),
      sql`${tenants.trialEndsAt} IS NOT NULL`,
      sql`${tenants.trialEndsAt} <= ${warningDate.toISOString()}`,
      sql`${tenants.trialEndsAt} >= ${now.toISOString()}`
    ),
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: tenants.trialEndsAt,
  });
}

/**
 * Get stores with expired trials
 */
export async function getStoresWithExpiredTrials() {
  return db.query.tenants.findMany({
    where: and(
      eq(tenants.status, "active"),
      eq(tenants.subscriptionStatus, "trialing"),
      sql`${tenants.trialEndsAt} IS NOT NULL`,
      sql`${tenants.trialEndsAt} < NOW()`
    ),
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: desc(tenants.trialEndsAt),
  });
}

/**
 * Get platform settings (singleton)
 */
export const getPlatformSettings = cache(async () => {
  const settings = await db.query.platformSettings.findFirst();

  // Return defaults if no settings exist
  if (!settings) {
    return {
      id: null,
      proPlanPriceAfn: "1100",
      proPlanYearlyPriceAfn: "12000",
      freeProductLimit: 20,
      trialDurationDays: 7,
      transactionFeePercent: "0",
      trialWarningDays: 3,
      usdtWalletConfig: null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  return settings;
});

/**
 * Get recent admin audit logs
 */
export async function getAdminAuditLogs(limit: number = 50) {
  return db.query.adminAuditLog.findMany({
    with: {
      admin: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: desc(adminAuditLog.createdAt),
    limit,
  });
}

/**
 * Count stores by subscription plan
 */
export async function getSubscriptionPlanDistribution() {
  const distribution = await db
    .select({
      plan: tenants.subscriptionPlan,
      status: tenants.subscriptionStatus,
      count: count(),
    })
    .from(tenants)
    .groupBy(tenants.subscriptionPlan, tenants.subscriptionStatus);

  return distribution;
}
