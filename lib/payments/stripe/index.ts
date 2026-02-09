/**
 * Stripe Payment Provider
 *
 * Implements the PaymentGatewayProvider interface for Stripe.
 * Supports multi-currency payments for international customers.
 *
 * Note: This uses platform-level Stripe, not Stripe Connect.
 * All payments go to the platform's account (escrow model).
 */

import { stripe, isStripeEnabled } from "@/lib/stripe";
import type {
  PaymentGatewayProvider,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookVerificationResult,
  RefundParams,
  RefundResult,
  GatewayCredentials,
} from "../types";

/**
 * Stripe payment provider implementation
 */
export const stripeClient: PaymentGatewayProvider = {
  /**
   * Create a Stripe Checkout session for order payment
   */
  async createPaymentSession(
    params: CreatePaymentSessionParams,
    _credentials: GatewayCredentials
  ): Promise<PaymentSessionResult> {
    if (!isStripeEnabled() || !stripe) {
      return {
        success: false,
        error: "Stripe is not configured",
      };
    }

    try {
      // Determine currency - use customer's currency if provided, else store currency
      const currency = (
        params.customerCurrency ||
        params.currency ||
        "USD"
      ).toLowerCase();

      // Calculate amount in smallest currency unit (cents, etc.)
      const amount = params.customerAmount
        ? Math.round(params.customerAmount * 100)
        : Math.round(params.amount * 100);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        currency,
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amount,
              product_data: {
                name: `Order #${params.orderNumber || params.orderId}`,
                description:
                  params.description ||
                  `Order from ${params.metadata?.storeName || "store"}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail || undefined,
        metadata: {
          tenantId: params.tenantId,
          orderId: params.orderId || "",
          invoiceId: params.invoiceId || "",
          storeSlug: (params.metadata?.storeSlug as string) || "",
          // Store exchange rate info for reconciliation
          originalAmountAFN: params.amount.toString(),
          customerCurrency: currency.toUpperCase(),
          exchangeRate: params.exchangeRate?.toString() || "",
        },
        // Collect billing address for international payments
        billing_address_collection: "auto",
        // Allow promotion codes
        allow_promotion_codes: true,
      });

      return {
        success: true,
        sessionId: session.id,
        paymentUrl: session.url || undefined,
        gatewayResponse: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent as string | undefined,
        },
      };
    } catch (error) {
      console.error("[Stripe] Failed to create checkout session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Verify payment status
   */
  async verifyPayment(
    params: VerifyPaymentParams,
    _credentials: GatewayCredentials
  ): Promise<PaymentVerificationResult> {
    if (!isStripeEnabled() || !stripe) {
      return {
        success: false,
        paid: false,
        status: "failed",
        error: "Stripe is not configured",
      };
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(params.sessionId);

      const paid = session.payment_status === "paid";
      let status: PaymentVerificationResult["status"] = "pending";

      if (paid) {
        status = "completed";
      } else if (session.status === "expired") {
        status = "expired";
      } else if (session.status === "complete" && !paid) {
        status = "failed";
      }

      return {
        success: true,
        paid,
        status,
        amount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency?.toUpperCase(),
        transactionId: session.payment_intent as string | undefined,
        gatewayResponse: {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
        },
      };
    } catch (error) {
      console.error("[Stripe] Failed to verify payment:", error);
      return {
        success: false,
        paid: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Verify webhook signature
   */
  async verifyWebhook(
    payload: unknown,
    headers: Record<string, string>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    if (!isStripeEnabled() || !stripe) {
      return { valid: false, error: "Stripe is not configured" };
    }

    const secret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false, error: "Webhook secret not configured" };
    }

    const signature = headers["stripe-signature"];
    if (!signature) {
      return { valid: false, error: "Missing stripe-signature header" };
    }

    try {
      // payload should be the raw request body as string
      const rawBody =
        typeof payload === "string" ? payload : JSON.stringify(payload);

      const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

      // Map Stripe event types to our event types
      let eventType: string = event.type;
      let sessionId: string | undefined;
      let transactionId: string | undefined;
      let orderId: string | undefined;
      let amount: number | undefined;
      let currency: string | undefined;

      // Extract data based on event type
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        eventType = "payment.completed";
        sessionId = session.id;
        transactionId = session.payment_intent as string | undefined;
        orderId = session.metadata?.orderId;
        amount = session.amount_total ? session.amount_total / 100 : undefined;
        currency = session.currency?.toUpperCase();
      } else if (event.type === "checkout.session.expired") {
        const session = event.data.object;
        eventType = "payment.expired";
        sessionId = session.id;
        orderId = session.metadata?.orderId;
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object;
        eventType = "refund.completed";
        transactionId = charge.payment_intent as string | undefined;
        amount = charge.amount_refunded
          ? charge.amount_refunded / 100
          : undefined;
        currency = charge.currency?.toUpperCase();
      }

      return {
        valid: true,
        eventType,
        eventId: event.id,
        sessionId,
        transactionId,
        orderId,
        amount,
        currency,
        rawEvent: event,
      };
    } catch (error) {
      console.error("[Stripe] Webhook verification failed:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  },

  /**
   * Process a refund
   */
  async refund(
    params: RefundParams,
    _credentials: GatewayCredentials
  ): Promise<RefundResult> {
    if (!isStripeEnabled() || !stripe) {
      return { success: false, error: "Stripe is not configured" };
    }

    try {
      const refundParams: {
        payment_intent: string;
        amount?: number;
        reason?: "duplicate" | "fraudulent" | "requested_by_customer";
        metadata: Record<string, string>;
      } = {
        payment_intent: params.transactionId,
        metadata: {
          tenantId: params.tenantId,
          orderId: params.orderId || "",
          reason: params.reason || "",
        },
      };

      if (params.amount) {
        refundParams.amount = Math.round(params.amount * 100);
      }

      if (params.reason === "customer_request") {
        refundParams.reason = "requested_by_customer";
      }

      const refund = await stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency.toUpperCase(),
        status: refund.status || "pending",
      };
    } catch (error) {
      console.error("[Stripe] Refund failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Refund failed",
      };
    }
  },
};
