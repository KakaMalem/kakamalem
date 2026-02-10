/**
 * Payment Gateway Orchestrator
 *
 * Provides a unified interface for all payment operations.
 * Routes requests to the appropriate gateway based on configuration.
 *
 * ESCROW MODEL: All payments go to the platform's HesabPay account.
 * The platform holds funds and pays out to sellers after order fulfillment.
 *
 * Supported gateways:
 * - HesabPay (Afghanistan primary - platform escrow)
 * - COD (Cash on Delivery)
 * - Bank Transfer (Manual verification)
 * - Stripe Connect (Future: UAE/International)
 * - Mobile Money (M-Paisa, M-Hawala)
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  paymentGatewayConfigs,
  paymentSessions,
  cryptoPayments,
} from "@/lib/db/schema";
import type {
  PaymentGateway,
  PaymentGatewayConfig,
  UsdtWalletConfig,
  CryptoNetwork,
} from "@/lib/db/schema";
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
  EnabledGateway,
} from "./types";
import { hesabPayClient } from "./hesabpay";
import { stripeClient } from "./stripe";
import { cryptoUsdtClient } from "./crypto";

// =============================================================================
// GATEWAY REGISTRY
// =============================================================================

/**
 * Registry of available payment gateway implementations
 */
const gatewayProviders: Partial<
  Record<PaymentGateway, PaymentGatewayProvider>
> = {
  hesabpay: hesabPayClient,
  stripe: stripeClient,
  crypto_usdt: cryptoUsdtClient,
};

// =============================================================================
// GATEWAY CONFIG HELPERS
// =============================================================================

/**
 * Get gateway configuration for a tenant
 */
export async function getGatewayConfig(
  tenantId: string,
  gateway: PaymentGateway
): Promise<PaymentGatewayConfig | null> {
  const [config] = await db
    .select()
    .from(paymentGatewayConfigs)
    .where(
      and(
        eq(paymentGatewayConfigs.tenantId, tenantId),
        eq(paymentGatewayConfigs.gateway, gateway),
        eq(paymentGatewayConfigs.isEnabled, true)
      )
    )
    .limit(1);

  return config || null;
}

/**
 * Default payment gateways available to all stores (platform-level)
 */
const DEFAULT_ENABLED_GATEWAYS: EnabledGateway[] = [
  {
    gateway: "hesabpay",
    displayName: "Pay with Card (HesabPay)",
    description: "Secure online payment via HesabPay",
    displayOrder: 0,
  },
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description: "Pay when you receive your order",
    displayOrder: 1,
  },
];

/**
 * Check if crypto USDT payments are enabled at platform level
 * Returns true only if at least one wallet network is enabled with an address
 */
async function isCryptoEnabledAtPlatformLevel(): Promise<boolean> {
  const settings = await db.query.platformSettings.findFirst();
  const walletConfig = settings?.usdtWalletConfig as UsdtWalletConfig | null;

  if (!walletConfig) return false;

  return !!(
    (walletConfig.trc20?.enabled && walletConfig.trc20?.address) ||
    (walletConfig.erc20?.enabled && walletConfig.erc20?.address) ||
    (walletConfig.bep20?.enabled && walletConfig.bep20?.address)
  );
}

/**
 * Get all enabled payment gateways for a tenant
 *
 * If the store has configured payment methods, returns those.
 * Otherwise, returns platform default gateways (HesabPay + COD).
 *
 * Note: crypto_usdt is filtered out if not enabled at platform level.
 */
export async function getEnabledGateways(
  tenantId: string
): Promise<EnabledGateway[]> {
  const configs = await db
    .select()
    .from(paymentGatewayConfigs)
    .where(eq(paymentGatewayConfigs.tenantId, tenantId))
    .orderBy(asc(paymentGatewayConfigs.displayOrder));

  // If no configs exist, return platform defaults
  if (configs.length === 0) {
    return DEFAULT_ENABLED_GATEWAYS;
  }

  // Filter to only enabled gateways
  let enabledConfigs = configs.filter((c) => c.isEnabled);

  // If nothing is enabled, return platform defaults
  if (enabledConfigs.length === 0) {
    return DEFAULT_ENABLED_GATEWAYS;
  }

  // Check if any store wants to use crypto_usdt
  const hasCryptoConfig = enabledConfigs.some(
    (c) => c.gateway === "crypto_usdt"
  );
  if (hasCryptoConfig) {
    // Verify crypto is enabled at platform level before allowing it
    const cryptoPlatformEnabled = await isCryptoEnabledAtPlatformLevel();
    if (!cryptoPlatformEnabled) {
      // Filter out crypto_usdt since platform has disabled it
      enabledConfigs = enabledConfigs.filter(
        (c) => c.gateway !== "crypto_usdt"
      );
    }
  }

  // If filtering removed all configs, return platform defaults
  if (enabledConfigs.length === 0) {
    return DEFAULT_ENABLED_GATEWAYS;
  }

  // Get crypto wallet config if crypto_usdt is enabled
  let cryptoNetworks: EnabledGateway["cryptoNetworks"] | undefined;
  const hasCryptoEnabled = enabledConfigs.some(
    (c) => c.gateway === "crypto_usdt"
  );
  if (hasCryptoEnabled) {
    const settings = await db.query.platformSettings.findFirst();
    const walletConfig = settings?.usdtWalletConfig as UsdtWalletConfig | null;
    if (walletConfig) {
      const networks: NonNullable<EnabledGateway["cryptoNetworks"]> = [];
      if (walletConfig.trc20?.enabled && walletConfig.trc20?.address) {
        networks.push({
          network: "trc20",
          label: "TRC20 (Tron)",
          feeHint: "~$1",
        });
      }
      if (walletConfig.bep20?.enabled && walletConfig.bep20?.address) {
        networks.push({
          network: "bep20",
          label: "BEP20 (BSC)",
          feeHint: "~$0.50",
        });
      }
      if (walletConfig.erc20?.enabled && walletConfig.erc20?.address) {
        networks.push({
          network: "erc20",
          label: "ERC20 (Ethereum)",
          feeHint: "~$5+",
        });
      }
      if (networks.length > 0) {
        cryptoNetworks = networks;
      }
    }
  }

  return enabledConfigs.map((config) => ({
    gateway: config.gateway,
    displayName: config.displayName || getDefaultDisplayName(config.gateway),
    description: config.description || undefined,
    displayOrder: config.displayOrder,
    minAmount: config.minAmount ? parseFloat(config.minAmount) : undefined,
    maxAmount: config.maxAmount ? parseFloat(config.maxAmount) : undefined,
    supportedCurrencies: config.supportedCurrencies as string[] | undefined,
    ...(config.gateway === "crypto_usdt" && cryptoNetworks
      ? { cryptoNetworks }
      : {}),
  }));
}

/**
 * Convert gateway config to credentials
 */
function configToCredentials(config: PaymentGatewayConfig): GatewayCredentials {
  return {
    apiKey: config.apiKey || undefined,
    secretKey: config.secretKey || undefined,
    merchantId: config.merchantId || undefined,
    merchantPin: config.merchantPin || undefined,
    webhookSecret: config.webhookSecret || undefined,
    isLive: config.isLive,
    settings: config.settings as Record<string, unknown> | undefined,
  };
}

/**
 * Get default display name for a gateway
 */
function getDefaultDisplayName(gateway: PaymentGateway): string {
  const names: Record<PaymentGateway, string> = {
    hesabpay: "Pay with Card (HesabPay)",
    stripe: "Pay with Card",
    cod: "Cash on Delivery",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    crypto_usdt: "Pay with USDT",
  };
  return names[gateway] || gateway;
}

/**
 * Get platform-level credentials for payment gateways (escrow model)
 * All payments go to the platform's accounts (HesabPay, Stripe)
 */
async function getPlatformCredentials(
  gateway: PaymentGateway
): Promise<GatewayCredentials | null> {
  if (gateway === "hesabpay") {
    const apiKey = process.env.HESABPAY_API_KEY;
    if (!apiKey) {
      console.error("[Payment] HESABPAY_API_KEY not configured in environment");
      return null;
    }

    const isLive = process.env.NODE_ENV === "production";
    return {
      apiKey,
      isLive,
      // Note: HesabPay verifies webhook signatures via their API using the same API key
      // No separate webhook secret is needed
    };
  }

  if (gateway === "stripe") {
    // Stripe uses environment variables directly via lib/stripe
    // Just return a placeholder to indicate it's configured
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.error(
        "[Payment] STRIPE_SECRET_KEY not configured in environment"
      );
      return null;
    }

    return {
      secretKey,
      isLive: process.env.NODE_ENV === "production",
    };
  }

  if (gateway === "crypto_usdt") {
    // Get wallet config from platform settings
    const settings = await db.query.platformSettings.findFirst();
    const walletConfig = settings?.usdtWalletConfig as UsdtWalletConfig | null;

    if (!walletConfig) {
      console.error(
        "[Payment] USDT wallet config not configured in platform settings"
      );
      return null;
    }

    // Check if at least one network is enabled
    const hasEnabled =
      walletConfig.trc20?.enabled ||
      walletConfig.erc20?.enabled ||
      walletConfig.bep20?.enabled;

    if (!hasEnabled) {
      console.error("[Payment] No USDT networks enabled in platform settings");
      return null;
    }

    return {
      isLive: process.env.NODE_ENV === "production",
      settings: {
        walletConfig,
      },
    };
  }

  return null;
}

// =============================================================================
// PAYMENT OPERATIONS
// =============================================================================

/**
 * Create a payment session with the specified gateway
 *
 * For HesabPay: Uses platform-level credentials (escrow model)
 * All payments go to the platform's account, then paid out to sellers.
 */
export async function createPaymentSession(
  gateway: PaymentGateway,
  params: CreatePaymentSessionParams
): Promise<PaymentSessionResult & { paymentSessionId?: string }> {
  // Get provider implementation
  const provider = gatewayProviders[gateway];
  if (!provider) {
    // Handle non-API gateways (COD, bank_transfer, mobile_money)
    return handleNonApiGateway(gateway, params);
  }

  // Get credentials - use platform credentials for HesabPay, Stripe, and Crypto (escrow model)
  let credentials: GatewayCredentials | null = null;

  if (
    gateway === "hesabpay" ||
    gateway === "stripe" ||
    gateway === "crypto_usdt"
  ) {
    // Use platform-level credentials for escrow
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      const gatewayNames: Record<string, string> = {
        hesabpay: "HesabPay",
        stripe: "Stripe",
        crypto_usdt: "USDT Payment",
      };
      return {
        success: false,
        error: `${gatewayNames[gateway] || gateway} is not configured. Please contact support.`,
      };
    }
  } else {
    // For other gateways, use tenant-specific config
    const config = await getGatewayConfig(params.tenantId, gateway);
    if (!config) {
      return {
        success: false,
        error: `Payment gateway "${gateway}" is not configured for this store`,
      };
    }
    credentials = configToCredentials(config);
  }

  // Create session with the gateway
  const result = await provider.createPaymentSession(params, credentials);

  if (!result.success) {
    return result;
  }

  // Store the payment session in our database
  const [paymentSession] = await db
    .insert(paymentSessions)
    .values({
      tenantId: params.tenantId,
      orderId: params.orderId,
      invoiceId: params.invoiceId,
      gateway,
      amount: params.amount.toString(),
      currency: params.currency,
      gatewaySessionId: result.sessionId,
      gatewaySessionUrl: result.paymentUrl,
      gatewayResponse: result.gatewayResponse,
      status: "pending",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      metadata: params.metadata,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    })
    .returning();

  // For crypto payments, create the crypto payment record and return crypto payment page URL
  if (gateway === "crypto_usdt" && result.gatewayResponse) {
    const cryptoData = result.gatewayResponse as {
      network: CryptoNetwork;
      walletAddress: string;
      expectedAmount: number;
      exchangeRate: number;
      originalAmountAfn: number;
      expiresAt: string;
      qrCodeData: string;
    };

    // Create the crypto payment record
    // Note: orderId is tracked via paymentSessions, not duplicated here
    const [cryptoPayment] = await db
      .insert(cryptoPayments)
      .values({
        paymentSessionId: paymentSession.id,
        tenantId: params.tenantId,
        purpose: "order",
        network: cryptoData.network,
        walletAddress: cryptoData.walletAddress,
        expectedAmount: cryptoData.expectedAmount.toString(),
        exchangeRate: cryptoData.exchangeRate.toString(),
        originalAmountAfn: cryptoData.originalAmountAfn.toString(),
        status: "pending",
        expiresAt: cryptoData.expiresAt,
      })
      .returning();

    // Generate crypto payment page URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const cryptoPaymentUrl = `${baseUrl}/store/${params.metadata?.storeSlug}/checkout/crypto-payment?session=${paymentSession.id}`;

    return {
      ...result,
      paymentUrl: cryptoPaymentUrl,
      paymentSessionId: paymentSession.id,
      gatewayResponse: {
        ...result.gatewayResponse,
        cryptoPaymentId: cryptoPayment.id,
      },
    };
  }

  return {
    ...result,
    paymentSessionId: paymentSession.id,
  };
}

/**
 * Handle non-API payment gateways (COD, bank transfer, mobile money)
 */
async function handleNonApiGateway(
  gateway: PaymentGateway,
  params: CreatePaymentSessionParams
): Promise<PaymentSessionResult & { paymentSessionId?: string }> {
  // For COD and manual payment methods, we just create a session record
  // and redirect to a confirmation page
  const [paymentSession] = await db
    .insert(paymentSessions)
    .values({
      tenantId: params.tenantId,
      orderId: params.orderId,
      invoiceId: params.invoiceId,
      gateway,
      amount: params.amount.toString(),
      currency: params.currency,
      status: gateway === "cod" ? "pending" : "pending", // COD is confirmed at delivery
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      metadata: params.metadata,
    })
    .returning();

  // For COD, redirect directly to success (order will be paid on delivery)
  if (gateway === "cod") {
    return {
      success: true,
      sessionId: paymentSession.id,
      paymentUrl: params.successUrl,
      paymentSessionId: paymentSession.id,
    };
  }

  // For bank transfer and mobile money, redirect to instructions page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const paymentUrl = `${baseUrl}/store/${params.metadata?.storeSlug}/checkout/payment-instructions?session=${paymentSession.id}&method=${gateway}`;

  return {
    success: true,
    sessionId: paymentSession.id,
    paymentUrl,
    paymentSessionId: paymentSession.id,
  };
}

/**
 * Verify a payment status
 */
export async function verifyPayment(
  gateway: PaymentGateway,
  params: VerifyPaymentParams
): Promise<PaymentVerificationResult> {
  // Get provider implementation
  const provider = gatewayProviders[gateway];
  if (!provider) {
    // For non-API gateways, check our session status
    return verifyNonApiPayment(params.sessionId);
  }

  // Get credentials - use platform credentials for HesabPay, Stripe, and Crypto
  let credentials: GatewayCredentials | null = null;

  if (
    gateway === "hesabpay" ||
    gateway === "stripe" ||
    gateway === "crypto_usdt"
  ) {
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      const gatewayNames: Record<string, string> = {
        hesabpay: "HesabPay",
        stripe: "Stripe",
        crypto_usdt: "USDT Payment",
      };
      return {
        success: false,
        paid: false,
        status: "failed",
        error: `${gatewayNames[gateway] || gateway} is not configured`,
      };
    }
  } else {
    const config = await getGatewayConfig(params.tenantId, gateway);
    if (!config) {
      return {
        success: false,
        paid: false,
        status: "failed",
        error: `Payment gateway "${gateway}" is not configured`,
      };
    }
    credentials = configToCredentials(config);
  }

  // Verify with the gateway
  return provider.verifyPayment(params, credentials);
}

/**
 * Verify non-API gateway payment (check our session record)
 */
async function verifyNonApiPayment(
  sessionId: string
): Promise<PaymentVerificationResult> {
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return {
      success: false,
      paid: false,
      status: "failed",
      error: "Payment session not found",
    };
  }

  const isPaid = session.status === "completed";
  return {
    success: true,
    paid: isPaid,
    status: session.status as
      | "pending"
      | "completed"
      | "failed"
      | "cancelled"
      | "expired",
    amount: session.amount ? parseFloat(session.amount) : undefined,
    currency: session.currency,
  };
}

/**
 * Verify and process a webhook event
 */
export async function verifyWebhook(
  gateway: PaymentGateway,
  payload: unknown,
  headers: Record<string, string>,
  _tenantId?: string // Not used for HesabPay (platform-level)
): Promise<WebhookVerificationResult> {
  // Get provider implementation
  const provider = gatewayProviders[gateway];
  if (!provider) {
    return {
      valid: false,
      error: `Webhook handling not supported for gateway "${gateway}"`,
    };
  }

  // Note: HesabPay verifies signatures via their API (no separate secret needed)
  // Other gateways may pass webhookSecret if configured
  return provider.verifyWebhook(payload, headers, undefined);
}

/**
 * Process a refund
 */
export async function processRefund(
  gateway: PaymentGateway,
  params: RefundParams
): Promise<RefundResult> {
  // Get provider implementation
  const provider = gatewayProviders[gateway];
  if (!provider?.refund) {
    return {
      success: false,
      error: `Refunds not supported for gateway "${gateway}"`,
    };
  }

  // Get credentials - use platform credentials for HesabPay and Stripe
  let credentials: GatewayCredentials | null = null;

  if (gateway === "hesabpay" || gateway === "stripe") {
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      const gatewayName = gateway === "hesabpay" ? "HesabPay" : "Stripe";
      return {
        success: false,
        error: `${gatewayName} is not configured`,
      };
    }
  } else {
    const config = await getGatewayConfig(params.tenantId, gateway);
    if (!config) {
      return {
        success: false,
        error: `Payment gateway "${gateway}" is not configured`,
      };
    }
    credentials = configToCredentials(config);
  }

  // Process refund
  return provider.refund(params, credentials);
}

// =============================================================================
// PAYMENT SESSION HELPERS
// =============================================================================

/**
 * Get a payment session by ID
 */
export async function getPaymentSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1);

  return session || null;
}

/**
 * Update payment session status
 */
export async function updatePaymentSessionStatus(
  sessionId: string,
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "expired"
    | "cancelled",
  additionalData?: {
    gatewayResponse?: Record<string, unknown>;
    failureReason?: string;
  }
) {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === "completed") {
    updateData.completedAt = new Date().toISOString();
  } else if (status === "failed") {
    updateData.failedAt = new Date().toISOString();
    if (additionalData?.failureReason) {
      updateData.failureReason = additionalData.failureReason;
    }
  }

  if (additionalData?.gatewayResponse) {
    updateData.gatewayResponse = additionalData.gatewayResponse;
  }

  await db
    .update(paymentSessions)
    .set(updateData)
    .where(eq(paymentSessions.id, sessionId));
}

/**
 * Get payment session by gateway session ID
 */
export async function getPaymentSessionByGatewayId(
  gatewaySessionId: string,
  gateway: PaymentGateway
) {
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.gatewaySessionId, gatewaySessionId),
        eq(paymentSessions.gateway, gateway)
      )
    )
    .limit(1);

  return session || null;
}

// Re-export types
export * from "./types";
