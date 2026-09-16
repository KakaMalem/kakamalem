/**
 * HesabPay Webhook Handler
 *
 * Receives and processes webhook events from HesabPay:
 * - payment.success: Payment completed successfully
 * - payment.failure: Payment failed or declined
 *
 * Webhook URL: /api/webhooks/hesabpay
 * Register this URL in your HesabPay dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  paymentWebhookEvents,
  paymentSessions,
  invoices,
  tenants,
  billingTransactions,
} from "@/lib/db/schema";
import { verifyWebhook, getPaymentSessionByGatewayId } from "@/lib/payments";
import { HESABPAY_CURRENCY } from "@/lib/payments/currency";
import { recordGatewayPaymentForOrder } from "@/lib/payments/order-payment";
import type { HesabPayWebhookPayload } from "@/lib/payments/hesabpay/types";

// Disable body parsing - we need the raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  let webhookEventId: string | undefined;

  try {
    // Get tenant ID from query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    // Parse the webhook payload
    const payload = (await request.json()) as HesabPayWebhookPayload;

    // Get headers for signature verification
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Determine event type from success field (HesabPay doesn't send event type)
    const eventType = payload.success ? "payment.success" : "payment.failure";

    // Log the webhook event (before processing)
    const [webhookEvent] = await db
      .insert(paymentWebhookEvents)
      .values({
        tenantId: tenantId || null,
        gateway: "hesabpay",
        eventId: `${payload.transaction_id}-${payload.timestamp}`,
        eventType,
        payload: payload as unknown as Record<string, unknown>,
        headers,
        status: "received",
        sourceIp,
      })
      .returning();

    webhookEventId = webhookEvent.id;

    // Verify the webhook signature
    const verification = await verifyWebhook(
      "hesabpay",
      payload,
      headers,
      tenantId || undefined
    );

    if (!verification.valid) {
      console.error(
        "[HesabPay Webhook] Invalid signature:",
        verification.error
      );

      // Update webhook event status
      await db
        .update(paymentWebhookEvents)
        .set({
          status: "failed",
          errorMessage: verification.error || "Invalid signature",
          processedAt: new Date().toISOString(),
        })
        .where(eq(paymentWebhookEvents.id, webhookEventId));

      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Update webhook event to processing
    await db
      .update(paymentWebhookEvents)
      .set({ status: "processing" })
      .where(eq(paymentWebhookEvents.id, webhookEventId));

    // Process based on event type (determined from success field)
    let orderId: string | undefined;
    let transactionId: string | undefined;

    if (payload.success) {
      const result = await handlePaymentSuccess(payload, tenantId || undefined);
      orderId = result.orderId;
      transactionId = result.transactionId;
    } else {
      await handlePaymentFailure(payload, tenantId || undefined);
    }

    // Update webhook event as processed
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "processed",
        processedAt: new Date().toISOString(),
        orderId,
        transactionId,
      })
      .where(eq(paymentWebhookEvents.id, webhookEventId));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[HesabPay Webhook] Error:", error);

    // Update webhook event as failed
    if (webhookEventId) {
      await db
        .update(paymentWebhookEvents)
        .set({
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          processedAt: new Date().toISOString(),
        })
        .where(eq(paymentWebhookEvents.id, webhookEventId));
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// SESSION MATCHING
// =============================================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Work out which payment session a webhook belongs to.
 *
 * HesabPay does not reliably echo our session id, but it does echo the `items`
 * we sent, so we put the order (or invoice) id on every item when creating the
 * session — the same trick HesabPay's own WooCommerce plugin uses. Strategies,
 * most to least reliable:
 *
 *   1. `session_id` / `memo` matched against the gateway session id
 *   2. the order or invoice id echoed back in `items[0].id`
 *   3. tenant + exact amount + created in the last hour (needs `?tenantId=`
 *      on the webhook URL, so it only works for per-tenant registrations)
 */
async function findSessionForWebhook(
  payload: HesabPayWebhookPayload,
  webhookTenantId?: string
) {
  const gatewaySessionId = payload.session_id || payload.memo;
  if (gatewaySessionId) {
    const session = await getPaymentSessionByGatewayId(
      gatewaySessionId,
      "hesabpay"
    );
    if (session) return session;
  }

  const reference = payload.items?.[0]?.id;
  if (reference && UUID_PATTERN.test(reference)) {
    const [matched] = await db
      .select()
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.gateway, "hesabpay"),
          or(
            eq(paymentSessions.orderId, reference),
            eq(paymentSessions.invoiceId, reference)
          )
        )
      )
      .orderBy(desc(paymentSessions.createdAt))
      .limit(1);

    if (matched) {
      console.log(
        `[HesabPay Webhook] Matched session by item reference ${reference}: ${matched.id}`
      );
      return matched;
    }
  }

  // Fallback: match by tenantId + amount + created within the last hour
  // Requires tenantId from webhook URL query params for security
  if (payload.amount && webhookTenantId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [matched] = await db
      .select()
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.gateway, "hesabpay"),
          eq(paymentSessions.status, "pending"),
          eq(paymentSessions.tenantId, webhookTenantId),
          eq(paymentSessions.amount, payload.amount.toString()),
          gte(paymentSessions.createdAt, oneHourAgo)
        )
      )
      .orderBy(desc(paymentSessions.createdAt))
      .limit(1);

    if (matched) {
      console.log(
        `[HesabPay Webhook] Matched session by tenant+amount fallback: ${matched.id}`
      );
      return matched;
    }
  }

  return null;
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle successful payment (payment.success event)
 */
async function handlePaymentSuccess(
  payload: HesabPayWebhookPayload,
  webhookTenantId?: string
): Promise<{ orderId?: string; transactionId?: string }> {
  const session = await findSessionForWebhook(payload, webhookTenantId);

  if (!session) {
    console.error(
      `[HesabPay Webhook] No matching session found for transaction ${payload.transaction_id} (amount: ${payload.amount})`
    );
    return {};
  }

  // Update payment session status
  await db
    .update(paymentSessions)
    .set({
      status: "completed",
      completedAt: new Date().toISOString(),
      gatewayResponse: payload as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentSessions.id, session.id));

  // If this is for an order, mark it as paid.
  // HesabPay always settles in AFN, which is not necessarily the order's
  // currency — recordGatewayPaymentForOrder converts using the rate locked onto
  // the order, de-duplicates webhook replays, and writes the payment ledger.
  if (session.orderId) {
    const result = await recordGatewayPaymentForOrder({
      orderId: session.orderId,
      gateway: "hesabpay",
      amount: payload.amount ?? parseFloat(session.amount),
      currency: session.currency || HESABPAY_CURRENCY,
      transactionId: payload.transaction_id,
      gatewayResponse: payload as unknown as Record<string, unknown>,
    });

    if (result.recorded) {
      console.log(
        `[HesabPay Webhook] Order ${session.orderId} marked as ${result.isFullyPaid ? "paid" : "partially paid"}`
      );
    } else {
      console.log(
        `[HesabPay Webhook] Order ${session.orderId} not credited (${result.reason})`
      );
    }

    return { orderId: session.orderId, transactionId: result.transactionId };
  }

  // If this is for an invoice (subscription payment)
  if (session.invoiceId) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, session.invoiceId))
      .limit(1);

    if (invoice && invoice.status !== "paid") {
      // Update invoice
      await db
        .update(invoices)
        .set({
          status: "paid",
          paidAt: new Date().toISOString(),
          paidAmount: payload.amount?.toString() || session.amount,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(invoices.id, session.invoiceId));

      // Determine billing interval from invoice items
      const isYearly = (
        invoice.items as Array<{ description?: string }> | null
      )?.some((item) => item.description?.toLowerCase().includes("yearly"));

      // Check if this is a renewal (tenant already has a start date)
      const [currentTenant] = await db
        .select({ subscriptionStartedAt: tenants.subscriptionStartedAt })
        .from(tenants)
        .where(eq(tenants.id, invoice.tenantId))
        .limit(1);

      // Update tenant subscription status
      await db
        .update(tenants)
        .set({
          subscriptionStatus: "active",
          subscriptionPlan: "pro",
          // Only set subscriptionStartedAt for new subscriptions, not renewals
          ...(currentTenant?.subscriptionStartedAt
            ? {}
            : { subscriptionStartedAt: new Date().toISOString() }),
          subscriptionEndsAt: invoice.periodEnd,
          billingInterval: isYearly ? "yearly" : "monthly",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tenants.id, invoice.tenantId));

      // Update billing transaction status (if exists)
      await db
        .update(billingTransactions)
        .set({
          status: "completed",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(billingTransactions.invoiceId, session.invoiceId));

      console.log(
        `[HesabPay Webhook] Invoice ${invoice.invoiceNumber} marked as paid, subscription activated`
      );

      // Generate and send subscription invoice PDF + email (non-blocking)
      try {
        const { sendSubscriptionInvoice } =
          await import("@/lib/invoice/send-subscription-invoice");
        await sendSubscriptionInvoice({
          invoiceId: session.invoiceId,
          tenantId: invoice.tenantId,
          paymentMethod: "HesabPay",
          transactionId: payload.transaction_id,
        });
      } catch (invoiceError) {
        console.error(
          "[HesabPay Webhook] Failed to send subscription invoice:",
          invoiceError
        );
      }
    }
  }

  return {};
}

/**
 * Handle failed payment (payment.failure event)
 */
async function handlePaymentFailure(
  payload: HesabPayWebhookPayload,
  webhookTenantId?: string
): Promise<void> {
  const session = await findSessionForWebhook(payload, webhookTenantId);

  if (!session) {
    console.error(
      `[HesabPay Webhook] No matching session for failed payment: ${payload.transaction_id}`
    );
    return;
  }

  // A failure notice that arrives after the payment succeeded (a late retry, or
  // an earlier abandoned attempt) must not undo a completed session.
  if (session.status === "completed") {
    console.log(
      `[HesabPay Webhook] Ignoring failure for already-completed session ${session.id}`
    );
    return;
  }

  // Build failure reason from error details
  const failureReason = payload.error?.message
    ? `${payload.error.code}: ${payload.error.message}`
    : "Payment failed at gateway";

  // Update payment session status
  await db
    .update(paymentSessions)
    .set({
      status: "failed",
      failedAt: new Date().toISOString(),
      failureReason,
      gatewayResponse: payload as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentSessions.id, session.id));

  console.log(
    `[HesabPay Webhook] Payment failed for session ${session.id}: ${failureReason}`
  );
}

// =============================================================================
// GET HANDLER (for testing webhook endpoint)
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "HesabPay webhook endpoint is active",
    gateway: "hesabpay",
    events: ["payment.success", "payment.failure"],
  });
}
