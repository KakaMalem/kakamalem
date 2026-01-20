import { cache } from "react";
import { eq, count as drizzleCount } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tenants,
  products,
  type SubscriptionPlan,
  type SubscriptionStatus,
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
      name: "Stores",
      free: "1 store",
      pro: "Multiple stores",
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
