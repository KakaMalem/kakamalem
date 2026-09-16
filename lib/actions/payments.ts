"use server";

/**
 * Payment Server Actions
 *
 * Handles all payment-related operations including:
 * - Creating payment sessions for orders
 * - Creating payment sessions for subscription invoices
 * - Verifying payments
 * - Managing payment gateway configurations
 * - Processing manual payment confirmations (bank transfer, mobile money)
 */

import { revalidatePath } from "next/cache";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders,
  orderTransactions,
  invoices,
  paymentGatewayConfigs,
  paymentSessions,
  tenants,
} from "@/lib/db/schema";
import type { PaymentGateway, PaymentGatewayConfig } from "@/lib/db/schema";
import { getUser, requireAuth } from "@/lib/auth/server";
import { canManageStore, hasMinimumRole } from "@/lib/auth/context";
import {
  createPaymentSession as createSession,
  verifyPayment,
  getEnabledGateways,
  getPaymentSession,
  updatePaymentSessionStatus,
} from "@/lib/payments";
import {
  HESABPAY_CURRENCY,
  resolveHesabPayCharge,
} from "@/lib/payments/currency";
import { recordGatewayPaymentForOrder } from "@/lib/payments/order-payment";

// =============================================================================
// TYPES
// =============================================================================

export type PaymentResult = {
  success: boolean;
  error?: string;
  paymentUrl?: string;
  paymentSessionId?: string;
};

export type PaymentVerifyResult = {
  success: boolean;
  error?: string;
  paid: boolean;
  status: string;
  orderId?: string;
};

// =============================================================================
// ORDER PAYMENT
// =============================================================================

/**
 * Create a payment session for an order
 */
export async function createOrderPaymentSession(
  orderId: string,
  gateway: PaymentGateway,
  options?: { network?: string }
): Promise<PaymentResult> {
  try {
    // Verify the caller owns this order
    // Logged-in: match orderId + userId. Guest: match orderId + userId IS NULL.
    const user = await getUser();

    const [order] = await db
      .select()
      .from(orders)
      .where(
        user
          ? and(eq(orders.id, orderId), eq(orders.userId, user.id))
          : and(eq(orders.id, orderId), isNull(orders.userId))
      )
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return { success: false, error: "Order is already paid" };
    }

    // Get tenant info for store slug
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, order.tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    // Build URLs — use custom domain if active, otherwise main domain
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const storeBaseUrl =
      tenant.customDomain && tenant.customDomainStatus === "active"
        ? `https://${tenant.customDomain}`
        : `${appUrl}/store/${tenant.slug}`;
    const successUrl = `${storeBaseUrl}/checkout/success?order=${orderId}`;
    const cancelUrl = `${storeBaseUrl}/checkout/payment?order=${orderId}&cancelled=true`;

    // Determine the correct currency and amount per gateway
    let paymentCurrency: string;
    let paymentAmount: number;
    // Rate locked onto the order when HesabPay charges in AFN for a store that
    // prices in another currency. Null when no conversion is involved.
    let appliedAfnRate: number | null = null;

    if (gateway === "hesabpay") {
      // HesabPay's API has no currency field — everything it receives is AFN,
      // and it does not convert. Convert here, using the rate already locked on
      // this order when there is one (so a retry charges the quoted amount),
      // otherwise the store's configured rate.
      const lockedRate =
        order.customerCurrency === "AFN" ? order.exchangeRateUsed : null;

      const charge = resolveHesabPayCharge({
        storeCurrency: order.currencyCode,
        exchangeRate: lockedRate ?? tenant.afnExchangeRate,
        amount: parseFloat(order.amountDue || order.total),
      });

      if (!charge.ok) {
        return { success: false, error: charge.message };
      }

      paymentCurrency = HESABPAY_CURRENCY;
      paymentAmount = charge.afnAmount;
      appliedAfnRate = charge.converted ? charge.rate : null;
    } else {
      // Other gateways: charge in store's base currency
      paymentCurrency = order.currencyCode || "AFN";
      paymentAmount = parseFloat(order.amountDue || order.total);
    }

    // Create payment session
    const result = await createSession(gateway, {
      tenantId: order.tenantId,
      orderId: order.id,
      amount: paymentAmount,
      currency: paymentCurrency,
      // Store exchange rate info for reconciliation
      exchangeRate: appliedAfnRate ?? undefined,
      successUrl,
      cancelUrl,
      customerEmail: order.customerSnapshot?.email,
      customerPhone: order.customerSnapshot?.phone,
      customerName: order.customerSnapshot?.name,
      metadata: {
        storeSlug: tenant.slug,
        storeBaseUrl,
        orderNumber: order.orderNumber,
        ...(options?.network ? { network: options.network } : {}),
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create payment session",
      };
    }

    // Update order with payment gateway info. When HesabPay is charging in AFN
    // for a non-AFN store, lock the rate and the AFN amount onto the order so
    // the webhook can convert the payment back into the order's currency.
    await db
      .update(orders)
      .set({
        paymentMethod: gateway === "cod" ? "cash" : "card",
        ...(appliedAfnRate
          ? {
              customerCurrency: HESABPAY_CURRENCY,
              customerAmount: paymentAmount.toFixed(2),
              exchangeRateUsed: appliedAfnRate.toString(),
              exchangeRateLockedAt: new Date().toISOString(),
            }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentSessionId: result.paymentSessionId,
    };
  } catch (error) {
    console.error("[createOrderPaymentSession] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment failed",
    };
  }
}

/**
 * Verify order payment status and update order
 */
export async function verifyOrderPayment(
  sessionId: string
): Promise<PaymentVerifyResult> {
  try {
    // Get the payment session
    const session = await getPaymentSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: "Payment session not found",
        paid: false,
        status: "failed",
      };
    }

    if (!session.orderId) {
      return {
        success: false,
        error: "No order associated with this payment",
        paid: false,
        status: "failed",
      };
    }

    // For COD, mark as verified but not paid
    if (session.gateway === "cod") {
      return {
        success: true,
        paid: false,
        status: "pending",
        orderId: session.orderId,
      };
    }

    // Verify with the payment gateway
    const result = await verifyPayment(session.gateway, {
      sessionId: session.gatewaySessionId || session.id,
      tenantId: session.tenantId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        paid: false,
        status: "failed",
        orderId: session.orderId,
      };
    }

    // If payment is completed, update the order
    if (result.paid) {
      await markOrderAsPaid(session.orderId, {
        gateway: session.gateway,
        transactionId: result.transactionId,
        amount: result.amount || parseFloat(session.amount),
        currency: result.currency || session.currency,
        cardLastFour: result.card?.lastFour,
        cardBrand: result.card?.brand,
        gatewayResponse: result.gatewayResponse,
      });

      // Update payment session status
      await updatePaymentSessionStatus(session.id, "completed", {
        gatewayResponse: result.gatewayResponse,
      });
    }

    return {
      success: true,
      paid: result.paid,
      status: result.status,
      orderId: session.orderId,
    };
  } catch (error) {
    console.error("[verifyOrderPayment] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
      paid: false,
      status: "failed",
    };
  }
}

/**
 * Mark an order as paid
 */
async function markOrderAsPaid(
  orderId: string,
  paymentInfo: {
    gateway: PaymentGateway;
    transactionId?: string;
    amount: number;
    currency?: string;
    cardLastFour?: string;
    cardBrand?: string;
    gatewayResponse?: Record<string, unknown>;
  }
) {
  await recordGatewayPaymentForOrder({
    orderId,
    gateway: paymentInfo.gateway,
    amount: paymentInfo.amount,
    currency: paymentInfo.currency,
    transactionId: paymentInfo.transactionId,
    cardLastFour: paymentInfo.cardLastFour,
    cardBrand: paymentInfo.cardBrand,
    gatewayResponse: paymentInfo.gatewayResponse,
  });
}

// =============================================================================
// SUBSCRIPTION PAYMENT
// =============================================================================

/**
 * Create a payment session for a subscription invoice
 */
export async function createInvoicePaymentSession(
  invoiceId: string,
  gateway: PaymentGateway
): Promise<PaymentResult> {
  try {
    await requireAuth();

    // Get the invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if invoice is already paid
    if (invoice.status === "paid") {
      return { success: false, error: "Invoice is already paid" };
    }

    // Get tenant info
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, invoice.tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const successUrl = `${baseUrl}/dashboard/${tenant.slug}/billing?payment=success`;
    const cancelUrl = `${baseUrl}/dashboard/${tenant.slug}/billing?payment=cancelled`;

    // Get a valid email - fallback to tenant contact email if billing email not set
    const customerEmail =
      invoice.billingEmail || tenant.contactEmail || undefined;

    // Create payment session
    const result = await createSession(gateway, {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      amount: parseFloat(invoice.total),
      currency: invoice.currency,
      successUrl,
      cancelUrl,
      customerEmail,
      customerPhone: invoice.billingPhone || tenant.contactPhone || undefined,
      customerName: invoice.billingName || tenant.name || undefined,
      items: [
        {
          name: "Kaka Malem Pro Subscription",
          description: `Subscription for ${tenant.name}`,
          quantity: 1,
          unitPrice: parseFloat(invoice.total),
        },
      ],
      metadata: {
        storeSlug: tenant.slug,
        invoiceNumber: invoice.invoiceNumber,
        type: "subscription",
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create payment session",
      };
    }

    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentSessionId: result.paymentSessionId,
    };
  } catch (error) {
    console.error("[createInvoicePaymentSession] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment failed",
    };
  }
}

// =============================================================================
// VERIFY PENDING SUBSCRIPTION PAYMENT (on redirect back from gateway)
// =============================================================================

/**
 * Verify the most recent pending subscription payment for a tenant.
 *
 * Called when the user is redirected back from the payment gateway.
 * If the gateway confirms payment, marks the invoice as paid and activates Pro.
 * This handles the case where webhooks haven't arrived yet (or won't arrive in sandbox).
 */
export async function verifyPendingSubscriptionPayment(
  tenantId: string
): Promise<{ success: boolean; activated: boolean; error?: string }> {
  try {
    await requireAuth();

    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, activated: false, error: "Permission denied" };
    }

    // Find the most recent pending HesabPay payment session with an invoice
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.tenantId, tenantId),
          eq(paymentSessions.gateway, "hesabpay"),
          eq(paymentSessions.status, "pending")
        )
      )
      .orderBy(desc(paymentSessions.createdAt))
      .limit(1);

    if (!session || !session.invoiceId || !session.gatewaySessionId) {
      return { success: true, activated: false };
    }

    // Verify with HesabPay API
    const result = await verifyPayment("hesabpay", {
      sessionId: session.gatewaySessionId,
      tenantId,
    });

    if (!result.success || !result.paid) {
      return { success: true, activated: false };
    }

    // Payment confirmed - update everything
    // 1. Mark payment session as completed
    await updatePaymentSessionStatus(session.id, "completed", {
      gatewayResponse: result.gatewayResponse,
    });

    // 2. Mark invoice as paid
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, session.invoiceId))
      .limit(1);

    if (invoice && invoice.status !== "paid") {
      await db
        .update(invoices)
        .set({
          status: "paid",
          paidAt: new Date().toISOString(),
          paidAmount: session.amount,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(invoices.id, session.invoiceId));

      // 3. Activate Pro subscription
      const isYearly = (
        invoice.items as Array<{ description?: string }> | null
      )?.some((item) => item.description?.toLowerCase().includes("yearly"));

      // Check if this is a renewal (tenant already has a start date)
      const [currentTenant] = await db
        .select({
          slug: tenants.slug,
          subscriptionStartedAt: tenants.subscriptionStartedAt,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

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
        .where(eq(tenants.id, tenantId));

      // 4. Update billing transaction
      const { billingTransactions } = await import("@/lib/db/schema");
      await db
        .update(billingTransactions)
        .set({
          status: "completed",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(billingTransactions.invoiceId, session.invoiceId));

      const tenant = currentTenant;

      if (tenant) {
        revalidatePath(`/dashboard/${tenant.slug}/billing`);
      }

      console.log(
        `[verifyPendingSubscriptionPayment] Invoice ${invoice.invoiceNumber} verified as paid, Pro activated`
      );

      return { success: true, activated: true };
    }

    return { success: true, activated: false };
  } catch (error) {
    console.error("[verifyPendingSubscriptionPayment] Error:", error);
    return {
      success: false,
      activated: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

// =============================================================================
// GATEWAY CONFIGURATION
// =============================================================================

/**
 * Get enabled payment gateways for a store
 */
export async function getStorePaymentGateways(tenantId: string) {
  return getEnabledGateways(tenantId);
}

/**
 * Save payment gateway configuration
 */
export async function savePaymentGatewayConfig(
  tenantId: string,
  gateway: PaymentGateway,
  config: {
    displayName?: string;
    description?: string;
    apiKey?: string;
    secretKey?: string;
    merchantId?: string;
    merchantPin?: string;
    webhookSecret?: string;
    isLive?: boolean;
    isEnabled?: boolean;
    displayOrder?: number;
    minAmount?: number;
    maxAmount?: number;
    supportedCurrencies?: string[];
    settings?: Record<string, unknown>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    // Check permission — same bar as the Payments settings page
    const canManage = await hasMinimumRole(tenantId, "admin");
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Check if config exists
    const [existing] = await db
      .select()
      .from(paymentGatewayConfigs)
      .where(
        and(
          eq(paymentGatewayConfigs.tenantId, tenantId),
          eq(paymentGatewayConfigs.gateway, gateway)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(paymentGatewayConfigs)
        .set({
          ...config,
          minAmount: config.minAmount?.toString(),
          maxAmount: config.maxAmount?.toString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(paymentGatewayConfigs.id, existing.id));
    } else {
      // Create new
      await db.insert(paymentGatewayConfigs).values({
        tenantId,
        gateway,
        displayName: config.displayName,
        description: config.description,
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        merchantId: config.merchantId,
        merchantPin: config.merchantPin,
        webhookSecret: config.webhookSecret,
        isLive: config.isLive ?? false,
        isEnabled: config.isEnabled ?? true,
        displayOrder: config.displayOrder ?? 0,
        minAmount: config.minAmount?.toString(),
        maxAmount: config.maxAmount?.toString(),
        supportedCurrencies: config.supportedCurrencies,
        settings: config.settings,
      });
    }

    revalidatePath(`/dashboard/[slug]/settings/payments`);
    return { success: true };
  } catch (error) {
    console.error("[savePaymentGatewayConfig] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save config",
    };
  }
}

/**
 * Delete a payment gateway configuration
 */
export async function deletePaymentGatewayConfig(
  tenantId: string,
  gateway: PaymentGateway
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    // Check permission — same bar as the Payments settings page
    const canManage = await hasMinimumRole(tenantId, "admin");
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    await db
      .delete(paymentGatewayConfigs)
      .where(
        and(
          eq(paymentGatewayConfigs.tenantId, tenantId),
          eq(paymentGatewayConfigs.gateway, gateway)
        )
      );

    revalidatePath(`/dashboard/[slug]/settings/payments`);
    return { success: true };
  } catch (error) {
    console.error("[deletePaymentGatewayConfig] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete config",
    };
  }
}

/**
 * Get all payment gateway configs for a store (for admin use)
 */
export async function getAllPaymentGatewayConfigs(
  tenantId: string
): Promise<PaymentGatewayConfig[]> {
  try {
    await requireAuth();

    // Check permission
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return [];
    }

    return db
      .select()
      .from(paymentGatewayConfigs)
      .where(eq(paymentGatewayConfigs.tenantId, tenantId))
      .orderBy(paymentGatewayConfigs.displayOrder);
  } catch (error) {
    console.error("[getAllPaymentGatewayConfigs] Error:", error);
    return [];
  }
}

// =============================================================================
// MANUAL PAYMENT CONFIRMATION
// =============================================================================

/**
 * Confirm a manual payment (bank transfer, mobile money)
 * Used by store admins to mark manual payments as received
 */
export async function confirmManualPayment(
  paymentSessionId: string,
  confirmationDetails: {
    paymentReference?: string;
    notes?: string;
    amount?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    // Get the payment session
    const session = await getPaymentSession(paymentSessionId);
    if (!session) {
      return { success: false, error: "Payment session not found" };
    }

    // Check permission
    const canManage = await canManageStore(session.tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // Only allow for manual payment methods
    if (!["bank_transfer", "mobile_money"].includes(session.gateway)) {
      return {
        success: false,
        error: "Manual confirmation only for bank transfer or mobile money",
      };
    }

    // Update payment session
    await updatePaymentSessionStatus(session.id, "completed", {
      gatewayResponse: {
        confirmedManually: true,
        paymentReference: confirmationDetails.paymentReference,
        notes: confirmationDetails.notes,
        confirmedAt: new Date().toISOString(),
      },
    });

    // If this is for an order, mark it as paid
    if (session.orderId) {
      await markOrderAsPaid(session.orderId, {
        gateway: session.gateway,
        transactionId: confirmationDetails.paymentReference,
        amount: confirmationDetails.amount || parseFloat(session.amount),
      });
    }

    // If this is for an invoice, mark it as paid
    if (session.invoiceId) {
      await db
        .update(invoices)
        .set({
          status: "paid",
          paidAt: new Date().toISOString(),
          paidAmount: confirmationDetails.amount?.toString() || session.amount,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(invoices.id, session.invoiceId));

      // Also update tenant subscription status
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, session.invoiceId))
        .limit(1);

      if (invoice) {
        const [currentTenant] = await db
          .select({ subscriptionStartedAt: tenants.subscriptionStartedAt })
          .from(tenants)
          .where(eq(tenants.id, invoice.tenantId))
          .limit(1);

        await db
          .update(tenants)
          .set({
            subscriptionStatus: "active",
            ...(currentTenant?.subscriptionStartedAt
              ? {}
              : { subscriptionStartedAt: new Date().toISOString() }),
            subscriptionEndsAt: invoice.periodEnd,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenants.id, invoice.tenantId));
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[confirmManualPayment] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Confirmation failed",
    };
  }
}

// =============================================================================
// COD CONFIRMATION
// =============================================================================

/**
 * Confirm COD payment (mark as paid on delivery)
 */
export async function confirmCODPayment(
  orderId: string,
  details: {
    cashReceived: number;
    cashChange?: number;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();

    // Get the order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Check permission
    const canManage = await canManageStore(order.tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    const user = await getUser();

    // Create transaction record with cash details
    await db.insert(orderTransactions).values({
      orderId,
      tenantId: order.tenantId,
      type: "payment",
      amount: order.amountDue || order.total,
      currencyCode: order.currencyCode || "AFN",
      paymentMethod: "cash",
      status: "completed",
      gateway: "cod",
      cashReceived: details.cashReceived.toString(),
      cashChange: details.cashChange?.toString(),
      notes: details.notes,
      recordedBy: user?.id,
      processedAt: new Date().toISOString(),
    });

    // Update order
    await db
      .update(orders)
      .set({
        amountPaid: order.total,
        amountDue: "0",
        paymentStatus: "paid",
        isPaid: true,
        paidAt: new Date().toISOString(),
        status: "delivered",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    // Update any associated payment session
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.orderId, orderId),
          eq(paymentSessions.gateway, "cod")
        )
      )
      .limit(1);

    if (session) {
      await updatePaymentSessionStatus(session.id, "completed");
    }

    revalidatePath(`/dashboard/[slug]/orders`);
    return { success: true };
  } catch (error) {
    console.error("[confirmCODPayment] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Confirmation failed",
    };
  }
}

// =============================================================================
// PAYMENT HISTORY
// =============================================================================

/**
 * Get payment sessions for an order
 */
export async function getOrderPaymentSessions(orderId: string) {
  return db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.orderId, orderId))
    .orderBy(desc(paymentSessions.createdAt));
}

/**
 * Get the latest pending payment session for a store
 * Used to redirect users back to payment if they left during checkout
 */
export async function getLatestPendingPaymentSession(
  tenantId: string,
  userId?: string
) {
  // Get orders for this user/session in this store that are unpaid
  const recentOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.tenantId, tenantId),
      eq(orders.paymentStatus, "unpaid"),
      userId ? eq(orders.userId, userId) : undefined
    ),
    columns: { id: true },
    orderBy: desc(orders.createdAt),
    limit: 5,
  });

  if (recentOrders.length === 0) {
    return null;
  }

  const orderIds = recentOrders.map((o) => o.id);

  // Get the most recent pending/processing payment session
  const [session] = await db
    .select({
      id: paymentSessions.id,
      orderId: paymentSessions.orderId,
      gatewaySessionUrl: paymentSessions.gatewaySessionUrl,
      status: paymentSessions.status,
      expiresAt: paymentSessions.expiresAt,
    })
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.tenantId, tenantId),
        inArray(paymentSessions.orderId, orderIds),
        inArray(paymentSessions.status, ["pending", "processing"])
      )
    )
    .orderBy(desc(paymentSessions.createdAt))
    .limit(1);

  if (!session) {
    return null;
  }

  // Check if session is not expired
  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < new Date()) {
      return null;
    }
  }

  return session;
}
