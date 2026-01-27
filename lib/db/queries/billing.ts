import { cache } from "react";
import { eq, count as drizzleCount, desc, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tenants,
  products,
  billingTransactions,
  invoices,
  user,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type BillingTransaction,
  type Invoice,
  type BillingTransactionType,
  type BillingTransactionStatus,
  type InvoiceStatus,
} from "@/lib/db/schema";

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

export type SubscriptionOverview = {
  // Plan info
  plan: SubscriptionPlan;
  status: SubscriptionStatus;

  // Trial info
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemainingInTrial: number | null;
  isTrialExpired: boolean;

  // Subscription period info
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  daysRemainingInPeriod: number | null;

  // Admin notes
  subscriptionNotes: string | null;

  // Usage limits
  productCount: number;
  productLimit: number | null; // null = unlimited
  productLimitReached: boolean;

  // Platform settings (for display)
  proPlanPriceAfn: string;
  freeProductLimit: number;
  trialDurationDays: number;
};

export type PlanFeature = {
  name: string;
  free: string | boolean;
  pro: string | boolean;
};

// =============================================================================
// SUBSCRIPTION QUERIES
// =============================================================================

/**
 * Get subscription overview for a tenant
 */
export const getSubscriptionOverview = cache(
  async (tenantId: string): Promise<SubscriptionOverview | null> => {
    // Fetch tenant and platform settings in parallel
    const [tenant, settings, productCountResult] = await Promise.all([
      db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialStartedAt: true,
          trialEndsAt: true,
          subscriptionStartedAt: true,
          subscriptionEndsAt: true,
          subscriptionNotes: true,
        },
      }),
      db.query.platformSettings.findFirst(),
      db
        .select({ count: drizzleCount() })
        .from(products)
        .where(eq(products.tenantId, tenantId)),
    ]);

    if (!tenant) return null;

    // Default platform settings
    const platformDefaults = {
      proPlanPriceAfn: "1100",
      freeProductLimit: 20,
      trialDurationDays: 7,
    };

    const proPlanPriceAfn =
      settings?.proPlanPriceAfn ?? platformDefaults.proPlanPriceAfn;
    const freeProductLimit =
      settings?.freeProductLimit ?? platformDefaults.freeProductLimit;
    const trialDurationDays =
      settings?.trialDurationDays ?? platformDefaults.trialDurationDays;

    const productCount = productCountResult[0]?.count ?? 0;
    const now = new Date();

    // Calculate trial days remaining
    let daysRemainingInTrial: number | null = null;
    let isTrialExpired = false;

    if (tenant.trialEndsAt) {
      const trialEnd = new Date(tenant.trialEndsAt);
      const diffMs = trialEnd.getTime() - now.getTime();
      daysRemainingInTrial = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isTrialExpired = daysRemainingInTrial < 0;
      daysRemainingInTrial = Math.max(0, daysRemainingInTrial);
    }

    // Calculate subscription period days remaining
    let daysRemainingInPeriod: number | null = null;
    if (tenant.subscriptionEndsAt) {
      const periodEnd = new Date(tenant.subscriptionEndsAt);
      const diffMs = periodEnd.getTime() - now.getTime();
      daysRemainingInPeriod = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );
    }

    // Calculate product limit based on plan
    const productLimit =
      tenant.subscriptionPlan === "free" ? freeProductLimit : null;
    const productLimitReached =
      productLimit !== null && productCount >= productLimit;

    return {
      plan: tenant.subscriptionPlan,
      status: tenant.subscriptionStatus,
      trialStartedAt: tenant.trialStartedAt,
      trialEndsAt: tenant.trialEndsAt,
      daysRemainingInTrial,
      isTrialExpired,
      subscriptionStartedAt: tenant.subscriptionStartedAt,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
      daysRemainingInPeriod,
      subscriptionNotes: tenant.subscriptionNotes,
      productCount,
      productLimit,
      productLimitReached,
      proPlanPriceAfn,
      freeProductLimit,
      trialDurationDays,
    };
  }
);

/**
 * Get plan features comparison for display
 */
export function getPlanFeatures(freeProductLimit: number): PlanFeature[] {
  return [
    {
      name: "Products",
      free: `Up to ${freeProductLimit}`,
      pro: "Unlimited",
    },
    {
      name: "Online checkout",
      free: true,
      pro: true,
    },
    {
      name: "Offline/POS sales",
      free: true,
      pro: true,
    },
    {
      name: "Order management",
      free: true,
      pro: true,
    },
    {
      name: "Analytics dashboard",
      free: true,
      pro: true,
    },
    {
      name: "Custom branding",
      free: true,
      pro: true,
    },
    {
      name: "Team members",
      free: true,
      pro: true,
    },
    {
      name: "Delivery zones",
      free: true,
      pro: true,
    },
    {
      name: "Priority support",
      free: false,
      pro: true,
    },
  ];
}

/**
 * Check if a tenant can add more products based on their plan
 */
export const canAddProduct = cache(
  async (tenantId: string): Promise<{ allowed: boolean; reason?: string }> => {
    const overview = await getSubscriptionOverview(tenantId);

    if (!overview) {
      return { allowed: false, reason: "Store not found" };
    }

    // Check subscription status
    if (overview.status === "expired") {
      return {
        allowed: false,
        reason:
          "Your trial has expired. Please upgrade to continue adding products.",
      };
    }

    // Check product limit for free plan
    if (overview.productLimitReached) {
      return {
        allowed: false,
        reason: `You've reached the limit of ${overview.productLimit} products on the free plan. Upgrade to Pro for unlimited products.`,
      };
    }

    return { allowed: true };
  }
);

/**
 * Check if a user can create more stores
 * Platform-level limit to prevent abuse (configurable in admin settings)
 * Each store has its own subscription (per-store billing model)
 */
export const canAddStore = cache(
  async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    // Fetch user's store count and platform settings in parallel
    const [userStores, settings] = await Promise.all([
      db.query.tenants.findMany({
        where: eq(tenants.ownerId, userId),
        columns: { id: true },
      }),
      db.query.platformSettings.findFirst(),
    ]);

    const maxStoresPerUser = settings?.freeStoreLimit ?? 5;
    const currentStoreCount = userStores.length;

    // Platform-level limit (not subscription-based)
    if (currentStoreCount >= maxStoresPerUser) {
      return {
        allowed: false,
        reason: `You've reached the maximum of ${maxStoresPerUser} store${maxStoresPerUser === 1 ? "" : "s"} per account. Contact support if you need more.`,
      };
    }

    return { allowed: true };
  }
);

// =============================================================================
// BILLING HISTORY TYPES
// =============================================================================

export type BillingTransactionWithAdmin = BillingTransaction & {
  processedByName: string | null;
};

export type InvoiceWithStats = Invoice & {
  amountDue: number;
};

// =============================================================================
// BILLING HISTORY QUERIES
// =============================================================================

/**
 * Get billing transaction history for a tenant
 * Returns transactions sorted by date (newest first)
 */
export const getBillingTransactions = cache(
  async (
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: BillingTransactionType;
      status?: BillingTransactionStatus;
    }
  ): Promise<{
    transactions: BillingTransactionWithAdmin[];
    total: number;
  }> => {
    const { limit = 20, offset = 0, type, status } = options ?? {};

    // Build where conditions
    const conditions = [eq(billingTransactions.tenantId, tenantId)];
    if (type) conditions.push(eq(billingTransactions.type, type));
    if (status) conditions.push(eq(billingTransactions.status, status));

    // Fetch transactions and total count in parallel
    const [transactionResults, countResult] = await Promise.all([
      db
        .select({
          id: billingTransactions.id,
          tenantId: billingTransactions.tenantId,
          type: billingTransactions.type,
          amount: billingTransactions.amount,
          currency: billingTransactions.currency,
          paymentMethod: billingTransactions.paymentMethod,
          paymentReference: billingTransactions.paymentReference,
          periodStart: billingTransactions.periodStart,
          periodEnd: billingTransactions.periodEnd,
          fromPlan: billingTransactions.fromPlan,
          toPlan: billingTransactions.toPlan,
          status: billingTransactions.status,
          invoiceId: billingTransactions.invoiceId,
          processedBy: billingTransactions.processedBy,
          notes: billingTransactions.notes,
          createdAt: billingTransactions.createdAt,
          updatedAt: billingTransactions.updatedAt,
          processedByName: user.name,
        })
        .from(billingTransactions)
        .leftJoin(user, eq(billingTransactions.processedBy, user.id))
        .where(and(...conditions))
        .orderBy(desc(billingTransactions.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: drizzleCount() })
        .from(billingTransactions)
        .where(and(...conditions)),
    ]);

    return {
      transactions: transactionResults,
      total: countResult[0]?.count ?? 0,
    };
  }
);

/**
 * Get invoices for a tenant
 * Returns invoices sorted by date (newest first)
 */
export const getInvoices = cache(
  async (
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: InvoiceStatus;
    }
  ): Promise<{ invoices: InvoiceWithStats[]; total: number }> => {
    const { limit = 20, offset = 0, status } = options ?? {};

    // Build where conditions
    const conditions = [eq(invoices.tenantId, tenantId)];
    if (status) conditions.push(eq(invoices.status, status));

    // Fetch invoices and total count in parallel
    const [invoiceResults, countResult] = await Promise.all([
      db.query.invoices.findMany({
        where: and(...conditions),
        orderBy: [desc(invoices.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: drizzleCount() })
        .from(invoices)
        .where(and(...conditions)),
    ]);

    // Calculate amount due for each invoice
    const invoicesWithStats: InvoiceWithStats[] = invoiceResults.map(
      (invoice) => ({
        ...invoice,
        amountDue:
          parseFloat(invoice.total) - parseFloat(invoice.paidAmount ?? "0"),
      })
    );

    return {
      invoices: invoicesWithStats,
      total: countResult[0]?.count ?? 0,
    };
  }
);

/**
 * Get a single invoice by ID (for download/detail view)
 */
export const getInvoiceById = cache(
  async (invoiceId: string, tenantId: string): Promise<Invoice | null> => {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
    });

    return invoice ?? null;
  }
);

/**
 * Get billing summary stats for a tenant
 */
export const getBillingSummary = cache(
  async (
    tenantId: string
  ): Promise<{
    totalPaid: number;
    invoicesPending: number;
    lastPaymentDate: string | null;
    lastPaymentAmount: number | null;
  }> => {
    // Get total paid from completed transactions
    const [totalPaidResult, pendingInvoicesResult, lastPaymentResult] =
      await Promise.all([
        db
          .select({
            total: sql<string>`COALESCE(SUM(${billingTransactions.amount}), 0)`,
          })
          .from(billingTransactions)
          .where(
            and(
              eq(billingTransactions.tenantId, tenantId),
              eq(billingTransactions.status, "completed"),
              eq(billingTransactions.type, "subscription_payment")
            )
          ),
        db
          .select({ count: drizzleCount() })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              sql`${invoices.status} IN ('sent', 'overdue', 'partially_paid')`
            )
          ),
        db
          .select({
            createdAt: billingTransactions.createdAt,
            amount: billingTransactions.amount,
          })
          .from(billingTransactions)
          .where(
            and(
              eq(billingTransactions.tenantId, tenantId),
              eq(billingTransactions.status, "completed"),
              eq(billingTransactions.type, "subscription_payment")
            )
          )
          .orderBy(desc(billingTransactions.createdAt))
          .limit(1),
      ]);

    return {
      totalPaid: parseFloat(totalPaidResult[0]?.total ?? "0"),
      invoicesPending: pendingInvoicesResult[0]?.count ?? 0,
      lastPaymentDate: lastPaymentResult[0]?.createdAt ?? null,
      lastPaymentAmount: lastPaymentResult[0]?.amount
        ? parseFloat(lastPaymentResult[0].amount)
        : null,
    };
  }
);

/**
 * Generate next invoice number for a tenant
 * Format: INV-{YEAR}-{SEQUENCE}
 */
export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Get the count of invoices for this tenant this year
  const result = await db
    .select({ count: drizzleCount() })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        sql`EXTRACT(YEAR FROM ${invoices.createdAt}) = ${year}`
      )
    );

  const sequence = (result[0]?.count ?? 0) + 1;
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}
