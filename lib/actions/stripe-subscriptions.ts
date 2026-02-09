"use server";

/**
 * Stripe Subscription Server Actions
 *
 * Server actions for managing Pro subscriptions via Stripe.
 */

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { isStripeEnabled } from "@/lib/stripe";
import {
  createProSubscriptionCheckout,
  createCustomerPortalSession,
  cancelSubscription,
  resumeSubscription,
  getSubscriptionStatus,
} from "@/lib/stripe/subscriptions";

type ActionResult = {
  success: boolean;
  url?: string;
  error?: string;
};

/**
 * Create a checkout session to upgrade to Pro
 */
export async function createProCheckout(
  tenantId: string
): Promise<ActionResult> {
  const user = await requireAuth();

  // Check if user can manage this store
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return {
      success: false,
      error: "You don't have permission to manage this store",
    };
  }

  if (!isStripeEnabled()) {
    return { success: false, error: "Stripe is not configured" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const successUrl = `${baseUrl}/dashboard/${tenantId}/billing?success=true`;
  const cancelUrl = `${baseUrl}/dashboard/${tenantId}/billing?cancelled=true`;

  const result = await createProSubscriptionCheckout(
    tenantId,
    user.id,
    user.email,
    successUrl,
    cancelUrl
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, url: result.checkoutUrl };
}

/**
 * Open Stripe Customer Portal for subscription management
 */
export async function openCustomerPortal(
  tenantId: string
): Promise<ActionResult> {
  await requireAuth();

  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return {
      success: false,
      error: "You don't have permission to manage this store",
    };
  }

  if (!isStripeEnabled()) {
    return { success: false, error: "Stripe is not configured" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const returnUrl = `${baseUrl}/dashboard/${tenantId}/billing`;

  const result = await createCustomerPortalSession(tenantId, returnUrl);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, url: result.portalUrl };
}

/**
 * Cancel subscription (at period end)
 */
export async function cancelProSubscription(
  tenantId: string
): Promise<ActionResult> {
  await requireAuth();

  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return {
      success: false,
      error: "You don't have permission to manage this store",
    };
  }

  if (!isStripeEnabled()) {
    return { success: false, error: "Stripe is not configured" };
  }

  const result = await cancelSubscription(tenantId);

  if (result.success) {
    revalidatePath(`/dashboard/${tenantId}/billing`);
  }

  return result;
}

/**
 * Resume a cancelled subscription (before period end)
 */
export async function resumeProSubscription(
  tenantId: string
): Promise<ActionResult> {
  await requireAuth();

  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return {
      success: false,
      error: "You don't have permission to manage this store",
    };
  }

  if (!isStripeEnabled()) {
    return { success: false, error: "Stripe is not configured" };
  }

  const result = await resumeSubscription(tenantId);

  if (result.success) {
    revalidatePath(`/dashboard/${tenantId}/billing`);
  }

  return result;
}

/**
 * Get current subscription status from Stripe
 */
export async function getProSubscriptionStatus(tenantId: string) {
  await requireAuth();

  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return null;
  }

  return getSubscriptionStatus(tenantId);
}
