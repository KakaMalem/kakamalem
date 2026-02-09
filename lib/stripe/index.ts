/**
 * Stripe Integration
 *
 * Server-side Stripe client for:
 * 1. Platform subscriptions (Pro plan for store owners)
 * 2. Store payments via Stripe Connect (international customers)
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - STRIPE_PRO_PRICE_ID: Price ID for Pro subscription
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Publishable key (client-side)
 */

import Stripe from "stripe";

// Validate environment
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    "[Stripe] STRIPE_SECRET_KEY not configured - Stripe features will be disabled"
  );
}

// Server-side Stripe client
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Check if Stripe is configured and available
 */
export function isStripeEnabled(): boolean {
  return !!stripe;
}

/**
 * Get Stripe Pro plan monthly price ID from environment
 */
export function getProPriceId(): string | null {
  return process.env.STRIPE_PRO_PRICE_ID || null;
}

/**
 * Get Stripe Pro plan yearly price ID from environment
 */
export function getYearlyPriceId(): string | null {
  return process.env.STRIPE_PRO_YEARLY_PRICE_ID || null;
}

/**
 * Get price ID based on billing interval
 */
export function getPriceIdForInterval(
  interval: "monthly" | "yearly"
): string | null {
  return interval === "yearly" ? getYearlyPriceId() : getProPriceId();
}

/**
 * Get Stripe webhook secret
 */
export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/**
 * Pro price info fetched from Stripe
 */
export type ProPriceInfo = {
  priceId: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  productName: string;
  productDescription: string | null;
  active: boolean;
};

/**
 * Combined pricing info for both monthly and yearly
 */
export type ProPricingInfo = {
  monthly: ProPriceInfo | null;
  yearly: ProPriceInfo | null;
  hasYearly: boolean;
};

/**
 * Fetch Pro plan price details from Stripe API
 * Stripe is the source of truth for pricing
 */
export async function getProPriceInfo(): Promise<ProPriceInfo | null> {
  if (!isStripeEnabled() || !stripe) {
    return null;
  }

  const priceId = getProPriceId();
  if (!priceId) {
    return null;
  }

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    // Ensure it's a recurring price
    if (price.type !== "recurring" || !price.recurring) {
      console.warn("[Stripe] Pro price is not a recurring subscription price");
      return null;
    }

    // Extract product info
    const product = price.product as Stripe.Product;

    return {
      priceId: price.id,
      amount: (price.unit_amount || 0) / 100, // Convert from cents
      currency: price.currency.toUpperCase(),
      interval: price.recurring.interval as "month" | "year",
      productName: product.name,
      productDescription: product.description,
      active: price.active && product.active,
    };
  } catch (error) {
    console.error("[Stripe] Failed to fetch Pro price info:", error);
    return null;
  }
}

/**
 * Fetch yearly Pro plan price details from Stripe API
 */
export async function getYearlyPriceInfo(): Promise<ProPriceInfo | null> {
  if (!isStripeEnabled() || !stripe) {
    return null;
  }

  const priceId = getYearlyPriceId();
  if (!priceId) {
    return null;
  }

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    // Ensure it's a recurring price
    if (price.type !== "recurring" || !price.recurring) {
      console.warn(
        "[Stripe] Yearly Pro price is not a recurring subscription price"
      );
      return null;
    }

    // Extract product info
    const product = price.product as Stripe.Product;

    return {
      priceId: price.id,
      amount: (price.unit_amount || 0) / 100, // Convert from cents
      currency: price.currency.toUpperCase(),
      interval: price.recurring.interval as "month" | "year",
      productName: product.name,
      productDescription: product.description,
      active: price.active && product.active,
    };
  } catch (error) {
    console.error("[Stripe] Failed to fetch yearly Pro price info:", error);
    return null;
  }
}

/**
 * Fetch both monthly and yearly pricing info
 */
export async function getProPricingInfo(): Promise<ProPricingInfo> {
  const [monthly, yearly] = await Promise.all([
    getProPriceInfo(),
    getYearlyPriceInfo(),
  ]);

  return {
    monthly,
    yearly,
    hasYearly: !!yearly,
  };
}

/**
 * Validate that the Pro price ID exists and is active in Stripe
 * Useful for health checks
 */
export async function validateProPrice(): Promise<{
  valid: boolean;
  error?: string;
}> {
  const priceInfo = await getProPriceInfo();

  if (!priceInfo) {
    const priceId = getProPriceId();
    if (!priceId) {
      return { valid: false, error: "STRIPE_PRO_PRICE_ID not configured" };
    }
    return { valid: false, error: "Failed to fetch price from Stripe" };
  }

  if (!priceInfo.active) {
    return { valid: false, error: "Price or product is not active in Stripe" };
  }

  return { valid: true };
}

// Re-export Stripe types for convenience
export type { Stripe };
