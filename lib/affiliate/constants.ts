/**
 * Platform Affiliate Program Configuration
 *
 * Commission tiers based on successful referrals (stores that pass 30-day retention):
 * - Bronze: 0-4 referrals → 30% commission
 * - Silver: 5-19 referrals → 40% commission
 * - Gold: 20+ referrals → 50% commission
 *
 * Commission duration: 12 months from first subscription payment
 * Cookie duration: 90 days
 * Retention requirement: 30 days before commission unlocks
 */

export const AFFILIATE_TIERS = {
  bronze: {
    name: "Bronze",
    minReferrals: 0,
    maxReferrals: 4,
    commissionRate: 30,
    description: "Starting tier for new affiliates",
  },
  silver: {
    name: "Silver",
    minReferrals: 5,
    maxReferrals: 19,
    commissionRate: 40,
    description: "Unlock with 5+ successful referrals",
  },
  gold: {
    name: "Gold",
    minReferrals: 20,
    maxReferrals: Infinity,
    commissionRate: 50,
    description: "Unlock with 20+ successful referrals",
  },
} as const;

export type AffiliateTierKey = keyof typeof AFFILIATE_TIERS;

export const AFFILIATE_CONFIG = {
  // Cookie duration in days (how long after click the affiliate gets credit)
  cookieDurationDays: 90,

  // Commission duration in months (how long affiliate earns from each referral)
  commissionDurationMonths: 12,

  // Retention requirement in days (store must stay this long before commission unlocks)
  retentionRequirementDays: 30,

  // Default currency for commissions
  defaultCurrency: "AFN",

  // Minimum slug length
  minSlugLength: 3,

  // Maximum slug length
  maxSlugLength: 30,

  // Payout number prefix
  payoutNumberPrefix: "PAF",
} as const;

/**
 * Calculate the appropriate tier based on successful referrals
 */
export function calculateTier(successfulReferrals: number): AffiliateTierKey {
  if (successfulReferrals >= AFFILIATE_TIERS.gold.minReferrals) {
    return "gold";
  }
  if (successfulReferrals >= AFFILIATE_TIERS.silver.minReferrals) {
    return "silver";
  }
  return "bronze";
}

/**
 * Get commission rate for a given tier
 */
export function getCommissionRate(tier: AffiliateTierKey): number {
  return AFFILIATE_TIERS[tier].commissionRate;
}

/**
 * Calculate referrals needed to reach next tier
 */
export function getReferralsToNextTier(
  currentTier: AffiliateTierKey,
  successfulReferrals: number
): number | null {
  if (currentTier === "gold") {
    return null; // Already at max tier
  }

  const nextTier = currentTier === "bronze" ? "silver" : "gold";
  return AFFILIATE_TIERS[nextTier].minReferrals - successfulReferrals;
}

/**
 * Get progress percentage to next tier
 */
export function getTierProgress(
  currentTier: AffiliateTierKey,
  successfulReferrals: number
): number {
  if (currentTier === "gold") {
    return 100; // Already at max tier
  }

  const tierConfig = AFFILIATE_TIERS[currentTier];
  const nextTierMin =
    currentTier === "bronze"
      ? AFFILIATE_TIERS.silver.minReferrals
      : AFFILIATE_TIERS.gold.minReferrals;

  const progressInTier = successfulReferrals - tierConfig.minReferrals;
  const tierRange = nextTierMin - tierConfig.minReferrals;

  return Math.min(100, Math.round((progressInTier / tierRange) * 100));
}

/**
 * Reserved slugs that cannot be used as affiliate vanity URLs
 * This is loaded from the database but kept here as a fallback/reference
 */
export const RESERVED_SLUGS = new Set([
  // Legal pages
  "terms",
  "privacy",
  "data-deletion",

  // Auth routes
  "login",
  "signup",
  "logout",
  "confirm",
  "error",

  // App routes
  "dashboard",
  "store",
  "admin",
  "invoice",

  // API routes
  "api",
  "uploads",

  // PWA routes
  "~offline",
  "_next",
  "manifest.json",
  "sw.js",

  // Affiliate routes
  "affiliate",
  "affiliates",
  "become-affiliate",

  // SEO/Assets
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
]);

/**
 * Validate if a slug can be used as an affiliate vanity URL
 */
export function isValidAffiliateSlug(slug: string): {
  valid: boolean;
  error?: string;
} {
  const normalizedSlug = slug.toLowerCase().trim();

  // Check length
  if (normalizedSlug.length < AFFILIATE_CONFIG.minSlugLength) {
    return {
      valid: false,
      error: `Slug must be at least ${AFFILIATE_CONFIG.minSlugLength} characters`,
    };
  }

  if (normalizedSlug.length > AFFILIATE_CONFIG.maxSlugLength) {
    return {
      valid: false,
      error: `Slug must be at most ${AFFILIATE_CONFIG.maxSlugLength} characters`,
    };
  }

  // Check for valid characters (alphanumeric and hyphens, no leading/trailing hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(normalizedSlug)) {
    return {
      valid: false,
      error:
        "Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)",
    };
  }

  // Check for consecutive hyphens
  if (normalizedSlug.includes("--")) {
    return { valid: false, error: "Slug cannot contain consecutive hyphens" };
  }

  // Check reserved slugs
  if (RESERVED_SLUGS.has(normalizedSlug)) {
    return { valid: false, error: "This slug is reserved and cannot be used" };
  }

  return { valid: true };
}
