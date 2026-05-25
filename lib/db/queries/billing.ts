import { cache } from "react";
import { eq, count as drizzleCount, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
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
  billingInterval: "monthly" | "yearly";

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

  // Pricing from platform settings (AFN)
  proPlanPriceAfn: string;
  proPlanYearlyPriceAfn: string;
  freeProductLimit: number;
  trialDurationDays: number;

  // Whether yearly pricing is available
  hasYearlyOption: boolean;

  // Subscription management
  isPaused: boolean;
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
 *
 * Pricing comes from platform settings (AFN). Buyers pay via HesabPay's
 * hosted checkout.
 */
export const getSubscriptionOverview = cache(
  async (tenantId: string): Promise<SubscriptionOverview | null> => {
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
          billingInterval: true,
          pausedAt: true,
        },
      }),
      db.query.platformSettings.findFirst(),
      db
        .select({ count: drizzleCount() })
        .from(products)
        .where(eq(products.tenantId, tenantId)),
    ]);

    if (!tenant) return null;

    const platformDefaults = {
      proPlanPriceAfn: "1100",
      proPlanYearlyPriceAfn: "12000",
      freeProductLimit: 20,
      trialDurationDays: 7,
    };

    const proPlanPriceAfn =
      settings?.proPlanPriceAfn ?? platformDefaults.proPlanPriceAfn;
    const proPlanYearlyPriceAfn =
      settings?.proPlanYearlyPriceAfn ?? platformDefaults.proPlanYearlyPriceAfn;
    const freeProductLimit =
      settings?.freeProductLimit ?? platformDefaults.freeProductLimit;
    const trialDurationDays =
      settings?.trialDurationDays ?? platformDefaults.trialDurationDays;

    const productCount = productCountResult[0]?.count ?? 0;
    const now = new Date();

    let daysRemainingInTrial: number | null = null;
    let isTrialExpired = false;

    if (tenant.trialEndsAt) {
      const trialEnd = new Date(tenant.trialEndsAt);
      const diffMs = trialEnd.getTime() - now.getTime();
      daysRemainingInTrial = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isTrialExpired = daysRemainingInTrial < 0;
      daysRemainingInTrial = Math.max(0, daysRemainingInTrial);
    }

    let daysRemainingInPeriod: number | null = null;
    if (tenant.subscriptionEndsAt) {
      const periodEnd = new Date(tenant.subscriptionEndsAt);
      const diffMs = periodEnd.getTime() - now.getTime();
      daysRemainingInPeriod = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      );
    }

    const productLimit = null;
    const productLimitReached = false;

    const hasYearlyOption = parseFloat(proPlanYearlyPriceAfn) > 0;

    return {
      plan: tenant.subscriptionPlan,
      status: tenant.subscriptionStatus,
      billingInterval:
        (tenant.billingInterval as "monthly" | "yearly") || "monthly",
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
      proPlanYearlyPriceAfn,
      freeProductLimit,
      trialDurationDays,
      hasYearlyOption,
      isPaused: !!tenant.pausedAt,
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
 * Check if a tenant can add more products — always allowed (no limits)
 */
export const canAddProduct = cache(
  async (_tenantId: string): Promise<{ allowed: boolean; reason?: string }> => {
    return { allowed: true };
  }
);

/**
 * Check if a user can create more stores
 * Per-store billing model: users can create unlimited stores,
 * each with its own subscription/trial
 */
export const canAddStore = cache(
  async (_userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    // No limit on store creation - each store has its own subscription
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
              sql`${invoices.status} IN ('unpaid', 'overdue', 'partially_paid')`
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
 * Generate a 3-character uppercase code from a store slug
 * Examples: "sample-store" → "SAM", "kabul-electronics" → "KAB", "az" → "AZZ"
 */
function generateStoreCode(slug: string): string {
  // Remove hyphens and get alphanumeric only
  const clean = slug.replace(/-/g, "").toUpperCase();
  // Take first 3 chars, pad with 'X' if too short
  return clean.slice(0, 3).padEnd(3, "X");
}

/**
 * Generate invoice number with tenant prefix and nanoid for uniqueness
 * Format: INV-{STORE_CODE}-{YEAR}-{NANOID}
 * Example: INV-SAM-2026-k5xvh8yq
 *
 * Benefits:
 * - Non-guessable (can't enumerate other invoices)
 * - No race conditions (nanoid is always unique)
 * - Quick store identification for support/debugging
 * - Human-readable with store prefix and year
 */
export function generateInvoiceNumber(storeSlug: string): string {
  const storeCode = generateStoreCode(storeSlug);
  const year = new Date().getFullYear();
  // 8-char nanoid gives ~2.8 trillion possibilities - collision-proof
  const id = nanoid(8);
  return `INV-${storeCode}-${year}-${id}`;
}
