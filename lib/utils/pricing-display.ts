import type { PriceTier } from "@/lib/db/schema";

/**
 * Calculate discount percentage
 */
function calculateDiscountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
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
 * Format price tier for display
 * Example: "10-49 units: AFN 800" or "50+ units: AFN 600"
 *
 * This is a pure function safe for use in client components.
 */
export function formatPriceTier(tier: PriceTier, currency: string = "AFN"): string {
  const price = parseFloat(tier.price);
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "AFN" ? 0 : 2,
    maximumFractionDigits: currency === "AFN" ? 0 : 2,
  }).format(price);

  if (tier.maxQuantity === null) {
    return `${tier.minQuantity}+ units: ${formattedPrice}`;
  }
  return `${tier.minQuantity}-${tier.maxQuantity} units: ${formattedPrice}`;
}
