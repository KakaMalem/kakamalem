/**
 * Stripe Client-Side
 *
 * Client-side Stripe utilities using @stripe/stripe-js
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe client instance (client-side only)
 * Uses singleton pattern to avoid loading multiple times
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.warn(
        "[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not configured"
      );
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(publishableKey);
  }

  return stripePromise;
}

/**
 * Check if Stripe is configured on the client
 */
export function isStripeConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}
