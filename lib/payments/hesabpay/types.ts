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
// Note: HesabPay uses the same API URL for both test and production.
// Test vs production mode is determined by the API key, not the URL.
export const HESABPAY_API = {
  /** Production API base URL */
  PRODUCTION_URL: "https://api.hesab.com/api/v1",
  /** Sandbox API base URL (same as production - mode is determined by API key) */
  SANDBOX_URL: "https://api.hesab.com/api/v1",
  /** Create payment session endpoint */
  CREATE_SESSION: "/payment/create-session",
  /** Verify payment endpoint */
  VERIFY_PAYMENT: "/payment/verify",
  /** Refund endpoint */
  REFUND: "/payment/refund",
  /** Webhook signature verification endpoint */
  VERIFY_WEBHOOK_SIGNATURE: "/hesab/webhooks/verify-signature",
} as const;

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
