import type { PriceTier } from "@/lib/db/schema";

/**
 * Campaign discount info for price calculations
 */
export type CampaignDiscount = {
  campaignId: string;
  campaignName: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  badgeText: string | null;
};

/**
 * Calculate discount percentage
 */
function calculateDiscountPercent(
  price: number,
  compareAtPrice: number | null
): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * Apply campaign discount to a price
 */
export function applyCampaignDiscount(
  originalPrice: number,
  campaign: CampaignDiscount
): number {
  if (campaign.discountType === "percentage") {
    return originalPrice * (1 - campaign.discountValue / 100);
  } else {
    return Math.max(0, originalPrice - campaign.discountValue);
  }
}

/**
 * Simple price display with compare-at logic
 * Returns { price, compareAtPrice, discountPercent } for display purposes
 *
 * This is a pure function safe for use in client components.
 */
export function getDisplayPrices(
  price: string | number,
  compareAtPrice: string | number | null
): {
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  hasDiscount: boolean;
} {
  const priceNum = typeof price === "string" ? parseFloat(price) : price;
  const compareAtNum = compareAtPrice
    ? typeof compareAtPrice === "string"
      ? parseFloat(compareAtPrice)
      : compareAtPrice
    : null;

  const discountPercent = calculateDiscountPercent(priceNum, compareAtNum);

  return {
    price: priceNum,
    compareAtPrice: compareAtNum,
    discountPercent,
    hasDiscount: discountPercent !== null && discountPercent > 0,
  };
}

/**
 * Get display prices with campaign discount applied
 * Campaign discounts take priority over compare-at prices
 *
 * This is a pure function safe for use in client components.
 */
export function getDisplayPricesWithCampaign(
  price: string | number,
  compareAtPrice: string | number | null,
  campaign: CampaignDiscount | null
): {
  price: number;
  originalPrice: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  hasDiscount: boolean;
  hasCampaignDiscount: boolean;
  campaignBadgeText: string | null;
} {
  const originalPrice = typeof price === "string" ? parseFloat(price) : price;
  const compareAtNum = compareAtPrice
    ? typeof compareAtPrice === "string"
      ? parseFloat(compareAtPrice)
      : compareAtPrice
    : null;

  // If there's an active campaign, use campaign discount
  if (campaign) {
    const campaignPrice = applyCampaignDiscount(originalPrice, campaign);
    const campaignDiscountPercent =
      campaign.discountType === "percentage"
        ? campaign.discountValue
        : Math.round(((originalPrice - campaignPrice) / originalPrice) * 100);

    return {
      price: campaignPrice,
      originalPrice,
      compareAtPrice: originalPrice, // Show original as compare-at
      discountPercent: campaignDiscountPercent,
      hasDiscount: true,
      hasCampaignDiscount: true,
      campaignBadgeText: campaign.badgeText,
    };
  }

  // No campaign - use regular compare-at price logic
  const discountPercent = calculateDiscountPercent(originalPrice, compareAtNum);

  return {
    price: originalPrice,
    originalPrice,
    compareAtPrice: compareAtNum,
    discountPercent,
    hasDiscount: discountPercent !== null && discountPercent > 0,
    hasCampaignDiscount: false,
    campaignBadgeText: null,
  };
}

/**
 * Format price tier for display
 * Example: "10-49 units: AFN 800" or "50+ units: AFN 600"
 *
 * This is a pure function safe for use in client components.
 */
export function formatPriceTier(
  tier: PriceTier,
  currency: string = "AFN"
): string {
  const price = parseFloat(tier.price);
  const formattedPrice = formatCurrencyAmount(price, currency);

  if (tier.maxQuantity === null) {
    return `${tier.minQuantity}+ units: ${formattedPrice}`;
  }
  return `${tier.minQuantity}-${tier.maxQuantity} units: ${formattedPrice}`;
}

/** Format an amount with the correct currency symbol */
function formatCurrencyAmount(amount: number, currency: string): string {
  let formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "AFN" ? 0 : 2,
    maximumFractionDigits: currency === "AFN" ? 0 : 2,
  }).format(amount);
  if (currency === "AFN") formatted = formatted.replace("AFN", "؋");
  return formatted;
}
