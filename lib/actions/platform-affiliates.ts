"use server";

import { db } from "@/lib/db";
import {
  platformAffiliates,
  platformAffiliateClicks,
  reservedSlugs,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  affiliateApplicationSchema,
  type AffiliateApplicationInput,
  trackClickSchema,
  type TrackClickInput,
} from "@/lib/validations/platform-affiliates";
import { getUser } from "@/lib/auth/server";
import {
  isValidAffiliateSlug,
  RESERVED_SLUGS,
} from "@/lib/affiliate/constants";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Check if a slug is available for use as an affiliate vanity URL
 */
export async function checkSlugAvailability(
  slug: string
): Promise<ActionResult<{ available: boolean; suggestion?: string }>> {
  const normalizedSlug = slug.toLowerCase().trim();

  // Validate slug format
  const validation = isValidAffiliateSlug(normalizedSlug);
  if (!validation.valid) {
    return {
      success: true,
      data: { available: false },
    };
  }

  // Check if slug is reserved in our hardcoded list
  if (RESERVED_SLUGS.has(normalizedSlug)) {
    return {
      success: true,
      data: { available: false },
    };
  }

  try {
    // Check database for reserved slugs
    const reservedInDb = await db.query.reservedSlugs.findFirst({
      where: eq(reservedSlugs.slug, normalizedSlug),
    });

    if (reservedInDb) {
      return {
        success: true,
        data: { available: false },
      };
    }

    // Check if slug is already taken by another affiliate
    const existingAffiliate = await db.query.platformAffiliates.findFirst({
      where: eq(platformAffiliates.slug, normalizedSlug),
      columns: { id: true },
    });

    if (existingAffiliate) {
      // Generate a suggestion by appending a number
      let suggestion = normalizedSlug;
      let counter = 1;
      while (counter < 100) {
        suggestion = `${normalizedSlug}${counter}`;
        const exists = await db.query.platformAffiliates.findFirst({
          where: eq(platformAffiliates.slug, suggestion),
          columns: { id: true },
        });
        if (!exists) break;
        counter++;
      }

      return {
        success: true,
        data: { available: false, suggestion },
      };
    }

    return {
      success: true,
      data: { available: true },
    };
  } catch (error) {
    // If tables don't exist yet, assume slug is available
    console.error("Error checking slug availability:", error);
    return {
      success: true,
      data: { available: true },
    };
  }
}

/**
 * Submit an affiliate application
 */
export async function submitAffiliateApplication(
  input: AffiliateApplicationInput
): Promise<ActionResult<{ id: string }>> {
  // Get current user
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: {
        message: "You must be logged in to apply for the affiliate program",
      },
    };
  }

  // Validate input
  const result = affiliateApplicationSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const data = result.data;
  const normalizedSlug = data.slug.toLowerCase().trim();

  // Check if user already has an affiliate account
  const existingAffiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.userId, user.id),
    columns: { id: true, status: true },
  });

  if (existingAffiliate) {
    if (existingAffiliate.status === "approved") {
      return {
        success: false,
        error: { message: "You are already an approved affiliate" },
      };
    }
    if (existingAffiliate.status === "suspended") {
      return {
        success: false,
        error: {
          message:
            "Your affiliate account has been suspended. Please contact support.",
        },
      };
    }
    // If pending or rejected, allow them to re-apply by updating their record
  }

  // Check slug availability one more time (race condition protection)
  const slugAvailability = await checkSlugAvailability(normalizedSlug);
  if (!slugAvailability.data?.available) {
    return {
      success: false,
      error: {
        message: "This vanity URL is no longer available",
        field: "slug",
      },
    };
  }

  const now = new Date().toISOString();

  // Create or update affiliate record - auto-approve for easier onboarding
  if (existingAffiliate) {
    // Update existing record (for rejected affiliates re-applying)
    await db
      .update(platformAffiliates)
      .set({
        slug: normalizedSlug,
        displayName: data.displayName,
        bio: data.bio || null,
        websiteUrl: data.websiteUrl || null,
        socialLinks: data.socialLinks || null,
        applicationNotes: data.applicationNotes,
        status: "approved",
        appliedAt: now,
        approvedAt: now,
        rejectionReason: null,
      })
      .where(eq(platformAffiliates.id, existingAffiliate.id));

    return {
      success: true,
      data: { id: existingAffiliate.id },
    };
  }

  // Create new affiliate record - auto-approved
  const [affiliate] = await db
    .insert(platformAffiliates)
    .values({
      userId: user.id,
      slug: normalizedSlug,
      displayName: data.displayName,
      bio: data.bio || null,
      websiteUrl: data.websiteUrl || null,
      socialLinks: data.socialLinks || null,
      applicationNotes: data.applicationNotes,
      status: "approved",
      appliedAt: now,
      approvedAt: now,
    })
    .returning({ id: platformAffiliates.id });

  return {
    success: true,
    data: { id: affiliate.id },
  };
}

/**
 * Get affiliate by slug (for redirect page)
 */
export async function getAffiliateBySlug(
  slug: string
): Promise<ActionResult<{ id: string; displayName: string } | null>> {
  const normalizedSlug = slug.toLowerCase().trim();

  const affiliate = await db.query.platformAffiliates.findFirst({
    where: and(
      eq(platformAffiliates.slug, normalizedSlug),
      eq(platformAffiliates.status, "approved")
    ),
    columns: {
      id: true,
      displayName: true,
    },
  });

  return {
    success: true,
    data: affiliate || null,
  };
}

/**
 * Track an affiliate click
 */
export async function trackAffiliateClick(
  input: TrackClickInput
): Promise<ActionResult<{ clickId: string }>> {
  const result = trackClickSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      error: { message: "Invalid tracking data" },
    };
  }

  const data = result.data;
  const normalizedSlug = data.slug.toLowerCase().trim();

  // Find affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: and(
      eq(platformAffiliates.slug, normalizedSlug),
      eq(platformAffiliates.status, "approved")
    ),
    columns: { id: true, cookieDurationDays: true },
  });

  if (!affiliate) {
    return {
      success: false,
      error: { message: "Affiliate not found" },
    };
  }

  // Calculate cookie expiry based on affiliate's cookie duration (default 90 days)
  const cookieDays = affiliate.cookieDurationDays || 90;
  const cookieExpiresAt = new Date();
  cookieExpiresAt.setDate(cookieExpiresAt.getDate() + cookieDays);

  // Record click
  const [click] = await db
    .insert(platformAffiliateClicks)
    .values({
      affiliateId: affiliate.id,
      visitorId: data.visitorId || null,
      ipAddress: null, // We don't track IP for privacy
      userAgent: null, // We don't track UA for privacy
      referrer: data.referrer || null,
      landingPage: data.landingPage || "/",
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      utmContent: data.utmContent || null,
      cookieExpiresAt: cookieExpiresAt.toISOString(),
    })
    .returning({ id: platformAffiliateClicks.id });

  // Increment total clicks on affiliate record
  await db
    .update(platformAffiliates)
    .set({
      totalClicks: sql`${platformAffiliates.totalClicks} + 1`,
    })
    .where(eq(platformAffiliates.id, affiliate.id));

  return {
    success: true,
    data: { clickId: click.id },
  };
}

/**
 * Get current user's affiliate status
 */
export async function getCurrentUserAffiliateStatus(): Promise<
  ActionResult<{
    hasApplied: boolean;
    status?: "pending" | "approved" | "suspended" | "rejected";
    slug?: string;
  }>
> {
  const user = await getUser();
  if (!user) {
    return {
      success: true,
      data: { hasApplied: false },
    };
  }

  try {
    const affiliate = await db.query.platformAffiliates.findFirst({
      where: eq(platformAffiliates.userId, user.id),
      columns: {
        status: true,
        slug: true,
      },
    });

    if (!affiliate) {
      return {
        success: true,
        data: { hasApplied: false },
      };
    }

    return {
      success: true,
      data: {
        hasApplied: true,
        status: affiliate.status as
          | "pending"
          | "approved"
          | "suspended"
          | "rejected",
        slug: affiliate.slug,
      },
    };
  } catch (error) {
    // Handle case where table doesn't exist yet (migrations not run)
    console.error("Error checking affiliate status:", error);
    return {
      success: true,
      data: { hasApplied: false },
    };
  }
}

// =============================================================================
// ADMIN ACTIONS
// =============================================================================

import { isPlatformAdmin } from "@/lib/auth/server";
import {
  adminReviewAffiliateSchema,
  type AdminReviewAffiliateInput,
} from "@/lib/validations/platform-affiliates";
import { AFFILIATE_TIERS, AFFILIATE_CONFIG } from "@/lib/affiliate/constants";

/**
 * Admin: Approve, reject, or suspend an affiliate
 */
export async function adminReviewAffiliate(
  input: AdminReviewAffiliateInput
): Promise<ActionResult> {
  // Check admin permissions
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: { message: "You do not have permission to perform this action" },
    };
  }

  // Validate input
  const result = adminReviewAffiliateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const {
    affiliateId,
    action,
    reason,
    customCommissionRate,
    customCommissionDurationMonths,
  } = result.data;

  // Get affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.id, affiliateId),
  });

  if (!affiliate) {
    return {
      success: false,
      error: { message: "Affiliate not found" },
    };
  }

  // Perform action
  const now = new Date().toISOString();
  const adminUser = await getUser();

  switch (action) {
    case "approve":
      if (affiliate.status === "approved") {
        return {
          success: false,
          error: { message: "Affiliate is already approved" },
        };
      }

      await db
        .update(platformAffiliates)
        .set({
          status: "approved",
          approvedAt: now,
          approvedBy: adminUser?.id || null,
          currentTier: "bronze",
          currentCommissionRate:
            customCommissionRate?.toString() ||
            AFFILIATE_TIERS.bronze.commissionRate.toString(),
          commissionDurationMonths:
            customCommissionDurationMonths ||
            AFFILIATE_CONFIG.commissionDurationMonths,
        })
        .where(eq(platformAffiliates.id, affiliateId));

      break;

    case "reject":
      if (affiliate.status === "rejected") {
        return {
          success: false,
          error: { message: "Affiliate is already rejected" },
        };
      }

      await db
        .update(platformAffiliates)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
        })
        .where(eq(platformAffiliates.id, affiliateId));

      break;

    case "suspend":
      if (affiliate.status === "suspended") {
        return {
          success: false,
          error: { message: "Affiliate is already suspended" },
        };
      }

      await db
        .update(platformAffiliates)
        .set({
          status: "suspended",
          suspensionReason: reason || null,
          suspendedAt: now,
        })
        .where(eq(platformAffiliates.id, affiliateId));

      break;
  }

  return { success: true };
}

/**
 * Admin: Reactivate a suspended affiliate
 */
export async function adminReactivateAffiliate(
  affiliateId: string
): Promise<ActionResult> {
  // Check admin permissions
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: { message: "You do not have permission to perform this action" },
    };
  }

  // Get affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.id, affiliateId),
  });

  if (!affiliate) {
    return {
      success: false,
      error: { message: "Affiliate not found" },
    };
  }

  if (affiliate.status !== "suspended") {
    return {
      success: false,
      error: { message: "Only suspended affiliates can be reactivated" },
    };
  }

  await db
    .update(platformAffiliates)
    .set({
      status: "approved",
      suspensionReason: null,
      suspendedAt: null,
    })
    .where(eq(platformAffiliates.id, affiliateId));

  return { success: true };
}

/**
 * Admin: Process a payout request (approve/reject)
 */
export async function adminProcessPayout(input: {
  payoutId: string;
  action: "approve" | "reject";
  notes?: string;
}): Promise<ActionResult> {
  // Check admin permissions
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: { message: "You do not have permission to perform this action" },
    };
  }

  const { payoutId, action, notes } = input;

  // Import payout table
  const { platformAffiliatePayouts, platformAffiliateCommissions } =
    await import("@/lib/db/schema");

  // Get payout
  const payout = await db.query.platformAffiliatePayouts.findFirst({
    where: eq(platformAffiliatePayouts.id, payoutId),
  });

  if (!payout) {
    return {
      success: false,
      error: { message: "Payout not found" },
    };
  }

  if (payout.status !== "pending") {
    return {
      success: false,
      error: { message: "Only pending payouts can be processed" },
    };
  }

  const now = new Date().toISOString();
  const adminUser = await getUser();

  if (action === "approve") {
    // Mark payout as processing
    await db
      .update(platformAffiliatePayouts)
      .set({
        status: "processing",
        processedBy: adminUser?.id || null,
        adminNotes: notes || null,
        processedAt: now,
      })
      .where(eq(platformAffiliatePayouts.id, payoutId));
  } else {
    // Reject payout - return commissions to available status
    await db
      .update(platformAffiliatePayouts)
      .set({
        status: "failed",
        processedBy: adminUser?.id || null,
        adminNotes: notes || null,
        processedAt: now,
      })
      .where(eq(platformAffiliatePayouts.id, payoutId));

    // Return commissions to available status
    await db
      .update(platformAffiliateCommissions)
      .set({
        status: "available",
        payoutId: null,
      })
      .where(eq(platformAffiliateCommissions.payoutId, payoutId));

    // Update affiliate's pending amount
    await db
      .update(platformAffiliates)
      .set({
        totalPending: sql`${platformAffiliates.totalPending} - ${payout.amount}`,
      })
      .where(eq(platformAffiliates.id, payout.affiliateId));
  }

  return { success: true };
}

/**
 * Admin: Mark a payout as completed
 */
export async function adminCompletePayout(input: {
  payoutId: string;
  transactionId?: string;
  notes?: string;
}): Promise<ActionResult> {
  // Check admin permissions
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: { message: "You do not have permission to perform this action" },
    };
  }

  const { payoutId, transactionId, notes } = input;

  // Import payout table
  const { platformAffiliatePayouts, platformAffiliateCommissions } =
    await import("@/lib/db/schema");

  // Get payout
  const payout = await db.query.platformAffiliatePayouts.findFirst({
    where: eq(platformAffiliatePayouts.id, payoutId),
  });

  if (!payout) {
    return {
      success: false,
      error: { message: "Payout not found" },
    };
  }

  if (payout.status !== "processing") {
    return {
      success: false,
      error: { message: "Only processing payouts can be marked as completed" },
    };
  }

  const now = new Date().toISOString();

  // Mark payout as completed
  await db
    .update(platformAffiliatePayouts)
    .set({
      status: "completed",
      completedAt: now,
      transactionReference: transactionId || null,
      adminNotes: notes || null,
    })
    .where(eq(platformAffiliatePayouts.id, payoutId));

  // Mark commissions as paid
  await db
    .update(platformAffiliateCommissions)
    .set({
      status: "paid",
      paidAt: now,
    })
    .where(eq(platformAffiliateCommissions.payoutId, payoutId));

  // Update affiliate totals
  await db
    .update(platformAffiliates)
    .set({
      totalPending: sql`${platformAffiliates.totalPending} - ${payout.amount}`,
      totalPaidOut: sql`${platformAffiliates.totalPaidOut} + ${payout.amount}`,
    })
    .where(eq(platformAffiliates.id, payout.affiliateId));

  return { success: true };
}

// =============================================================================
// AFFILIATE PAYOUT REQUEST ACTIONS
// =============================================================================

import {
  platformAffiliatePayouts,
  platformAffiliateCommissions,
} from "@/lib/db/schema";

const MINIMUM_PAYOUT_AMOUNT = 1000; // Minimum 1000 AFN to request payout

/**
 * Request a payout for available commissions
 */
export async function requestAffiliatePayout(): Promise<
  ActionResult<{ payoutId: string; payoutNumber: string }>
> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in" },
    };
  }

  // Get affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.userId, user.id),
  });

  if (!affiliate) {
    return {
      success: false,
      error: { message: "Affiliate account not found" },
    };
  }

  if (affiliate.status !== "approved") {
    return {
      success: false,
      error: { message: "Your affiliate account is not active" },
    };
  }

  // Check if payout method is configured
  if (!affiliate.payoutMethod || !affiliate.payoutDetails) {
    return {
      success: false,
      error: { message: "Please configure a payout method first" },
    };
  }

  // Get available commissions
  const availableCommissions =
    await db.query.platformAffiliateCommissions.findMany({
      where: and(
        eq(platformAffiliateCommissions.affiliateId, affiliate.id),
        eq(platformAffiliateCommissions.status, "available")
      ),
    });

  if (availableCommissions.length === 0) {
    return {
      success: false,
      error: { message: "No available commissions to withdraw" },
    };
  }

  // Calculate total available
  const totalAvailable = availableCommissions.reduce(
    (sum, c) => sum + parseFloat(c.commissionAmount),
    0
  );

  if (totalAvailable < MINIMUM_PAYOUT_AMOUNT) {
    return {
      success: false,
      error: {
        message: `Minimum payout amount is ${MINIMUM_PAYOUT_AMOUNT} AFN. You have ${totalAvailable.toFixed(0)} AFN available.`,
      },
    };
  }

  // Check for pending payout
  const pendingPayout = await db.query.platformAffiliatePayouts.findFirst({
    where: and(
      eq(platformAffiliatePayouts.affiliateId, affiliate.id),
      eq(platformAffiliatePayouts.status, "pending")
    ),
  });

  if (pendingPayout) {
    return {
      success: false,
      error: { message: "You already have a pending payout request" },
    };
  }

  const now = new Date().toISOString();

  // Generate payout number
  const payoutCount = await db.query.platformAffiliatePayouts.findMany({
    where: eq(platformAffiliatePayouts.affiliateId, affiliate.id),
    columns: { id: true },
  });
  const payoutNumber = `PAY-${affiliate.slug.toUpperCase()}-${String(payoutCount.length + 1).padStart(4, "0")}`;

  // Create payout request
  const [payout] = await db
    .insert(platformAffiliatePayouts)
    .values({
      affiliateId: affiliate.id,
      payoutNumber,
      amount: totalAvailable.toString(),
      currency: "AFN",
      payoutMethod: affiliate.payoutMethod || "bank_transfer",
      payoutDetails: affiliate.payoutDetails || {},
      status: "pending",
      requestedAt: now,
    })
    .returning({ id: platformAffiliatePayouts.id });

  // Update commissions to pending status and link to payout
  for (const commission of availableCommissions) {
    await db
      .update(platformAffiliateCommissions)
      .set({
        status: "pending",
        payoutId: payout.id,
      })
      .where(eq(platformAffiliateCommissions.id, commission.id));
  }

  // Update affiliate's pending amount
  await db
    .update(platformAffiliates)
    .set({
      totalPending: sql`${platformAffiliates.totalPending} + ${totalAvailable}`,
    })
    .where(eq(platformAffiliates.id, affiliate.id));

  return {
    success: true,
    data: { payoutId: payout.id, payoutNumber },
  };
}

/**
 * Save affiliate payout method
 */
export async function saveAffiliatePayoutMethod(input: {
  method: "bank_transfer" | "mobile_money" | "crypto";
  details: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    mobileNumber?: string;
    provider?: string;
    walletAddress?: string;
    network?: "trc20" | "erc20" | "bep20";
  };
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in" },
    };
  }

  // Get affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.userId, user.id),
  });

  if (!affiliate) {
    return {
      success: false,
      error: { message: "Affiliate account not found" },
    };
  }

  const { method, details } = input;

  // Validate details based on method
  if (method === "bank_transfer") {
    if (!details.bankName || !details.accountName || !details.accountNumber) {
      return {
        success: false,
        error: { message: "Please fill in all bank details" },
      };
    }
  } else if (method === "mobile_money") {
    if (!details.mobileNumber || !details.provider) {
      return {
        success: false,
        error: { message: "Please fill in all mobile money details" },
      };
    }
  } else if (method === "crypto") {
    if (!details.walletAddress || !details.network) {
      return {
        success: false,
        error: { message: "Please fill in wallet address and select network" },
      };
    }
  }

  // Update affiliate
  await db
    .update(platformAffiliates)
    .set({
      payoutMethod: method,
      payoutDetails: details,
    })
    .where(eq(platformAffiliates.id, affiliate.id));

  return { success: true };
}

/**
 * Get affiliate's available balance (for client-side use)
 */
export async function getAffiliateAvailableBalance(): Promise<
  ActionResult<{ balance: number; canRequestPayout: boolean }>
> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in" },
    };
  }

  // Get affiliate
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: eq(platformAffiliates.userId, user.id),
    columns: { id: true },
  });

  if (!affiliate) {
    return {
      success: true,
      data: { balance: 0, canRequestPayout: false },
    };
  }

  // Get available commissions
  const availableCommissions =
    await db.query.platformAffiliateCommissions.findMany({
      where: and(
        eq(platformAffiliateCommissions.affiliateId, affiliate.id),
        eq(platformAffiliateCommissions.status, "available")
      ),
      columns: { commissionAmount: true },
    });

  const balance = availableCommissions.reduce(
    (sum, c) => sum + parseFloat(c.commissionAmount),
    0
  );

  return {
    success: true,
    data: {
      balance,
      canRequestPayout: balance >= MINIMUM_PAYOUT_AMOUNT,
    },
  };
}
