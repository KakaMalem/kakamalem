import { cache } from "react";
import { eq, desc, count as drizzleCount } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tenants,
  commissionTransactions,
  orders,
  type BillingStatus,
  type CommissionTransactionType,
} from "@/lib/db/schema";

// =============================================================================
// BILLING QUERIES
// =============================================================================

export type BillingOverview = {
  billingStatus: BillingStatus;
  commissionRate: string;
  commissionBalance: string;
  freeTierLimit: string;
  freeTierExceededAt: string | null;
  gracePeriodEndsAt: string | null;
  freeTierUsedPercent: number;
  daysUntilGracePeriodEnds: number | null;
};

export type CommissionTransactionItem = {
  id: string;
  type: CommissionTransactionType;
  amount: string;
  balanceAfter: string;
  orderId: string | null;
  orderNumber: string | null;
  description: string | null;
  createdAt: string;
};

export type TransactionPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * Get billing overview for a tenant
 */
export const getBillingOverview = cache(
  async (tenantId: string): Promise<BillingOverview | null> => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        billingStatus: true,
        commissionRate: true,
        commissionBalance: true,
        freeTierLimit: true,
        freeTierExceededAt: true,
        gracePeriodEndsAt: true,
      },
    });

    if (!tenant) return null;

    // Calculate free tier usage percentage
    const balance = parseFloat(tenant.commissionBalance);
    const limit = parseFloat(tenant.freeTierLimit);
    const freeTierUsedPercent =
      limit > 0 ? Math.min(Math.round((balance / limit) * 100), 100) : 0;

    // Calculate days until grace period ends
    let daysUntilGracePeriodEnds: number | null = null;
    if (tenant.gracePeriodEndsAt) {
      const now = new Date();
      const graceEnd = new Date(tenant.gracePeriodEndsAt);
      const diffMs = graceEnd.getTime() - now.getTime();
      daysUntilGracePeriodEnds = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );
    }

    return {
      billingStatus: tenant.billingStatus,
      commissionRate: tenant.commissionRate,
      commissionBalance: tenant.commissionBalance,
      freeTierLimit: tenant.freeTierLimit,
      freeTierExceededAt: tenant.freeTierExceededAt,
      gracePeriodEndsAt: tenant.gracePeriodEndsAt,
      freeTierUsedPercent,
      daysUntilGracePeriodEnds,
    };
  }
);

/**
 * Get paginated commission transactions for a tenant
 */
export const getCommissionTransactions = cache(
  async (
    tenantId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{
    transactions: CommissionTransactionItem[];
    pagination: TransactionPagination;
  }> => {
    const page = options?.page || 1;
    const limit = options?.limit || 25;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db
      .select({ count: drizzleCount() })
      .from(commissionTransactions)
      .where(eq(commissionTransactions.tenantId, tenantId));

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get transactions with order join
    const transactions = await db
      .select({
        id: commissionTransactions.id,
        type: commissionTransactions.type,
        amount: commissionTransactions.amount,
        balanceAfter: commissionTransactions.balanceAfter,
        orderId: commissionTransactions.orderId,
        orderNumber: orders.orderNumber,
        description: commissionTransactions.description,
        createdAt: commissionTransactions.createdAt,
      })
      .from(commissionTransactions)
      .leftJoin(orders, eq(commissionTransactions.orderId, orders.id))
      .where(eq(commissionTransactions.tenantId, tenantId))
      .orderBy(desc(commissionTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
);
