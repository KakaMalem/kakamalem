/**
 * Payment Gateway Orchestrator
 *
 * Unified interface for payment operations.
 * Routes requests to the appropriate gateway based on configuration.
 *
 * Supported gateways:
 * - HesabPay (Afghanistan + International via hosted checkout)
 * - COD (Cash on Delivery)
 * - Bank Transfer (Manual verification)
 * - Mobile Money (M-Paisa, M-Hawala)
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  paymentGatewayConfigs,
  paymentSessions,
  tenants,
} from "@/lib/db/schema";
import type { PaymentGateway, PaymentGatewayConfig } from "@/lib/db/schema";
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
import {
  HESABPAY_CURRENCY,
  canStoreUseHesabPay,
  parseExchangeRate,
} from "./currency";

// =============================================================================
// GATEWAY REGISTRY
// =============================================================================

const gatewayProviders: Partial<
  Record<PaymentGateway, PaymentGatewayProvider>
> = {
  hesabpay: hesabPayClient,
};

// =============================================================================
// GATEWAY CONFIG HELPERS
// =============================================================================

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
 * Default payment gateways for new stores.
 */
const DEFAULT_ENABLED_GATEWAYS: EnabledGateway[] = [
  {
    gateway: "hesabpay",
    displayName: "Pay with Card (HesabPay)",
    description: "Secure payment via HesabPay",
    displayOrder: 0,
  },
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description: "Pay when your order arrives",
    displayOrder: 1,
  },
];

/**
 * Get all enabled payment gateways for a tenant
 *
 * If the store has configured payment methods, returns those.
 * Otherwise, returns platform default gateways (HesabPay + COD).
 */
export async function getEnabledGateways(
  tenantId: string
): Promise<EnabledGateway[]> {
  const [configs, store] = await Promise.all([
    db
      .select()
      .from(paymentGatewayConfigs)
      .where(eq(paymentGatewayConfigs.tenantId, tenantId))
      .orderBy(asc(paymentGatewayConfigs.displayOrder)),
    db
      .select({
        currency: tenants.currency,
        afnExchangeRate: tenants.afnExchangeRate,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
      .then((rows) => rows[0] || null),
  ]);

  const enabledConfigs = configs.filter((c) => c.isEnabled);

  const gateways: EnabledGateway[] =
    enabledConfigs.length === 0
      ? DEFAULT_ENABLED_GATEWAYS
      : enabledConfigs.map((config) => ({
          gateway: config.gateway,
          displayName:
            config.displayName || getDefaultDisplayName(config.gateway),
          description: config.description || undefined,
          displayOrder: config.displayOrder,
          minAmount: config.minAmount
            ? parseFloat(config.minAmount)
            : undefined,
          maxAmount: config.maxAmount
            ? parseFloat(config.maxAmount)
            : undefined,
          supportedCurrencies: config.supportedCurrencies as
            | string[]
            | undefined,
        }));

  return applyHesabPayCurrencyRules(gateways, store);
}

/**
 * HesabPay settles in AFN only. Drop it from the list when the store prices in
 * another currency and has no AFN exchange rate configured (otherwise the
 * customer picks it and hits a dead end), and annotate it with the conversion
 * so the storefront can tell the customer what they will actually be charged.
 */
function applyHesabPayCurrencyRules(
  gateways: EnabledGateway[],
  store: { currency: string; afnExchangeRate: string | null } | null
): EnabledGateway[] {
  const storeCurrency = (store?.currency || HESABPAY_CURRENCY).toUpperCase();

  if (storeCurrency === HESABPAY_CURRENCY) {
    return gateways;
  }

  const rate = parseExchangeRate(store?.afnExchangeRate);

  return gateways.flatMap((gateway) => {
    if (gateway.gateway !== "hesabpay") return [gateway];
    if (!canStoreUseHesabPay(storeCurrency, rate)) return [];
    return [
      {
        ...gateway,
        chargeCurrency: HESABPAY_CURRENCY,
        chargeExchangeRate: rate ?? undefined,
      },
    ];
  });
}

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

function getDefaultDisplayName(gateway: PaymentGateway): string {
  const names: Record<PaymentGateway, string> = {
    hesabpay: "Pay with Card (HesabPay)",
    cod: "Cash on Delivery",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
  };
  return names[gateway] || gateway;
}

/**
 * Get platform-level credentials for HesabPay (used for subscription payments).
 */
export async function getPlatformCredentials(
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
      // Only needed to send money out (seller payouts), not to take it in.
      merchantPin: process.env.HESABPAY_MERCHANT_PIN || undefined,
      isLive,
    };
  }

  return null;
}

// =============================================================================
// PAYMENT OPERATIONS
// =============================================================================

export async function createPaymentSession(
  gateway: PaymentGateway,
  params: CreatePaymentSessionParams
): Promise<PaymentSessionResult & { paymentSessionId?: string }> {
  const provider = gatewayProviders[gateway];
  if (!provider) {
    return handleNonApiGateway(gateway, params);
  }

  let credentials: GatewayCredentials | null = null;

  if (gateway === "hesabpay") {
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      return {
        success: false,
        error: "HesabPay is not configured. Please contact support.",
      };
    }
  } else {
    const config = await getGatewayConfig(params.tenantId, gateway);
    if (!config) {
      return {
        success: false,
        error: `Payment gateway "${gateway}" is not configured for this store`,
      };
    }
    credentials = configToCredentials(config);
  }

  const result = await provider.createPaymentSession(params, credentials);

  if (!result.success) {
    return result;
  }

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
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .returning();

  return {
    ...result,
    paymentSessionId: paymentSession.id,
  };
}

async function handleNonApiGateway(
  gateway: PaymentGateway,
  params: CreatePaymentSessionParams
): Promise<PaymentSessionResult & { paymentSessionId?: string }> {
  const [paymentSession] = await db
    .insert(paymentSessions)
    .values({
      tenantId: params.tenantId,
      orderId: params.orderId,
      invoiceId: params.invoiceId,
      gateway,
      amount: params.amount.toString(),
      currency: params.currency,
      status: "pending",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      metadata: params.metadata,
    })
    .returning();

  if (gateway === "cod") {
    return {
      success: true,
      sessionId: paymentSession.id,
      paymentUrl: params.successUrl,
      paymentSessionId: paymentSession.id,
    };
  }

  const manualStoreBaseUrl =
    params.metadata?.storeBaseUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL || ""}/store/${params.metadata?.storeSlug}`;
  const paymentUrl = `${manualStoreBaseUrl}/checkout/payment-instructions?session=${paymentSession.id}&method=${gateway}`;

  return {
    success: true,
    sessionId: paymentSession.id,
    paymentUrl,
    paymentSessionId: paymentSession.id,
  };
}

export async function verifyPayment(
  gateway: PaymentGateway,
  params: VerifyPaymentParams
): Promise<PaymentVerificationResult> {
  const provider = gatewayProviders[gateway];
  if (!provider) {
    return verifyNonApiPayment(params.sessionId);
  }

  let credentials: GatewayCredentials | null = null;

  if (gateway === "hesabpay") {
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      return {
        success: false,
        paid: false,
        status: "failed",
        error: "HesabPay is not configured",
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

  return provider.verifyPayment(params, credentials);
}

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

export async function verifyWebhook(
  gateway: PaymentGateway,
  payload: unknown,
  headers: Record<string, string>,
  _tenantId?: string
): Promise<WebhookVerificationResult> {
  const provider = gatewayProviders[gateway];
  if (!provider) {
    return {
      valid: false,
      error: `Webhook handling not supported for gateway "${gateway}"`,
    };
  }

  return provider.verifyWebhook(payload, headers, undefined);
}

export async function processRefund(
  gateway: PaymentGateway,
  params: RefundParams
): Promise<RefundResult> {
  const provider = gatewayProviders[gateway];
  if (!provider?.refund) {
    return {
      success: false,
      error: `Refunds not supported for gateway "${gateway}"`,
    };
  }

  let credentials: GatewayCredentials | null = null;

  if (gateway === "hesabpay") {
    credentials = await getPlatformCredentials(gateway);
    if (!credentials) {
      return {
        success: false,
        error: "HesabPay is not configured",
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

  return provider.refund(params, credentials);
}

// =============================================================================
// PAYMENT SESSION HELPERS
// =============================================================================

export async function getPaymentSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1);

  return session || null;
}

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

export * from "./types";
