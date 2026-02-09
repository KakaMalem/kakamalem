/**
 * Stripe Subscriptions
 *
 * Handles Pro plan subscriptions for store owners.
 * Uses Stripe Checkout for payment and Stripe Customer Portal for management.
 */

import { stripe, isStripeEnabled, getPriceIdForInterval } from "./index";
import { db } from "@/lib/db";
import { tenants, type BillingInterval } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type SubscriptionResult = {
  success: boolean;
  checkoutUrl?: string;
  portalUrl?: string;
  error?: string;
};

/**
 * Create a Stripe Checkout session for Pro subscription
 *
 * @param tenantId Store ID to upgrade
 * @param userId User ID of store owner
 * @param email User's email
 * @param successUrl URL to redirect after successful payment
 * @param cancelUrl URL to redirect if payment is cancelled
 * @param billingInterval Monthly or yearly billing (default: monthly)
 */
export async function createProSubscriptionCheckout(
  tenantId: string,
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  billingInterval: BillingInterval = "monthly"
): Promise<SubscriptionResult> {
  if (!isStripeEnabled() || !stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  const priceId = getPriceIdForInterval(billingInterval);
  if (!priceId) {
    return {
      success: false,
      error: `Pro plan ${billingInterval} price not configured`,
    };
  }

  try {
    // Get tenant to check if they already have a Stripe customer
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        id: true,
        stripeCustomerId: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    let customerId = tenant.stripeCustomerId;

    // Create or update Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          tenantId,
          userId,
          storeName: tenant.name,
          storeSlug: tenant.slug,
        },
      });
      customerId = customer.id;

      // Save customer ID to tenant
      await db
        .update(tenants)
        .set({ stripeCustomerId: customerId })
        .where(eq(tenants.id, tenantId));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        userId,
        type: "pro_subscription",
        billingInterval,
      },
      subscription_data: {
        metadata: {
          tenantId,
          userId,
          billingInterval,
        },
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect billing address
      billing_address_collection: "auto",
    });

    return {
      success: true,
      checkoutUrl: session.url || undefined,
    };
  } catch (error) {
    console.error("[Stripe] Failed to create checkout session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a Stripe Customer Portal session for subscription management
 *
 * @param tenantId Store ID
 * @param returnUrl URL to return to after portal session
 */
export async function createCustomerPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<SubscriptionResult> {
  if (!isStripeEnabled() || !stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return {
        success: false,
        error: "No Stripe customer found for this store",
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });

    return {
      success: true,
      portalUrl: session.url,
    };
  } catch (error) {
    console.error("[Stripe] Failed to create portal session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cancel a subscription (at period end)
 */
export async function cancelSubscription(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isStripeEnabled() || !stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { stripeSubscriptionId: true },
    });

    if (!tenant?.stripeSubscriptionId) {
      return { success: false, error: "No active subscription found" };
    }

    // Cancel at period end (don't immediately revoke access)
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update tenant status
    await db
      .update(tenants)
      .set({
        subscriptionStatus: "cancelled",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (error) {
    console.error("[Stripe] Failed to cancel subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resume a cancelled subscription (before period end)
 */
export async function resumeSubscription(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isStripeEnabled() || !stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { stripeSubscriptionId: true },
    });

    if (!tenant?.stripeSubscriptionId) {
      return { success: false, error: "No subscription found" };
    }

    // Resume the subscription
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update tenant status
    await db
      .update(tenants)
      .set({
        subscriptionStatus: "active",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (error) {
    console.error("[Stripe] Failed to resume subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get subscription status from Stripe
 */
export async function getSubscriptionStatus(tenantId: string): Promise<{
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
} | null> {
  if (!isStripeEnabled() || !stripe) {
    return null;
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { stripeSubscriptionId: true },
    });

    if (!tenant?.stripeSubscriptionId) {
      return null;
    }

    const subscription = await stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId
    );

    // Access properties safely using type assertion
    const subData = subscription as unknown as {
      status: string;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };

    return {
      status: subData.status,
      currentPeriodEnd: new Date(subData.current_period_end * 1000),
      cancelAtPeriodEnd: subData.cancel_at_period_end,
    };
  } catch (error) {
    console.error("[Stripe] Failed to get subscription status:", error);
    return null;
  }
}
