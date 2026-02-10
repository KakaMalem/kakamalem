import { z } from "zod";
import { isValidAffiliateSlug } from "@/lib/affiliate/constants";

// ============================================================================
// Application / Profile Schemas
// ============================================================================

/**
 * Schema for affiliate application (public signup form)
 */
export const affiliateApplicationSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must be at most 100 characters"),
  slug: z
    .string()
    .min(1, "Vanity URL is required")
    .transform((val) => val.toLowerCase().trim())
    .superRefine((val, ctx) => {
      const result = isValidAffiliateSlug(val);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.error || "Invalid vanity URL format",
        });
      }
    }),
  bio: z
    .string()
    .trim()
    .max(1000, "Bio must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
  websiteUrl: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Please enter a valid URL (e.g., https://example.com)" }
    )
    .optional()
    .or(z.literal("")),
  socialLinks: z
    .object({
      instagram: z.string().trim().optional().or(z.literal("")),
      youtube: z.string().trim().optional().or(z.literal("")),
      tiktok: z.string().trim().optional().or(z.literal("")),
      facebook: z.string().trim().optional().or(z.literal("")),
      twitter: z.string().trim().optional().or(z.literal("")),
      linkedin: z.string().trim().optional().or(z.literal("")),
      website: z.string().trim().optional().or(z.literal("")),
    })
    .optional(),
  applicationNotes: z
    .string()
    .trim()
    .max(2000, "Application notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type AffiliateApplicationInput = z.infer<
  typeof affiliateApplicationSchema
>;

/**
 * Schema for updating affiliate profile
 */
export const updateAffiliateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must be at most 100 characters")
    .optional(),
  bio: z.string().max(1000, "Bio must be at most 1000 characters").optional(),
  websiteUrl: z
    .string()
    .url("Invalid website URL")
    .optional()
    .or(z.literal("")),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      youtube: z.string().optional(),
      tiktok: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
});

export type UpdateAffiliateProfileInput = z.infer<
  typeof updateAffiliateProfileSchema
>;

// ============================================================================
// Payout Method Schemas
// ============================================================================

/**
 * Bank transfer payout details
 */
export const bankTransferPayoutSchema = z.object({
  bankName: z.string().min(2, "Bank name is required"),
  accountName: z.string().min(2, "Account name is required"),
  accountNumber: z.string().min(5, "Account number is required"),
  iban: z.string().optional(),
});

/**
 * Mobile money payout details
 */
export const mobileMoneyPayoutSchema = z.object({
  mobileNumber: z.string().min(10, "Mobile number is required"),
  mobileProvider: z.string().min(2, "Mobile provider is required"), // e.g., "m-paisa", "m-hawala"
});

/**
 * Schema for updating payout method
 */
export const updatePayoutMethodSchema = z.discriminatedUnion("payoutMethod", [
  z.object({
    payoutMethod: z.literal("bank_transfer"),
    payoutDetails: bankTransferPayoutSchema,
  }),
  z.object({
    payoutMethod: z.literal("mobile_money"),
    payoutDetails: mobileMoneyPayoutSchema,
  }),
]);

export type UpdatePayoutMethodInput = z.infer<typeof updatePayoutMethodSchema>;

// ============================================================================
// Admin Schemas
// ============================================================================

/**
 * Schema for admin approving/rejecting an affiliate
 */
export const adminReviewAffiliateSchema = z.object({
  affiliateId: z.string().uuid("Invalid affiliate ID"),
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z
    .string()
    .max(500, "Reason must be at most 500 characters")
    .optional(),
  // Custom commission settings (optional - for special cases)
  customCommissionRate: z
    .number()
    .min(0, "Commission rate cannot be negative")
    .max(100, "Commission rate cannot exceed 100%")
    .optional(),
  customCommissionDurationMonths: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 month")
    .max(36, "Duration cannot exceed 36 months")
    .optional(),
});

export type AdminReviewAffiliateInput = z.infer<
  typeof adminReviewAffiliateSchema
>;

/**
 * Schema for admin processing a payout
 */
export const adminProcessPayoutSchema = z.object({
  payoutId: z.string().uuid("Invalid payout ID"),
  action: z.enum(["process", "complete", "fail"]),
  transactionReference: z.string().max(255).optional(),
  adminNotes: z.string().max(1000).optional(),
  failureReason: z.string().max(500).optional(),
});

export type AdminProcessPayoutInput = z.infer<typeof adminProcessPayoutSchema>;

// ============================================================================
// Payout Request Schema
// ============================================================================

/**
 * Schema for affiliate requesting a payout
 */
export const requestPayoutSchema = z.object({
  // No fields needed - we'll calculate available balance server-side
  // This is just for validation purposes
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

// ============================================================================
// Click Tracking Schema
// ============================================================================

/**
 * Schema for tracking affiliate clicks
 */
export const trackClickSchema = z.object({
  slug: z.string().min(1, "Affiliate slug is required"),
  visitorId: z.string().optional(),
  referrer: z.string().optional(),
  landingPage: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
});

export type TrackClickInput = z.infer<typeof trackClickSchema>;

// ============================================================================
// Query/Filter Schemas
// ============================================================================

/**
 * Schema for filtering affiliate list (admin)
 */
export const affiliateListFilterSchema = z.object({
  status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
  tier: z.enum(["bronze", "silver", "gold"]).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z
    .enum([
      "createdAt",
      "appliedAt",
      "successfulReferrals",
      "totalEarned",
      "displayName",
    ])
    .default("appliedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AffiliateListFilterInput = z.infer<
  typeof affiliateListFilterSchema
>;

/**
 * Schema for filtering referrals (affiliate dashboard)
 */
export const referralListFilterSchema = z.object({
  status: z.enum(["trial", "active", "churned", "completed"]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type ReferralListFilterInput = z.infer<typeof referralListFilterSchema>;

/**
 * Schema for filtering commissions (affiliate dashboard)
 */
export const commissionListFilterSchema = z.object({
  status: z.enum(["pending", "available", "paid", "voided"]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type CommissionListFilterInput = z.infer<
  typeof commissionListFilterSchema
>;

/**
 * Schema for filtering payouts (affiliate dashboard / admin)
 */
export const payoutListFilterSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PayoutListFilterInput = z.infer<typeof payoutListFilterSchema>;
