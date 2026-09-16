/**
 * HesabPay Payment Gateway Client
 *
 * Implements the PaymentGatewayProvider interface for HesabPay.
 * HesabPay is Afghanistan's primary digital payment solution,
 * built on Algorand blockchain for fast, low-cost settlements.
 *
 * API Documentation: https://hesab.com
 */

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
import {
  HESABPAY_API,
  type HesabPayCreateSessionRequest,
  type HesabPayCreateSessionResponse,
  type HesabPayVerifyResponse,
  type HesabPayWebhookPayload,
  type HesabPayRefundResponse,
  type HesabPayVerifySignatureResponse,
  type HesabPayItem,
} from "./types";
import { HESABPAY_CURRENCY } from "../currency";

// =============================================================================
// HESABPAY CLIENT
// =============================================================================

export class HesabPayClient implements PaymentGatewayProvider {
  readonly gateway = "hesabpay" as const;
  readonly displayName = "HesabPay";

  private getBaseUrl(): string {
    return HESABPAY_API.PRODUCTION_URL;
  }

  /**
   * Create a payment session with HesabPay
   */
  async createPaymentSession(
    params: CreatePaymentSessionParams,
    credentials: GatewayCredentials
  ): Promise<PaymentSessionResult> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${HESABPAY_API.CREATE_SESSION}`;

    // HesabPay's create-session payload has no currency field: every price it
    // receives is treated as AFN. Callers must convert before reaching here.
    if (
      (params.currency || HESABPAY_CURRENCY).toUpperCase() !== HESABPAY_CURRENCY
    ) {
      console.error(
        `[HesabPay] Refusing to create a session in ${params.currency} — HesabPay only accepts AFN`
      );
      return {
        success: false,
        error: "HesabPay can only charge in Afghani (AFN).",
      };
    }

    // HesabPay echoes `items` back on the webhook, so the item id is our most
    // reliable handle on what was paid for. Its own WooCommerce plugin puts the
    // order id on every line and reads items[0].id in the webhook; do the same.
    const reference = params.orderId || params.invoiceId || "order-payment";

    // Build the request payload according to HesabPay API docs
    const items: HesabPayItem[] = params.items?.map((item) => ({
      id: reference,
      name: item.name,
      // HesabPay expects the total price per line, in whole AFN
      price: Math.round(item.unitPrice * item.quantity),
    })) || [
      {
        id: reference,
        name: "Order Payment",
        price: Math.round(params.amount),
      },
    ];

    const payload: HesabPayCreateSessionRequest = {
      email: params.customerEmail,
      items,
      redirect_success_url: params.successUrl,
      redirect_failure_url: params.cancelUrl,
    };

    try {
      console.log("[HesabPay] Creating session:", {
        url,
        email: payload.email,
        itemCount: payload.items.length,
        totalAmount: payload.items.reduce((sum, i) => sum + i.price, 0),
        successUrl: payload.redirect_success_url,
        failureUrl: payload.redirect_failure_url,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `API-KEY ${credentials.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data: HesabPayCreateSessionResponse = await response.json();

      console.log("[HesabPay] Response:", {
        httpStatus: response.status,
        data,
      });

      // HesabPay returns `url` directly on success (not wrapped in success/session_id)
      const paymentUrl = data.url || data.payment_url;

      // Check for success: either explicit success=true, or we got a payment URL
      if (
        !response.ok ||
        data.success === false ||
        (!paymentUrl && data.error_code)
      ) {
        console.error("[HesabPay] Session creation failed:", {
          httpStatus: response.status,
          message: data.message,
          errorCode: data.error_code,
          fullResponse: data,
        });
        return {
          success: false,
          error: data.message || "Failed to create payment session",
          errorCode: data.error_code,
          gatewayResponse: data as unknown as Record<string, unknown>,
        };
      }

      // If response was OK but no payment URL found, that's still an error
      if (!paymentUrl) {
        console.error("[HesabPay] Response OK but no payment URL found:", data);
        return {
          success: false,
          error:
            data.message ||
            "Payment session created but no redirect URL received",
          gatewayResponse: data as unknown as Record<string, unknown>,
        };
      }

      // Extract session ID from URL if not provided directly
      // URL format: https://developers.hesab.com/checkout/{session_id}?data=...
      let sessionId = data.session_id;
      if (!sessionId && paymentUrl) {
        const urlMatch = paymentUrl.match(/\/checkout\/([a-f0-9-]+)/);
        if (urlMatch) {
          sessionId = urlMatch[1];
        }
      }

      return {
        success: true,
        sessionId,
        paymentUrl,
        gatewayResponse: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      console.error("[HesabPay] Create session error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to HesabPay",
      };
    }
  }

  /**
   * Verify a payment status
   */
  async verifyPayment(
    params: VerifyPaymentParams,
    credentials: GatewayCredentials
  ): Promise<PaymentVerificationResult> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${HESABPAY_API.VERIFY_PAYMENT}/${params.sessionId}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `API-KEY ${credentials.apiKey}`,
        },
      });

      const data: HesabPayVerifyResponse = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          paid: false,
          status: "failed",
          error: data.message || "Failed to verify payment",
          gatewayResponse: data as unknown as Record<string, unknown>,
        };
      }

      const isPaid = data.status === "completed";

      return {
        success: true,
        paid: isPaid,
        status: data.status || "pending",
        transactionId: data.transactionId,
        amount: data.amount,
        currency: data.currency,
        card: data.card
          ? {
              lastFour: data.card.lastFour,
              brand: data.card.brand,
            }
          : undefined,
        gatewayResponse: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      console.error("[HesabPay] Verify payment error:", error);
      return {
        success: false,
        paid: false,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Failed to verify payment",
      };
    }
  }

  /**
   * Verify webhook signature and parse event
   *
   * HesabPay requires calling their API endpoint to verify signatures.
   * POST to /hesab/webhooks/verify-signature with signature and timestamp.
   */
  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string>,
    _webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    try {
      const body = payload as HesabPayWebhookPayload;

      // Get API key from environment (platform-level)
      const apiKey = process.env.HESABPAY_API_KEY;
      const isLive = process.env.NODE_ENV === "production";

      if (!apiKey) {
        console.error("[HesabPay] HESABPAY_API_KEY not configured");
        return {
          valid: false,
          error: "HesabPay API key not configured",
        };
      }

      // Require signature and timestamp — reject if missing
      if (!body.signature || !body.timestamp) {
        console.error("[HesabPay] Webhook missing signature or timestamp");
        return {
          valid: false,
          error: "Missing signature or timestamp",
        };
      }

      // Reject stale webhooks (older than 5 minutes) to prevent replay attacks
      const webhookTime = parseInt(body.timestamp, 10) * 1000;
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (isNaN(webhookTime) || Math.abs(now - webhookTime) > maxAge) {
        console.error(
          `[HesabPay] Webhook timestamp too old or invalid: ${body.timestamp}`
        );
        return {
          valid: false,
          error: "Webhook timestamp expired or invalid",
        };
      }

      // Verify signature via HesabPay API
      const isValid = await this.verifySignatureViaApi(
        body.signature,
        body.timestamp,
        isLive,
        apiKey
      );

      if (!isValid) {
        console.error("[HesabPay] Webhook signature verification failed");
        return {
          valid: false,
          error: "Invalid webhook signature",
        };
      }

      // Determine event type from success field
      const eventType = body.success ? "payment.success" : "payment.failure";

      // Parse the event
      return {
        valid: true,
        event: {
          eventId: `${body.transaction_id}-${body.timestamp}`,
          eventType,
          sessionId: body.session_id || body.memo, // Session ID might be in memo
          status: body.success ? "completed" : "failed",
          amount: body.amount,
          rawPayload: body as unknown as Record<string, unknown>,
        },
      };
    } catch (error) {
      console.error("[HesabPay] Webhook verification error:", error);
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Failed to verify webhook",
      };
    }
  }

  /**
   * Verify webhook signature via HesabPay API
   *
   * Sends POST request to HesabPay's verification endpoint
   * Requires API-KEY authorization header
   */
  private async verifySignatureViaApi(
    signature: string,
    timestamp: string,
    _isLive: boolean,
    apiKey: string
  ): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${HESABPAY_API.VERIFY_WEBHOOK_SIGNATURE}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `API-KEY ${apiKey}`,
        },
        body: JSON.stringify({
          signature,
          timestamp,
        }),
      });

      const data: HesabPayVerifySignatureResponse = await response.json();

      if (!response.ok) {
        console.error(
          "[HesabPay] Signature verification API error:",
          data.message
        );
        return false;
      }

      return data.success === true;
    } catch (error) {
      console.error("[HesabPay] Signature verification request failed:", error);
      return false;
    }
  }

  /**
   * Process a refund
   */
  async refund(
    params: RefundParams,
    credentials: GatewayCredentials
  ): Promise<RefundResult> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${HESABPAY_API.REFUND}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `API-KEY ${credentials.apiKey}`,
        },
        body: JSON.stringify({
          transaction_id: params.transactionId,
          amount: params.amount,
          reason: params.reason,
        }),
      });

      const data: HesabPayRefundResponse = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.message || "Failed to process refund",
          gatewayResponse: data as unknown as Record<string, unknown>,
        };
      }

      return {
        success: true,
        refundId: data.refundId,
        status: data.status || "pending",
        amount: data.amount,
        gatewayResponse: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      console.error("[HesabPay] Refund error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process refund",
      };
    }
  }
}

// Export singleton instance
export const hesabPayClient = new HesabPayClient();
