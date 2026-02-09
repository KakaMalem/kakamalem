import { z } from "zod";

// =============================================================================
// SALE CAMPAIGN VALIDATION SCHEMAS
// =============================================================================

/**
 * Campaign scope - what the sale applies to
 */
export const campaignScopeSchema = z.enum([
  "store_wide", // Applies to all products
  "categories", // Applies to specific categories
  "products", // Applies to specific products
]);

export type CampaignScope = z.infer<typeof campaignScopeSchema>;

/**
 * Campaign discount type
 */
export const campaignDiscountTypeSchema = z.enum([
  "percentage", // e.g., 20% off
  "fixed_amount", // e.g., 100 AFN off each item
]);

export type CampaignDiscountType = z.infer<typeof campaignDiscountTypeSchema>;

/**
 * Sale campaign input schema for create/update
 */
export const campaignSchema = z
  .object({
    // Basic info
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().max(1000).optional().nullable(),
    slug: z
      .string()
      .max(255)
      .regex(
        /^[a-z0-9-]*$/,
        "Slug can only contain lowercase letters, numbers, and hyphens"
      )
      .optional()
      .nullable(),

    // Discount configuration
    discountType: campaignDiscountTypeSchema.default("percentage"),
    discountValue: z
      .string()
      .min(1, "Discount value is required")
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: "Discount value must be greater than 0",
      }),

    // Scope
    scope: campaignScopeSchema.default("store_wide"),
    eligibleCategories: z.array(z.string().uuid()).optional().nullable(),
    eligibleProducts: z.array(z.string().uuid()).optional().nullable(),
    excludedProducts: z.array(z.string().uuid()).optional().nullable(),

    // Validity
    startsAt: z.string().min(1, "Start date is required"),
    endsAt: z.string().min(1, "End date is required"),

    // Minimum order (optional)
    minimumOrderAmount: z.string().optional().nullable(),

    // Display settings
    showBadge: z.boolean().default(true),
    badgeText: z.string().max(50).optional().nullable(),
    bannerImage: z.string().max(500).optional().nullable(),

    // Control
    isActive: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(0),
  })
  .refine(
    (data) => {
      // Percentage must be between 0 and 100
      if (data.discountType === "percentage") {
        const value = parseFloat(data.discountValue);
        return value > 0 && value <= 100;
      }
      return true;
    },
    {
      message: "Percentage discount must be between 0 and 100",
      path: ["discountValue"],
    }
  )
  .refine(
    (data) => {
      // End date must be after start date
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endsAt"],
    }
  )
  .refine(
    (data) => {
      // Categories required when scope is 'categories'
      if (
        data.scope === "categories" &&
        (!data.eligibleCategories || data.eligibleCategories.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Select at least one category for category-specific campaigns",
      path: ["eligibleCategories"],
    }
  )
  .refine(
    (data) => {
      // Products required when scope is 'products'
      if (
        data.scope === "products" &&
        (!data.eligibleProducts || data.eligibleProducts.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Select at least one product for product-specific campaigns",
      path: ["eligibleProducts"],
    }
  );

export type CampaignInput = z.infer<typeof campaignSchema>;

/**
 * Campaign status for display
 */
export type CampaignStatus = "active" | "scheduled" | "ended" | "inactive";

/**
 * Calculate campaign status based on dates and active flag
 */
export function getCampaignStatus(campaign: {
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}): CampaignStatus {
  if (!campaign.isActive) {
    return "inactive";
  }

  const now = new Date();
  const startsAt = new Date(campaign.startsAt);
  const endsAt = new Date(campaign.endsAt);

  if (now < startsAt) {
    return "scheduled";
  }

  if (now > endsAt) {
    return "ended";
  }

  return "active";
}

/**
 * Check if a campaign is currently running
 */
export function isCampaignRunning(campaign: {
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}): boolean {
  return getCampaignStatus(campaign) === "active";
}

/**
 * Calculate discounted price
 */
export function calculateCampaignDiscount(
  originalPrice: number,
  discountType: CampaignDiscountType,
  discountValue: number
): number {
  if (discountType === "percentage") {
    return originalPrice * (1 - discountValue / 100);
  }
  // fixed_amount - subtract from price, but not below 0
  return Math.max(0, originalPrice - discountValue);
}
