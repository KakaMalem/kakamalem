/**
 * Stripe Webhook Handler
 *
 * Handles webhooks for:
 * 1. Store order payments (checkout.session.completed)
 * 2. Pro subscription events (customer.subscription.*)
 * 3. Refunds (charge.refunded)
 *
 * Webhook URL: https://kakamalem.com/api/webhooks/stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getWebhookSecret } from "@/lib/stripe";
import { db } from "@/lib/db";
import {
  tenants,
  orders,
  paymentSessions,
  paymentWebhookEvents,
  orderTransactions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  creditSellerEarnings,
  debitSellerEarningsForRefund,
} from "@/lib/actions/earnings";

// Type definitions for Stripe webhook objects
type CheckoutSession = {
  id: string;
  payment_status: string;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
};

type StripeSubscription = {
  id: string;
  status: string;
  current_period_end: number;
  metadata?: Record<string, string> | null;
  items?: { data: Array<{ price?: { id?: string } }> };
};

type StripeInvoice = {
  id: string;
  subscription?: string | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
};

type StripeCharge = {
  id: string;
  payment_intent?: string | null;
  amount_refunded?: number;
  refunded?: boolean;
  metadata?: Record<string, string> | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disable body parsing - we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe is not configured");
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    console.error("[Stripe Webhook] Webhook secret not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get the raw body as text
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Log the webhook event
  const sourceIp =
    headersList.get("x-forwarded-for") || headersList.get("x-real-ip");

  try {
    await db.insert(paymentWebhookEvents).values({
      gateway: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: JSON.parse(JSON.stringify(event.data.object)) as Record<
        string,
        unknown
      >,
      headers: Object.fromEntries(
        Array.from(headersList.entries()).filter(
          ([k]) => k.startsWith("stripe") || k === "content-type"
        )
      ),
      status: "received",
      sourceIp: sourceIp || undefined,
    });
  } catch (logError) {
    console.error("[Stripe Webhook] Failed to log event:", logError);
  }

  // Handle different event types
  try {
    switch (event.type) {
      // ====== CHECKOUT/PAYMENT EVENTS ======
      case "checkout.session.completed": {
        const session = event.data.object as unknown as CheckoutSession;
        await handleCheckoutComplete(session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as unknown as CheckoutSession;
        await handleCheckoutExpired(session);
        break;
      }

      // ====== SUBSCRIPTION EVENTS ======
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as StripeSubscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as StripeSubscription;
        await handleSubscriptionCancelled(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as StripeInvoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as StripeInvoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      // ====== REFUND EVENTS ======
      case "charge.refunded": {
        const charge = event.data.object as unknown as StripeCharge;
        await handleRefund(charge);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Update webhook event status to processed
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "processed",
        processedAt: new Date().toISOString(),
      })
      .where(eq(paymentWebhookEvents.eventId, event.id));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);

    // Update webhook event status to failed
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(paymentWebhookEvents.eventId, event.id));

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle successful checkout session (order payment)
 */
async function handleCheckoutComplete(session: {
  id: string;
  payment_status: string;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
}) {
  const { tenantId, orderId, type } = session.metadata || {};

  // Skip if this is a subscription checkout (handled by subscription events)
  if (type === "pro_subscription") {
    console.log(
      "[Stripe Webhook] Subscription checkout completed, handled by subscription events"
    );
    return;
  }

  if (!orderId || !tenantId) {
    console.log(
      "[Stripe Webhook] No orderId or tenantId in checkout session, skipping"
    );
    return;
  }

  // Update payment session status
  await db
    .update(paymentSessions)
    .set({
      status: "completed",
      completedAt: new Date().toISOString(),
      gatewayResponse: {
        paymentStatus: session.payment_status,
        paymentIntentId: session.payment_intent,
      },
    })
    .where(eq(paymentSessions.gatewaySessionId, session.id));

  // Update order payment status
  if (session.payment_status === "paid") {
    // Get the order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      console.error(`[Stripe Webhook] Order ${orderId} not found`);
      return;
    }

    // Skip if already paid
    if (order.paymentStatus === "paid") {
      console.log(`[Stripe Webhook] Order ${orderId} already paid, skipping`);
      return;
    }

    const amountPaid = session.amount_total
      ? session.amount_total / 100
      : parseFloat(order.total);
    const orderTotal = parseFloat(order.total);
    const isFullyPaid = amountPaid >= orderTotal;

    // Create transaction record
    await db.insert(orderTransactions).values({
      orderId,
      tenantId,
      type: "payment",
      amount: amountPaid.toString(),
      currencyCode: (session.currency || "usd").toUpperCase(),
      paymentMethod: "card",
      status: "completed",
      gateway: "stripe",
      gatewayTransactionId: session.payment_intent || session.id,
      gatewayResponse: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        paymentIntentId: session.payment_intent,
      },
      processedAt: new Date().toISOString(),
    });

    // Update order
    await db
      .update(orders)
      .set({
        paymentStatus: isFullyPaid ? "paid" : "partial",
        isPaid: isFullyPaid,
        amountPaid: amountPaid.toString(),
        amountDue: (orderTotal - amountPaid).toString(),
        paidAt: isFullyPaid ? new Date().toISOString() : undefined,
        status:
          isFullyPaid && order.status === "pending"
            ? "confirmed"
            : order.status,
        confirmedAt:
          isFullyPaid && order.status === "pending"
            ? new Date().toISOString()
            : order.confirmedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    // Credit seller earnings when order is fully paid
    if (isFullyPaid) {
      await creditSellerEarnings(
        tenantId,
        orderId,
        order.orderNumber,
        orderTotal,
        order.currencyCode || "AFN",
        "Stripe"
      );
    }

    console.log(
      `[Stripe Webhook] Order ${order.orderNumber} marked as ${isFullyPaid ? "paid" : "partially paid"}`
    );
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutExpired(session: {
  id: string;
  metadata?: Record<string, string> | null;
}) {
  // Update payment session status
  await db
    .update(paymentSessions)
    .set({
      status: "expired",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentSessions.gatewaySessionId, session.id));

  console.log(`[Stripe Webhook] Checkout session ${session.id} expired`);
}

/**
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(subscription: {
  id: string;
  status: string;
  current_period_end?: number;
  current_period_start?: number;
  metadata?: Record<string, string> | null;
  items?: {
    data: Array<{
      price?: {
        id?: string;
        recurring?: { interval?: string };
      };
    }>;
  };
}) {
  const { tenantId, billingInterval: metadataInterval } =
    subscription.metadata || {};

  if (!tenantId) {
    console.log("[Stripe Webhook] No tenantId in subscription metadata");
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "past_due",
    incomplete: "trialing",
    incomplete_expired: "expired",
  };

  const subscriptionStatus = statusMap[subscription.status] || "active";

  // Safely parse period end - use fallback if not provided
  let periodEnd: Date;
  if (
    subscription.current_period_end &&
    !isNaN(subscription.current_period_end)
  ) {
    periodEnd = new Date(subscription.current_period_end * 1000);
  } else {
    // Fallback: calculate based on billing interval
    const priceInterval =
      subscription.items?.data?.[0]?.price?.recurring?.interval;
    const isYearly = metadataInterval === "yearly" || priceInterval === "year";
    periodEnd = new Date();
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    console.log(
      `[Stripe Webhook] current_period_end missing, using fallback: ${periodEnd.toISOString()}`
    );
  }

  const priceItem = subscription.items?.data?.[0]?.price;
  const priceId = priceItem?.id;

  // Determine billing interval from price or metadata
  const priceInterval = priceItem?.recurring?.interval;
  const billingInterval =
    metadataInterval || (priceInterval === "year" ? "yearly" : "monthly");

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionPlan: "pro",
      subscriptionStatus: subscriptionStatus as
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired",
      subscriptionEndsAt: periodEnd.toISOString(),
      subscriptionStartedAt:
        subscription.status === "active" ? new Date().toISOString() : undefined,
      billingInterval,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(
    `[Stripe Webhook] Tenant ${tenantId} subscription updated: ${subscription.status} (${billingInterval})`
  );
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription: {
  id: string;
  metadata?: Record<string, string> | null;
}) {
  const { tenantId } = subscription.metadata || {};

  if (!tenantId) {
    console.log("[Stripe Webhook] No tenantId in subscription metadata");
    return;
  }

  await db
    .update(tenants)
    .set({
      subscriptionStatus: "expired",
      subscriptionPlan: "free",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(`[Stripe Webhook] Tenant ${tenantId} subscription cancelled`);
}

/**
 * Handle successful invoice payment (subscription renewal)
 */
async function handleInvoicePaymentSucceeded(invoice: {
  id: string;
  subscription?: string | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
}) {
  // Subscription renewals are handled by subscription events
  console.log(`[Stripe Webhook] Invoice ${invoice.id} payment succeeded`);
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: {
  id: string;
  subscription?: string | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
}) {
  const tenantId = invoice.subscription_details?.metadata?.tenantId;

  if (!tenantId) {
    console.log("[Stripe Webhook] No tenantId in invoice metadata");
    return;
  }

  // Update subscription status to past_due
  await db
    .update(tenants)
    .set({
      subscriptionStatus: "past_due",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(`[Stripe Webhook] Tenant ${tenantId} payment failed`);
}

/**
 * Handle refund
 */
async function handleRefund(charge: {
  id: string;
  payment_intent?: string | null;
  amount_refunded?: number;
  refunded?: boolean;
  metadata?: Record<string, string> | null;
}) {
  const { orderId, tenantId } = charge.metadata || {};

  if (!orderId || !tenantId || !charge.amount_refunded) {
    console.log(
      `[Stripe Webhook] Refund processed for charge ${charge.id}, amount: ${charge.amount_refunded} (no order/tenant info)`
    );
    return;
  }

  // Get the order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.error(`[Stripe Webhook] Order ${orderId} not found for refund`);
    return;
  }

  const refundAmount = charge.amount_refunded / 100; // Stripe amounts are in cents

  // Update order payment status
  const newAmountPaid = Math.max(
    0,
    parseFloat(order.amountPaid || "0") - refundAmount
  );
  const orderTotal = parseFloat(order.total);

  await db
    .update(orders)
    .set({
      amountPaid: newAmountPaid.toString(),
      amountDue: (orderTotal - newAmountPaid).toString(),
      paymentStatus: charge.refunded ? "refunded" : "partial_refund",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));

  // Create refund transaction record
  await db.insert(orderTransactions).values({
    orderId,
    tenantId,
    type: "refund",
    amount: (-refundAmount).toString(),
    currencyCode: order.currencyCode || "AFN",
    paymentMethod: "card",
    status: "completed",
    gateway: "stripe",
    gatewayTransactionId: charge.id,
    processedAt: new Date().toISOString(),
  });

  // Debit seller earnings
  await debitSellerEarningsForRefund(
    tenantId,
    orderId,
    order.orderNumber,
    refundAmount,
    order.currencyCode || "AFN"
  );

  console.log(
    `[Stripe Webhook] Refund of ${refundAmount} processed for order ${order.orderNumber}`
  );
}
