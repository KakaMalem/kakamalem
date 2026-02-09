import { db } from "@/lib/db";
import { refunds, orderItems } from "@/lib/db/schema";
import type { RefundStatus } from "@/lib/db/schema";
import { eq, and, desc, sql, count, sum } from "drizzle-orm";

// =============================================================================
// REFUND QUERIES
// =============================================================================

/**
 * Get refunds for a tenant with optional filters
 */
export async function getRefundsByTenant(
  tenantId: string,
  options?: {
    status?: RefundStatus;
    page?: number;
    limit?: number;
    orderId?: string;
  }
) {
  const { status, page = 1, limit = 20, orderId } = options || {};
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(refunds.tenantId, tenantId)];
  if (status) {
    conditions.push(eq(refunds.status, status));
  }
  if (orderId) {
    conditions.push(eq(refunds.orderId, orderId));
  }

  const whereClause = and(...conditions);

  // Get refunds with order info
  const refundList = await db.query.refunds.findMany({
    where: whereClause,
    with: {
      order: {
        columns: {
          id: true,
          orderNumber: true,
          total: true,
          customerSnapshot: true,
        },
      },
      items: {
        with: {
          orderItem: {
            columns: {
              id: true,
              productName: true,
              quantity: true,
              price: true,
            },
          },
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      processedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: desc(refunds.requestedAt),
    limit,
    offset,
  });

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(refunds)
    .where(whereClause);

  return {
    refunds: refundList,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

/**
 * Get refunds for a specific order
 */
export async function getRefundsByOrderId(orderId: string) {
  return db.query.refunds.findMany({
    where: eq(refunds.orderId, orderId),
    with: {
      items: {
        with: {
          orderItem: {
            columns: {
              id: true,
              productName: true,
              variantName: true,
              quantity: true,
              price: true,
            },
          },
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      processedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      approvedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      rejectedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: desc(refunds.requestedAt),
  });
}

/**
 * Get a single refund by ID
 */
export async function getRefundById(refundId: string) {
  return db.query.refunds.findFirst({
    where: eq(refunds.id, refundId),
    with: {
      order: {
        columns: {
          id: true,
          orderNumber: true,
          total: true,
          paymentStatus: true,
          customerSnapshot: true,
          currencyCode: true,
        },
      },
      items: {
        with: {
          orderItem: {
            columns: {
              id: true,
              productName: true,
              variantName: true,
              quantity: true,
              price: true,
              quantityRefunded: true,
            },
          },
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      processedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      rejectedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get refund statistics for a tenant
 */
export async function getRefundStats(tenantId: string) {
  // Get counts by status
  const statusCounts = await db
    .select({
      status: refunds.status,
      count: count(),
      totalAmount: sum(refunds.totalAmount),
    })
    .from(refunds)
    .where(eq(refunds.tenantId, tenantId))
    .groupBy(refunds.status);

  // Calculate totals
  let totalRefunds = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let processingCount = 0;
  let completedCount = 0;
  let rejectedCount = 0;
  let totalRefundedAmount = 0;

  statusCounts.forEach((stat) => {
    const c = Number(stat.count);
    const amount = parseFloat(stat.totalAmount || "0");
    totalRefunds += c;

    switch (stat.status) {
      case "pending":
        pendingCount = c;
        break;
      case "approved":
        approvedCount = c;
        break;
      case "processing":
        processingCount = c;
        break;
      case "completed":
        completedCount = c;
        totalRefundedAmount = amount;
        break;
      case "rejected":
        rejectedCount = c;
        break;
    }
  });

  // Get recent refunds (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentStats] = await db
    .select({
      count: count(),
      totalAmount: sum(refunds.totalAmount),
    })
    .from(refunds)
    .where(
      and(
        eq(refunds.tenantId, tenantId),
        eq(refunds.status, "completed"),
        sql`${refunds.processedAt} >= ${thirtyDaysAgo.toISOString()}`
      )
    );

  return {
    totalRefunds,
    pendingCount,
    approvedCount,
    processingCount,
    completedCount,
    rejectedCount,
    totalRefundedAmount,
    last30Days: {
      count: Number(recentStats?.count || 0),
      amount: parseFloat(recentStats?.totalAmount || "0"),
    },
  };
}

/**
 * Generate a unique refund number
 */
export function generateRefundNumber(storeSlug: string): string {
  const prefix = storeSlug.slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `REF-${prefix}-${year}-${timestamp}${random}`;
}

/**
 * Get refundable items for an order (items not yet fully refunded)
 */
export async function getRefundableItems(orderId: string) {
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
    columns: {
      id: true,
      productName: true,
      variantName: true,
      quantity: true,
      quantityRefunded: true,
      price: true,
      lineSubtotal: true,
      taxAmount: true,
    },
  });

  // Filter to items that have refundable quantity
  return items.filter((item) => item.quantity > (item.quantityRefunded || 0));
}
