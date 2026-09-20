/**
 * HesabPay API Types
 *
 * Based on HesabPay API documentation
 * https://api.hesab.com
 */

// =============================================================================
// CREATE SESSION REQUEST
// =============================================================================

export interface HesabPayCreateSessionRequest {
  /** Customer email (optional) */
  email?: string;
  /** Items to be paid for */
  items: HesabPayItem[];
  /** Success redirect URL */
  redirect_success_url: string;
  /** Failure redirect URL */
  redirect_failure_url: string;
}

export interface HesabPayItem {
  /** Unique item identifier */
  id: string;
  /** Item name */
  name: string;
  /** Item price in AFN */
  price: number;
}

// =============================================================================
// CREATE SESSION RESPONSE
// =============================================================================

export interface HesabPayCreateSessionResponse {
  /** Status code from HesabPay (10 = success) */
  status_code?: number;
  /** Whether the request was successful */
  success?: boolean;
  /** Response message */
  message?: string;
  /** Session ID for tracking */
  session_id?: string;
  /** Payment session URL (redirect customer here) - legacy format */
  payment_url?: string;
  /** Payment URL - HesabPay returns this directly on success */
  url?: string;
  /** Session expiration time */
  expires_at?: string;
  /** Error code (if failed) */
  error_code?: string;
}

// =============================================================================
// VERIFY PAYMENT RESPONSE
// =============================================================================

export interface HesabPayVerifyResponse {
  success: boolean;
  /** Payment status */
  status?: "pending" | "completed" | "failed" | "cancelled" | "expired";
  /** Transaction ID */
  transactionId?: string;
  /** Amount paid */
  amount?: number;
  /** Currency */
  currency?: string;
  /** Payment method used */
  paymentMethod?: string;
  /** Card details (if card payment) */
  card?: {
    lastFour?: string;
    brand?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
  /** Customer info */
  customer?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  /** Original metadata */
  metadata?: Record<string, unknown>;
  /** Error message */
  message?: string;
}

// =============================================================================
// WEBHOOK PAYLOAD
// =============================================================================

/**
 * Webhook payload from HesabPay
 *
 * HesabPay sends this payload to your registered webhook URL.
 * You register separate URLs for "Payment Success" and "Payment Failure" events.
 */
export interface HesabPayWebhookPayload {
  /** Status code (10 = success) */
  status_code: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Response message */
  message?: string;
  /** Sender's HesabPay account number */
  sender_account?: string;
  /** Unique transaction ID from HesabPay */
  transaction_id: string;
  /** Amount paid */
  amount: number;
  /** Payment memo/description */
  memo?: string;
  /** HMAC signature for verification */
  signature: string;
  /** Unix timestamp as string */
  timestamp: string;
  /** Formatted transaction date "YYYY-MM-DD HH:MM:SS" */
  transaction_date?: string;
  /** Items from original payment request */
  items?: HesabPayItem[];
  /** Customer email */
  email?: string;
  /** Session ID (if included) */
  session_id?: string;
  /** Error details (for failures) */
  error?: {
    code?: string;
    message?: string;
  };
}

// =============================================================================
// REFUND REQUEST/RESPONSE
// =============================================================================

export interface HesabPayRefundRequest {
  /** Original transaction ID */
  transactionId: string;
  /** Amount to refund (optional for full refund) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
}

export interface HesabPayRefundResponse {
  success: boolean;
  /** Refund ID */
  refundId?: string;
  /** Refund status */
  status?: "pending" | "completed" | "failed";
  /** Amount refunded */
  amount?: number;
  /** Error message */
  message?: string;
}

// =============================================================================
// API CONFIG
// =============================================================================

export interface HesabPayConfig {
  /** API base URL */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /** Merchant PIN (if required) */
  merchantPin?: string;
  /** Webhook secret for signature verification */
  webhookSecret?: string;
  /** Request timeout in ms */
  timeout?: number;
}

// HesabPay API endpoints
// Production: api.hesab.com, Sandbox: api-sandbox.hesab.com
// Override with HESABPAY_API_URL env var if needed
export const HESABPAY_API = {
  /** Production API base URL */
  PRODUCTION_URL: "https://api.hesab.com/api/v1",
  /** Sandbox API base URL */
  SANDBOX_URL: "https://api-sandbox.hesab.com/api/v1",
  /** Create payment session endpoint */
  CREATE_SESSION: "/payment/create-session",
  /** Verify payment endpoint */
  VERIFY_PAYMENT: "/payment/verify",
  /** Refund endpoint */
  REFUND: "/payment/refund",
  /** Webhook signature verification endpoint */
  VERIFY_WEBHOOK_SIGNATURE: "/hesab/webhooks/verify-signature",
  /** Send money to one or more vendor accounts (marketplace payouts) */
  SEND_MONEY_MULTI_VENDOR: "/payment/send-money-MultiVendor",
} as const;

/**
 * HesabPay accepts at most 16 vendors in one send-money call. Stay under it.
 */
export const HESABPAY_MAX_VENDORS_PER_TRANSFER = 15;

/** One destination in a send-money-MultiVendor call. */
export interface HesabPayVendorTransfer {
  /** Destination HesabPay account number. */
  account_number: string;
  /** Amount in AFN. */
  amount: number;
}

export interface HesabPaySendMoneyRequest {
  /** Merchant PIN, encrypted with the API key (never sent in plaintext). */
  pin: string;
  vendors: HesabPayVendorTransfer[];
}

export interface HesabPaySendMoneyResponse {
  success?: boolean;
  status_code?: number;
  /**
   * NOT always a string. A rejected transfer can return a validation map such
   * as `{"pin": ["Invalid PIN"]}`, so this is deliberately `unknown` and must
   * go through `extractGatewayMessage()` before being shown or stored.
   */
  message?: unknown;
  transaction_id?: string;
  /** Per-vendor outcome, when HesabPay reports one. */
  results?: Array<{
    account_number?: string;
    amount?: number;
    success?: boolean;
    message?: unknown;
    transaction_id?: string;
  }>;
}

// =============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// =============================================================================

export interface HesabPayVerifySignatureRequest {
  /** The signature from the webhook payload */
  signature: string;
  /** The timestamp from the webhook payload */
  timestamp: string;
}

export interface HesabPayVerifySignatureResponse {
  /** Whether the signature is valid */
  success: boolean;
  /** Status code */
  status_code?: number;
  /** Response message */
  message?: string;
}
