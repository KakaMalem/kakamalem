/**
 * Common payment gateway types
 *
 * Defines the interface all payment gateways must implement,
 * allowing for easy addition of new gateways (Stripe, PayTabs, etc.)
 */

import type { PaymentGateway } from "@/lib/db/schema";

// =============================================================================
// PAYMENT SESSION
// =============================================================================

export interface CreatePaymentSessionParams {
  /** Tenant/store ID */
  tenantId: string;
  /** Order ID (for store purchases) */
  orderId?: string;
  /** Order number (human-readable) */
  orderNumber?: string;
  /** Invoice ID (for subscription payments) */
  invoiceId?: string;
  /** Payment amount in store's base currency (AFN) */
  amount: number;
  /** Store's base currency code (e.g., "AFN") */
  currency: string;
  /** Customer's display currency (for multi-currency payments) */
  customerCurrency?: string;
  /** Amount in customer's currency */
  customerAmount?: number;
  /** Exchange rate used (1 store currency = X customer currency) */
  exchangeRate?: number;
  /** Payment description */
  description?: string;
  /** URL to redirect on success */
  successUrl: string;
  /** URL to redirect on cancel/failure */
  cancelUrl: string;
  /** Customer email (for receipts) */
  customerEmail?: string;
  /** Customer phone */
  customerPhone?: string;
  /** Customer name */
  customerName?: string;
  /** Line items for the payment */
  items?: PaymentLineItem[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentLineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface PaymentSessionResult {
  success: boolean;
  /** Gateway's session/payment ID */
  sessionId?: string;
  /** URL to redirect customer for payment */
  paymentUrl?: string;
  /** Full gateway response */
  gatewayResponse?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Error code from gateway */
  errorCode?: string;
}

// =============================================================================
// PAYMENT VERIFICATION
// =============================================================================

export interface VerifyPaymentParams {
  /** Gateway's session/transaction ID */
  sessionId: string;
  /** Tenant ID for credential lookup */
  tenantId: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  /** Whether payment was successful */
  paid: boolean;
  /** Payment status from gateway */
  status: "pending" | "completed" | "failed" | "cancelled" | "expired";
  /** Transaction ID from gateway */
  transactionId?: string;
  /** Amount paid */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Card details (if applicable) */
  card?: {
    lastFour?: string;
    brand?: string;
  };
  /** Full gateway response */
  gatewayResponse?: Record<string, unknown>;
  /** Error message */
  error?: string;
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

export interface WebhookEvent {
  /** Gateway's event ID */
  eventId: string;
  /** Event type (e.g., "payment.completed") */
  eventType: string;
  /** Related session/transaction ID */
  sessionId?: string;
  /** Payment status */
  status?: "completed" | "failed" | "pending" | "cancelled";
  /** Amount */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Metadata from original request */
  metadata?: Record<string, unknown>;
  /** Full payload */
  rawPayload: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  event?: WebhookEvent;
  /** Event type (e.g., "payment.completed", "refund.completed") */
  eventType?: string;
  /** Gateway's event ID */
  eventId?: string;
  /** Related session ID */
  sessionId?: string;
  /** Transaction ID */
  transactionId?: string;
  /** Order ID from metadata */
  orderId?: string;
  /** Amount */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Raw event object from gateway */
  rawEvent?: unknown;
  error?: string;
}

// =============================================================================
// REFUND
// =============================================================================

export interface RefundParams {
  /** Original transaction ID */
  transactionId: string;
  /** Amount to refund (if partial) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
  /** Tenant ID for credential lookup */
  tenantId: string;
  /** Order ID (for metadata) */
  orderId?: string;
}

export interface RefundResult {
  success: boolean;
  /** Gateway's refund ID */
  refundId?: string;
  /** Refund status */
  status?: "pending" | "completed" | "failed" | string;
  /** Amount refunded */
  amount?: number;
  /** Currency of refund */
  currency?: string;
  /** Full gateway response */
  gatewayResponse?: Record<string, unknown>;
  /** Error message */
  error?: string;
}

// =============================================================================
// GATEWAY INTERFACE
// =============================================================================

/**
 * Interface that all payment gateway implementations must follow
 */
export interface PaymentGatewayProvider {
  /**
   * Create a payment session and get redirect URL
   */
  createPaymentSession(
    params: CreatePaymentSessionParams,
    credentials: GatewayCredentials
  ): Promise<PaymentSessionResult>;

  /**
   * Verify a payment status
   */
  verifyPayment(
    params: VerifyPaymentParams,
    credentials: GatewayCredentials
  ): Promise<PaymentVerificationResult>;

  /**
   * Verify and parse a webhook event
   */
  verifyWebhook(
    payload: unknown,
    headers: Record<string, string>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult>;

  /**
   * Process a refund
   */
  refund?(
    params: RefundParams,
    credentials: GatewayCredentials
  ): Promise<RefundResult>;
}

// =============================================================================
// CREDENTIALS
// =============================================================================

export interface GatewayCredentials {
  apiKey?: string;
  secretKey?: string;
  merchantId?: string;
  merchantPin?: string;
  webhookSecret?: string;
  isLive: boolean;
  /** Gateway-specific additional settings */
  settings?: Record<string, unknown>;
}

// =============================================================================
// GATEWAY CONFIG
// =============================================================================

export interface EnabledGateway {
  gateway: PaymentGateway;
  displayName: string;
  description?: string;
  displayOrder: number;
  minAmount?: number;
  maxAmount?: number;
  supportedCurrencies?: string[];
  /** Available crypto networks (only for crypto_usdt gateway) */
  cryptoNetworks?: Array<{
    network: "trc20" | "erc20" | "bep20";
    label: string;
    feeHint: string;
  }>;
}
