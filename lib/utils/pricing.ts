import { db } from "@/lib/db";
import {
  products,
  productVariants,
  priceTiers,
  customerGroupMembers,
  customerGroupPrices,
  scheduledSales,
  type PriceTier,
  type ScheduledSale,
} from "@/lib/db/schema";
import { eq, and, lte, gte, desc } from "drizzle-orm";

/**
 * Result of price resolution - contains the final price and metadata about how it was determined
 */
export interface PriceResult {
  /** The final resolved price */
  price: number;
  /** The compare-at/original price for strikethrough display */
  compareAtPrice: number | null;
  /** Cost price for margin calculations (only included if requested) */
  costPrice: number | null;
  /** How the price was determined */
  source: "sale" | "customer_group" | "tier" | "base";
  /** Discount percentage from compareAtPrice (if applicable) */
  discountPercent: number | null;
  /** Details about the tier applied (if source is 'tier') */
  tierApplied?: {
    minQuantity: number;
    maxQuantity: number | null;
  };
  /** Details about the sale applied (if source is 'sale') */
  saleInfo?: {
    name: string | null;
    endsAt: string;
  };
  /** All available price tiers for display */
  allTiers?: PriceTier[];
}

/**
 * Options for price resolution
 */
export interface PriceResolveOptions {
  /** Product ID (required) */
  productId: string;
  /** Variant ID (optional - if product has variants) */
  variantId?: string;
  /** Quantity being purchased (for tier pricing) */
  quantity?: number;
  /** User ID (for customer group pricing) */
  userId?: string;
  /** Tenant ID (required for customer group lookup) */
  tenantId?: string;
  /** Current timestamp for sale checking (defaults to now) */
  now?: Date;
  /** Include all price tiers in result */
  includeTiers?: boolean;
  /** Include cost price in result */
  includeCostPrice?: boolean;
}

/**
 * Get the base price for a product or variant
 */
async function getBasePrice(
  productId: string,
  variantId?: string
): Promise<{
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
}> {
  if (variantId) {
    // Get variant with product fallback
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
      with: {
        product: true,
      },
    });

    if (!variant) {
      throw new Error(`Variant not found: ${variantId}`);
    }

    return {
      price: variant.price ? parseFloat(variant.price) : parseFloat(variant.product.price),
      compareAtPrice: variant.compareAtPrice
        ? parseFloat(variant.compareAtPrice)
        : variant.product.compareAtPrice
          ? parseFloat(variant.product.compareAtPrice)
          : null,
      costPrice: variant.costPrice
        ? parseFloat(variant.costPrice)
        : variant.product.costPrice
          ? parseFloat(variant.product.costPrice)
          : null,
    };
  }

  // Get product price
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  return {
    price: parseFloat(product.price),
    compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice) : null,
    costPrice: product.costPrice ? parseFloat(product.costPrice) : null,
  };
}

/**
 * Check for active scheduled sale
 */
async function getActiveSale(
  productId: string,
  now: Date
): Promise<ScheduledSale | null> {
  const nowStr = now.toISOString();

  const sale = await db.query.scheduledSales.findFirst({
    where: and(
      eq(scheduledSales.productId, productId),
      eq(scheduledSales.isActive, true),
      lte(scheduledSales.startsAt, nowStr),
      gte(scheduledSales.endsAt, nowStr)
    ),
    orderBy: [desc(scheduledSales.priority)],
  });

  return sale ?? null;
}

/**
 * Get customer's group for a tenant
 */
async function getCustomerGroup(
  userId: string,
  tenantId: string
): Promise<string | null> {
  const membership = await db.query.customerGroupMembers.findFirst({
    where: and(
      eq(customerGroupMembers.userId, userId),
      eq(customerGroupMembers.tenantId, tenantId)
    ),
  });

  return membership?.customerGroupId ?? null;
}

/**
 * Get customer group price for a product
 */
async function getCustomerGroupPrice(
  productId: string,
  customerGroupId: string
): Promise<{ price: number; compareAtPrice: number | null } | null> {
  const groupPrice = await db.query.customerGroupPrices.findFirst({
    where: and(
      eq(customerGroupPrices.productId, productId),
      eq(customerGroupPrices.customerGroupId, customerGroupId)
    ),
  });

  if (!groupPrice) return null;

  return {
    price: parseFloat(groupPrice.price),
    compareAtPrice: groupPrice.compareAtPrice ? parseFloat(groupPrice.compareAtPrice) : null,
  };
}

/**
 * Get applicable price tier for a quantity
 */
async function getApplicableTier(
  productId: string,
  quantity: number
): Promise<PriceTier | null> {
  const tiers = await db.query.priceTiers.findMany({
    where: eq(priceTiers.productId, productId),
    orderBy: [desc(priceTiers.minQuantity)],
  });

  // Find the tier that matches the quantity (highest minQuantity that's <= quantity)
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) {
      if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        return tier;
      }
    }
  }

  return null;
}

/**
 * Get all price tiers for a product
 */
export async function getProductPriceTiers(productId: string): Promise<PriceTier[]> {
  return db.query.priceTiers.findMany({
    where: eq(priceTiers.productId, productId),
    orderBy: [priceTiers.minQuantity],
  });
}

/**
 * Calculate discount percentage
 */
function calculateDiscountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * Resolve the final price for a product based on various pricing rules.
 *
 * Priority order:
 * 1. Active scheduled sale (highest priority wins)
 * 2. Customer group price (if user is in a group)
 * 3. Quantity tier price (if quantity matches a tier)
 * 4. Base product/variant price
 *
 * @example
 * ```ts
 * // Simple product price
 * const result = await resolveProductPrice({ productId: "..." });
 *
 * // With quantity for tier pricing
 * const result = await resolveProductPrice({
 *   productId: "...",
 *   quantity: 25,
 * });
 *
 * // With customer group pricing
 * const result = await resolveProductPrice({
 *   productId: "...",
 *   userId: "...",
 *   tenantId: "...",
 * });
 * ```
 */
export async function resolveProductPrice(options: PriceResolveOptions): Promise<PriceResult> {
  const {
    productId,
    variantId,
    quantity = 1,
    userId,
    tenantId,
    now = new Date(),
    includeTiers = false,
    includeCostPrice = false,
  } = options;

  // Get base price info
  const basePrice = await getBasePrice(productId, variantId);

  let result: PriceResult = {
    price: basePrice.price,
    compareAtPrice: basePrice.compareAtPrice,
    costPrice: includeCostPrice ? basePrice.costPrice : null,
    source: "base",
    discountPercent: calculateDiscountPercent(basePrice.price, basePrice.compareAtPrice),
  };

  // 1. Check for active scheduled sale (highest priority)
  const activeSale = await getActiveSale(productId, now);
  if (activeSale) {
    const salePrice = parseFloat(activeSale.salePrice);
    result = {
      ...result,
      price: salePrice,
      compareAtPrice: basePrice.price, // Original price becomes compare-at during sale
      source: "sale",
      discountPercent: calculateDiscountPercent(salePrice, basePrice.price),
      saleInfo: {
        name: activeSale.name,
        endsAt: activeSale.endsAt,
      },
    };
  }
  // 2. Check for customer group price
  else if (userId && tenantId) {
    const customerGroupId = await getCustomerGroup(userId, tenantId);
    if (customerGroupId) {
      const groupPrice = await getCustomerGroupPrice(productId, customerGroupId);
      if (groupPrice) {
        result = {
          ...result,
          price: groupPrice.price,
          compareAtPrice: groupPrice.compareAtPrice ?? basePrice.price,
          source: "customer_group",
          discountPercent: calculateDiscountPercent(
            groupPrice.price,
            groupPrice.compareAtPrice ?? basePrice.price
          ),
        };
      }
    }
  }
  // 3. Check for quantity tier pricing
  else if (quantity > 1) {
    const tier = await getApplicableTier(productId, quantity);
    if (tier) {
      const tierPrice = parseFloat(tier.price);
      result = {
        ...result,
        price: tierPrice,
        compareAtPrice: basePrice.price, // Base price becomes compare-at for tier
        source: "tier",
        discountPercent: calculateDiscountPercent(tierPrice, basePrice.price),
        tierApplied: {
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
        },
      };
    }
  }

  // Include all tiers if requested
  if (includeTiers) {
    result.allTiers = await getProductPriceTiers(productId);
  }

  return result;
}

/**
 * Resolve prices for multiple products at once (batch operation)
 * More efficient than calling resolveProductPrice multiple times
 */
export async function resolveProductPricesBatch(
  items: Array<{
    productId: string;
    variantId?: string;
    quantity?: number;
  }>,
  options?: {
    userId?: string;
    tenantId?: string;
    now?: Date;
  }
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  // For now, resolve each individually
  // TODO: Optimize with batch queries
  for (const item of items) {
    const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
    const result = await resolveProductPrice({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      userId: options?.userId,
      tenantId: options?.tenantId,
      now: options?.now,
    });
    results.set(key, result);
  }

  return results;
}

/**
 * Simple price display with compare-at logic
 * Returns { price, compareAtPrice, discountPercent } for display purposes
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
