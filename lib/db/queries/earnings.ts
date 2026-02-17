import { cache } from "react";
import {
  eq,
  and,
  desc,
  count as drizzleCount,
  sql,
  gte,
  lte,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tenants,
  sellerBalances,
  sellerTransactions,
  sellerPayoutMethods,
  sellerPayouts,
  type SellerTransactionType,
  type PayoutStatus,
} from "@/lib/db/schema";

// =============================================================================
// SELLER EARNINGS QUERIES
// =============================================================================
// Financial queries for seller earnings dashboard

export type SellerBalance = typeof sellerBalances.$inferSelect;
export type SellerTransaction = typeof sellerTransactions.$inferSelect;
export type SellerPayoutMethod = typeof sellerPayoutMethods.$inferSelect;
export type SellerPayout = typeof sellerPayouts.$inferSelect;

// =============================================================================
// BALANCE QUERIES
// =============================================================================

/**
 * Get seller balance for a store, creating if it doesn't exist
 */
export const getSellerBalance = cache(async (tenantId: string) => {
  // First try to get existing balance
  let balance = await db.query.sellerBalances.findFirst({
    where: eq(sellerBalances.tenantId, tenantId),
  });

  // Create balance record if it doesn't exist
  if (!balance) {
    // Look up the store's currency (default to AFN if not set)
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { currency: true },
    });
    const storeCurrency = tenant?.currency || "AFN";

    const [newBalance] = await db
      .insert(sellerBalances)
      .values({
        tenantId,
        available: "0",
        pending: "0",
        reserved: "0",
        lifetimeEarnings: "0",
        lifetimePaidOut: "0",
        currency: storeCurrency,
      })
      .returning();
    balance = newBalance;
  }

  return balance;
});

/**
 * Get balance summary with calculated total
 */
export const getBalanceSummary = cache(async (tenantId: string) => {
  const balance = await getSellerBalance(tenantId);

  const available = parseFloat(balance.available);
  const pending = parseFloat(balance.pending);
  const reserved = parseFloat(balance.reserved);
  const lifetimeEarnings = parseFloat(balance.lifetimeEarnings);
  const lifetimePaidOut = parseFloat(balance.lifetimePaidOut);

  return {
    ...balance,
    availableNum: available,
    pendingNum: pending,
    reservedNum: reserved,
    totalBalance: available + pending + reserved,
    lifetimeEarningsNum: lifetimeEarnings,
    lifetimePaidOutNum: lifetimePaidOut,
  };
});

// =============================================================================
// TRANSACTION QUERIES
// =============================================================================

interface TransactionFilters {
  limit?: number;
  offset?: number;
  type?: SellerTransactionType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get paginated transaction history for a store
 */
export const getSellerTransactions = cache(
  async (tenantId: string, options?: TransactionFilters) => {
    const { limit = 20, offset = 0, type, startDate, endDate } = options || {};

    const conditions = [eq(sellerTransactions.tenantId, tenantId)];

    if (type) {
      conditions.push(eq(sellerTransactions.type, type));
    }

    if (startDate) {
      conditions.push(
        gte(sellerTransactions.createdAt, startDate.toISOString())
      );
    }

    if (endDate) {
      conditions.push(lte(sellerTransactions.createdAt, endDate.toISOString()));
    }

    const transactions = await db.query.sellerTransactions.findMany({
      where: and(...conditions),
      orderBy: [desc(sellerTransactions.createdAt)],
      limit,
      offset,
    });

    return transactions;
  }
);

/**
 * Get transaction count for pagination
 */
export const getSellerTransactionCount = cache(
  async (
    tenantId: string,
    options?: Omit<TransactionFilters, "limit" | "offset">
  ) => {
    const { type, startDate, endDate } = options || {};

    const conditions = [eq(sellerTransactions.tenantId, tenantId)];

    if (type) {
      conditions.push(eq(sellerTransactions.type, type));
    }

    if (startDate) {
      conditions.push(
        gte(sellerTransactions.createdAt, startDate.toISOString())
      );
    }

    if (endDate) {
      conditions.push(lte(sellerTransactions.createdAt, endDate.toISOString()));
    }

    const result = await db
      .select({ count: drizzleCount() })
      .from(sellerTransactions)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }
);

/**
 * Get recent transactions (last N)
 */
export const getRecentTransactions = cache(
  async (tenantId: string, limit: number = 5) => {
    return getSellerTransactions(tenantId, { limit });
  }
);

/**
 * Get transaction summary for a period
 */
export const getTransactionSummary = cache(
  async (tenantId: string, startDate: Date, endDate: Date) => {
    const result = await db
      .select({
        type: sellerTransactions.type,
        total: sql<string>`SUM(${sellerTransactions.amount})`,
        count: drizzleCount(),
      })
      .from(sellerTransactions)
      .where(
        and(
          eq(sellerTransactions.tenantId, tenantId),
          gte(sellerTransactions.createdAt, startDate.toISOString()),
          lte(sellerTransactions.createdAt, endDate.toISOString())
        )
      )
      .groupBy(sellerTransactions.type);

    return result;
  }
);

// =============================================================================
// PAYOUT METHOD QUERIES
// =============================================================================

/**
 * Get all payout methods for a store
 */
export const getSellerPayoutMethods = cache(async (tenantId: string) => {
  const methods = await db.query.sellerPayoutMethods.findMany({
    where: eq(sellerPayoutMethods.tenantId, tenantId),
    orderBy: [
      desc(sellerPayoutMethods.isDefault),
      desc(sellerPayoutMethods.createdAt),
    ],
  });

  return methods;
});

/**
 * Get the default payout method for a store
 */
export const getDefaultPayoutMethod = cache(async (tenantId: string) => {
  const method = await db.query.sellerPayoutMethods.findFirst({
    where: and(
      eq(sellerPayoutMethods.tenantId, tenantId),
      eq(sellerPayoutMethods.isDefault, true)
    ),
  });

  return method;
});

/**
 * Get a specific payout method by ID
 */
export const getPayoutMethodById = cache(
  async (methodId: string, tenantId: string) => {
    const method = await db.query.sellerPayoutMethods.findFirst({
      where: and(
        eq(sellerPayoutMethods.id, methodId),
        eq(sellerPayoutMethods.tenantId, tenantId)
      ),
    });

    return method;
  }
);

// =============================================================================
// PAYOUT QUERIES
// =============================================================================

interface PayoutFilters {
  limit?: number;
  offset?: number;
  status?: PayoutStatus;
}

/**
 * Get paginated payout history for a store
 */
export const getSellerPayouts = cache(
  async (tenantId: string, options?: PayoutFilters) => {
    const { limit = 20, offset = 0, status } = options || {};

    const conditions = [eq(sellerPayouts.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(sellerPayouts.status, status));
    }

    const payouts = await db.query.sellerPayouts.findMany({
      where: and(...conditions),
      orderBy: [desc(sellerPayouts.requestedAt)],
      limit,
      offset,
      with: {
        payoutMethod: true,
      },
    });

    return payouts;
  }
);

/**
 * Get payout count for pagination
 */
export const getSellerPayoutCount = cache(
  async (tenantId: string, status?: PayoutStatus) => {
    const conditions = [eq(sellerPayouts.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(sellerPayouts.status, status));
    }

    const result = await db
      .select({ count: drizzleCount() })
      .from(sellerPayouts)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }
);

/**
 * Get a specific payout by ID
 */
export const getPayoutById = cache(
  async (payoutId: string, tenantId: string) => {
    const payout = await db.query.sellerPayouts.findFirst({
      where: and(
        eq(sellerPayouts.id, payoutId),
        eq(sellerPayouts.tenantId, tenantId)
      ),
      with: {
        payoutMethod: true,
      },
    });

    return payout;
  }
);

/**
 * Get pending payouts (for admin processing)
 */
export const getPendingPayouts = cache(async (tenantId: string) => {
  return getSellerPayouts(tenantId, { status: "pending" });
});

/**
 * Get total paid out for a period
 */
export const getTotalPaidOut = cache(
  async (tenantId: string, startDate?: Date, endDate?: Date) => {
    const conditions = [
      eq(sellerPayouts.tenantId, tenantId),
      eq(sellerPayouts.status, "completed"),
    ];

    if (startDate) {
      conditions.push(gte(sellerPayouts.completedAt, startDate.toISOString()));
    }

    if (endDate) {
      conditions.push(lte(sellerPayouts.completedAt, endDate.toISOString()));
    }

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${sellerPayouts.netAmount}), 0)`,
        count: drizzleCount(),
      })
      .from(sellerPayouts)
      .where(and(...conditions));

    return {
      total: parseFloat(result[0]?.total || "0"),
      count: result[0]?.count || 0,
    };
  }
);

// =============================================================================
// EARNINGS ANALYTICS
// =============================================================================

/**
 * Get earnings overview for dashboard
 */
export const getEarningsOverview = cache(async (tenantId: string) => {
  const [balance, recentTransactions, pendingPayouts] = await Promise.all([
    getBalanceSummary(tenantId),
    getRecentTransactions(tenantId, 5),
    getSellerPayoutCount(tenantId, "pending"),
  ]);

  return {
    balance,
    recentTransactions,
    pendingPayoutCount: pendingPayouts,
  };
});

/**
 * Generate next payout number
 */
export async function generatePayoutNumber(tenantId: string): Promise<string> {
  const result = await db
    .select({ count: drizzleCount() })
    .from(sellerPayouts)
    .where(eq(sellerPayouts.tenantId, tenantId));

  const count = (result[0]?.count || 0) + 1;
  const paddedCount = count.toString().padStart(6, "0");
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  return `PO-${year}${month}-${paddedCount}`;
}
