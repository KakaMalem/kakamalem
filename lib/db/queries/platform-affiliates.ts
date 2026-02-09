"use server";

import { db } from "@/lib/db";
import {
  platformAffiliates,
  platformAffiliateClicks,
  platformAffiliateReferrals,
  platformAffiliateCommissions,
  platformAffiliatePayouts,
  reservedSlugs,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, count, sum, or, ilike } from "drizzle-orm";
import type {
  AffiliateListFilterInput,
  ReferralListFilterInput,
  CommissionListFilterInput,
  PayoutListFilterInput,
} from "@/lib/validations/platform-affiliates";

// =============================================================================
// TYPES
// =============================================================================

export type PlatformAffiliateWithDetails = Awaited<
  ReturnType<typeof getPlatformAffiliateById>
>;

export type PlatformAffiliateListItem = Awaited<
  ReturnType<typeof getPlatformAffiliatesForAdmin>
>["items"][number];

export type PlatformAffiliateReferralWithTenant = Awaited<
  ReturnType<typeof getAffiliateReferrals>
>["items"][number];

export type PlatformAffiliateCommissionWithDetails = Awaited<
  ReturnType<typeof getAffiliateCommissions>
>["items"][number];

export type PlatformAffiliatePayoutWithDetails = Awaited<
  ReturnType<typeof getAffiliatePayouts>
>["items"][number];

// =============================================================================
// PUBLIC QUERIES
// =============================================================================

/**
 * Get a platform affiliate by their slug (for vanity URL routing)
 */
export async function getPlatformAffiliateBySlug(slug: string) {
  return db.query.platformAffiliates.findFirst({
    where: and(
      eq(platformAffiliates.slug, slug.toLowerCase()),
      eq(platformAffiliates.status, "approved")
    ),
    columns: {
      id: true,
      slug: true,
      displayName: true,
      cookieDurationDays: true,
    },
  });
}

/**
 * Check if a slug is available (not reserved and not taken)
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const normalizedSlug = slug.toLowerCase().trim();

  // Check reserved slugs
  const reserved = await db.query.reservedSlugs.findFirst({
    where: eq(reservedSlugs.slug, normalizedSlug),
  });

  if (reserved) {
    return false;
  }

  // Check if already taken by another affiliate
  const existing = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.slug, normalizedSlug),
    columns: { id: true },
  });

  return !existing;
}

/**
 * Get all reserved slugs (for client-side validation)
 */
export async function getReservedSlugs(): Promise<string[]> {
  const slugs = await db.query.reservedSlugs.findMany({
    columns: { slug: true },
  });
  return slugs.map((s) => s.slug);
}

// =============================================================================
// AFFILIATE DASHBOARD QUERIES
// =============================================================================

/**
 * Get platform affiliate by user ID
 */
export async function getPlatformAffiliateByUserId(userId: string) {
  return db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.userId, userId),
  });
}

/**
 * Get platform affiliate by ID with full details
 */
export async function getPlatformAffiliateById(affiliateId: string) {
  return db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.id, affiliateId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get affiliate dashboard stats
 */
export async function getAffiliateDashboardStats(affiliateId: string) {
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.id, affiliateId),
    columns: {
      totalClicks: true,
      totalSignups: true,
      successfulReferrals: true,
      totalEarned: true,
      totalPending: true,
      totalPaidOut: true,
      currentTier: true,
      currentCommissionRate: true,
    },
  });

  if (!affiliate) {
    return null;
  }

  // Get available balance (commissions that are available but not yet paid)
  const availableResult = await db
    .select({
      total: sum(platformAffiliateCommissions.commissionAmount),
    })
    .from(platformAffiliateCommissions)
    .where(
      and(
        eq(platformAffiliateCommissions.affiliateId, affiliateId),
        eq(platformAffiliateCommissions.status, "available")
      )
    );

  const availableBalance = availableResult[0]?.total || "0.00";

  // Get recent clicks (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentClicksResult = await db
    .select({ count: count() })
    .from(platformAffiliateClicks)
    .where(
      and(
        eq(platformAffiliateClicks.affiliateId, affiliateId),
        sql`${platformAffiliateClicks.clickedAt} >= ${thirtyDaysAgo.toISOString()}`
      )
    );

  const recentClicks = recentClicksResult[0]?.count || 0;

  return {
    ...affiliate,
    availableBalance,
    recentClicks,
  };
}

/**
 * Get affiliate referrals with tenant details
 */
export async function getAffiliateReferrals(
  affiliateId: string,
  filter: ReferralListFilterInput = { page: 1, limit: 20 }
) {
  const { status, page, limit } = filter;
  const offset = (page - 1) * limit;

  const whereClause = status
    ? and(
        eq(platformAffiliateReferrals.affiliateId, affiliateId),
        eq(platformAffiliateReferrals.status, status)
      )
    : eq(platformAffiliateReferrals.affiliateId, affiliateId);

  const [items, totalResult] = await Promise.all([
    db.query.platformAffiliateReferrals.findMany({
      where: whereClause,
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true,
            subscriptionStatus: true,
          },
        },
      },
      orderBy: [desc(platformAffiliateReferrals.signedUpAt)],
      limit,
      offset,
    }),
    db
      .select({ count: count() })
      .from(platformAffiliateReferrals)
      .where(whereClause),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get affiliate commissions
 */
export async function getAffiliateCommissions(
  affiliateId: string,
  filter: CommissionListFilterInput = { page: 1, limit: 20 }
) {
  const { status, page, limit } = filter;
  const offset = (page - 1) * limit;

  const whereClause = status
    ? and(
        eq(platformAffiliateCommissions.affiliateId, affiliateId),
        eq(platformAffiliateCommissions.status, status)
      )
    : eq(platformAffiliateCommissions.affiliateId, affiliateId);

  const [items, totalResult] = await Promise.all([
    db.query.platformAffiliateCommissions.findMany({
      where: whereClause,
      with: {
        referral: {
          with: {
            tenant: {
              columns: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: [desc(platformAffiliateCommissions.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: count() })
      .from(platformAffiliateCommissions)
      .where(whereClause),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get affiliate payouts
 */
export async function getAffiliatePayouts(
  affiliateId: string,
  filter: PayoutListFilterInput = { page: 1, limit: 20 }
) {
  const { status, page, limit } = filter;
  const offset = (page - 1) * limit;

  const whereClause = status
    ? and(
        eq(platformAffiliatePayouts.affiliateId, affiliateId),
        eq(platformAffiliatePayouts.status, status)
      )
    : eq(platformAffiliatePayouts.affiliateId, affiliateId);

  const [items, totalResult] = await Promise.all([
    db.query.platformAffiliatePayouts.findMany({
      where: whereClause,
      orderBy: [desc(platformAffiliatePayouts.requestedAt)],
      limit,
      offset,
    }),
    db
      .select({ count: count() })
      .from(platformAffiliatePayouts)
      .where(whereClause),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get available commissions for payout
 */
export async function getAvailableCommissionsForPayout(affiliateId: string) {
  return db.query.platformAffiliateCommissions.findMany({
    where: and(
      eq(platformAffiliateCommissions.affiliateId, affiliateId),
      eq(platformAffiliateCommissions.status, "available")
    ),
    orderBy: [asc(platformAffiliateCommissions.createdAt)],
  });
}

// =============================================================================
// ADMIN QUERIES
// =============================================================================

/**
 * Get paginated list of platform affiliates for admin
 */
export async function getPlatformAffiliatesForAdmin(
  filter: AffiliateListFilterInput = {
    page: 1,
    limit: 20,
    sortBy: "appliedAt",
    sortOrder: "desc",
  }
) {
  const { status, tier, search, page, limit, sortBy, sortOrder } = filter;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];
  if (status) {
    conditions.push(eq(platformAffiliates.status, status));
  }
  if (tier) {
    conditions.push(eq(platformAffiliates.currentTier, tier));
  }
  if (search) {
    conditions.push(
      or(
        ilike(platformAffiliates.displayName, `%${search}%`),
        ilike(platformAffiliates.slug, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order by
  const orderByColumn = {
    createdAt: platformAffiliates.createdAt,
    appliedAt: platformAffiliates.appliedAt,
    successfulReferrals: platformAffiliates.successfulReferrals,
    totalEarned: platformAffiliates.totalEarned,
    displayName: platformAffiliates.displayName,
  }[sortBy];

  const orderByFn = sortOrder === "asc" ? asc : desc;

  const [items, totalResult] = await Promise.all([
    db.query.platformAffiliates.findMany({
      where: whereClause,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [orderByFn(orderByColumn)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(platformAffiliates).where(whereClause),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get pending affiliate applications count
 */
export async function getPendingApplicationsCount(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(platformAffiliates)
    .where(eq(platformAffiliates.status, "pending"));

  return result[0]?.count || 0;
}

/**
 * Get pending payouts for admin
 */
export async function getPendingPayoutsForAdmin(
  filter: PayoutListFilterInput = { page: 1, limit: 20 }
) {
  const { status = "pending", page, limit } = filter;
  const offset = (page - 1) * limit;

  const [items, totalResult] = await Promise.all([
    db.query.platformAffiliatePayouts.findMany({
      where: eq(platformAffiliatePayouts.status, status),
      with: {
        affiliate: {
          columns: {
            id: true,
            displayName: true,
            slug: true,
          },
          with: {
            user: {
              columns: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: [asc(platformAffiliatePayouts.requestedAt)],
      limit,
      offset,
    }),
    db
      .select({ count: count() })
      .from(platformAffiliatePayouts)
      .where(eq(platformAffiliatePayouts.status, status)),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get platform affiliate stats summary for admin dashboard
 */
export async function getPlatformAffiliateStatsSummary() {
  const [
    totalAffiliates,
    pendingApplications,
    activeAffiliates,
    totalEarned,
    totalPaidOut,
    pendingPayouts,
  ] = await Promise.all([
    db.select({ count: count() }).from(platformAffiliates),
    db
      .select({ count: count() })
      .from(platformAffiliates)
      .where(eq(platformAffiliates.status, "pending")),
    db
      .select({ count: count() })
      .from(platformAffiliates)
      .where(eq(platformAffiliates.status, "approved")),
    db
      .select({ total: sum(platformAffiliates.totalEarned) })
      .from(platformAffiliates),
    db
      .select({ total: sum(platformAffiliates.totalPaidOut) })
      .from(platformAffiliates),
    db
      .select({ count: count() })
      .from(platformAffiliatePayouts)
      .where(eq(platformAffiliatePayouts.status, "pending")),
  ]);

  return {
    totalAffiliates: totalAffiliates[0]?.count || 0,
    pendingApplications: pendingApplications[0]?.count || 0,
    activeAffiliates: activeAffiliates[0]?.count || 0,
    totalEarned: totalEarned[0]?.total || "0.00",
    totalPaidOut: totalPaidOut[0]?.total || "0.00",
    pendingPayouts: pendingPayouts[0]?.count || 0,
  };
}

// =============================================================================
// SYSTEM QUERIES (for background jobs)
// =============================================================================

/**
 * Get referrals that need retention check (30 days after first payment)
 */
export async function getReferralsForRetentionCheck() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return db.query.platformAffiliateReferrals.findMany({
    where: and(
      eq(platformAffiliateReferrals.retentionPassed, false),
      sql`${platformAffiliateReferrals.firstPaidAt} IS NOT NULL`,
      sql`${platformAffiliateReferrals.firstPaidAt} <= ${thirtyDaysAgo.toISOString()}`
    ),
    with: {
      tenant: {
        columns: {
          id: true,
          subscriptionStatus: true,
        },
      },
      affiliate: {
        columns: {
          id: true,
          successfulReferrals: true,
          currentTier: true,
        },
      },
    },
  });
}

/**
 * Get referrals with active commission period
 */
export async function getActiveReferrals() {
  const now = new Date().toISOString();

  return db.query.platformAffiliateReferrals.findMany({
    where: and(
      eq(platformAffiliateReferrals.isActive, true),
      eq(platformAffiliateReferrals.retentionPassed, true),
      sql`${platformAffiliateReferrals.commissionEndsAt} > ${now}`
    ),
  });
}

/**
 * Get referral by tenant ID
 */
export async function getReferralByTenantId(tenantId: string) {
  return db.query.platformAffiliateReferrals.findFirst({
    where: eq(platformAffiliateReferrals.tenantId, tenantId),
    with: {
      affiliate: {
        columns: {
          id: true,
          currentCommissionRate: true,
        },
      },
    },
  });
}

/**
 * Get next payout number
 */
export async function getNextPayoutNumber(): Promise<string> {
  const result = await db
    .select({ payoutNumber: platformAffiliatePayouts.payoutNumber })
    .from(platformAffiliatePayouts)
    .orderBy(desc(platformAffiliatePayouts.createdAt))
    .limit(1);

  if (result.length === 0) {
    return "PAF-0001";
  }

  const lastNumber = result[0].payoutNumber;
  const numericPart = parseInt(lastNumber.replace("PAF-", ""), 10);
  return `PAF-${String(numericPart + 1).padStart(4, "0")}`;
}
