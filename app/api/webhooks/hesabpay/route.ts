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
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  paymentWebhookEvents,
  paymentSessions,
  orders,
  orderTransactions,
  invoices,
  tenants,
  billingTransactions,
} from "@/lib/db/schema";
import { verifyWebhook, getPaymentSessionByGatewayId } from "@/lib/payments";
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
// EVENT HANDLERS
// =============================================================================

/**
 * Handle successful payment (payment.success event)
 */
async function handlePaymentSuccess(
  payload: HesabPayWebhookPayload,
  webhookTenantId?: string
): Promise<{ orderId?: string; transactionId?: string }> {
  // Find the payment session
  // Try by session_id first, then fall back to matching by tenantId + amount + recent time
  let session = null;

  const sessionId = payload.session_id || payload.memo;
  if (sessionId) {
    session = await getPaymentSessionByGatewayId(sessionId, "hesabpay");
  }

  // Fallback: match by tenantId + amount + created within the last hour
  // Requires tenantId from webhook URL query params for security
  if (!session && payload.amount && webhookTenantId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [matchedSession] = await db
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

    if (matchedSession) {
      console.log(
        `[HesabPay Webhook] Matched session by tenant+amount fallback: ${matchedSession.id}`
      );
      session = matchedSession;
    }
  }

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

  let transactionId: string | undefined;

  // If this is for an order, mark it as paid
  if (session.orderId) {
    // Get the order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, session.orderId))
      .limit(1);

    if (order && order.paymentStatus !== "paid") {
      // Create transaction record
      const [transaction] = await db
        .insert(orderTransactions)
        .values({
          orderId: session.orderId,
          tenantId: session.tenantId,
          type: "payment",
          amount: payload.amount?.toString() || session.amount,
          currencyCode: session.currency, // HesabPay uses AFN by default
          paymentMethod: "card", // HesabPay processes card/digital wallet payments
          status: "completed",
          gateway: "hesabpay",
          gatewayTransactionId: payload.transaction_id,
          gatewayResponse: payload as unknown as Record<string, unknown>,
          // HesabPay webhook doesn't include card details
          processedAt: new Date().toISOString(),
        })
        .returning();

      transactionId = transaction.id;

      // Update order
      const newAmountPaid =
        parseFloat(order.amountPaid || "0") +
        (payload.amount || parseFloat(session.amount));
      const orderTotal = parseFloat(order.total);
      const isFullyPaid = newAmountPaid >= orderTotal;

      await db
        .update(orders)
        .set({
          amountPaid: newAmountPaid.toString(),
          amountDue: (orderTotal - newAmountPaid).toString(),
          paymentStatus: isFullyPaid ? "paid" : "partial",
          isPaid: isFullyPaid,
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
        .where(eq(orders.id, session.orderId));

      console.log(
        `[HesabPay Webhook] Order ${order.orderNumber} marked as ${isFullyPaid ? "paid" : "partially paid"}`
      );
    }

    return { orderId: session.orderId, transactionId };
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
  // Find the payment session (same fallback logic as success handler)
  let session = null;

  const sessionId = payload.session_id || payload.memo;
  if (sessionId) {
    session = await getPaymentSessionByGatewayId(sessionId, "hesabpay");
  }

  if (!session && payload.amount && webhookTenantId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [matchedSession] = await db
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

    session = matchedSession || null;
  }

  if (!session) {
    console.error(
      `[HesabPay Webhook] No matching session for failed payment: ${payload.transaction_id}`
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
    `[HesabPay Webhook] Payment failed for session ${sessionId}: ${failureReason}`
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
