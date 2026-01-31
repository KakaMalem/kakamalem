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
import { eq, and, desc, inArray } from "drizzle-orm";
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
import { canManageStore } from "@/lib/auth/context";
import {
  createPaymentSession as createSession,
  verifyPayment,
  getEnabledGateways,
  getPaymentSession,
  updatePaymentSessionStatus,
} from "@/lib/payments";

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
  gateway: PaymentGateway
): Promise<PaymentResult> {
  try {
    // Get the order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
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

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const successUrl = `${baseUrl}/store/${tenant.slug}/checkout/success?order=${orderId}`;
    const cancelUrl = `${baseUrl}/store/${tenant.slug}/checkout/payment?order=${orderId}&cancelled=true`;

    // Create payment session
    const result = await createSession(gateway, {
      tenantId: order.tenantId,
      orderId: order.id,
      amount: parseFloat(order.amountDue || order.total),
      currency: order.currencyCode || "AFN",
      successUrl,
      cancelUrl,
      customerEmail: order.customerSnapshot?.email,
      customerPhone: order.customerSnapshot?.phone,
      customerName: order.customerSnapshot?.name,
      metadata: {
        storeSlug: tenant.slug,
        orderNumber: order.orderNumber,
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create payment session",
      };
    }

    // Update order with payment gateway info
    await db
      .update(orders)
      .set({
        paymentMethod: gateway === "cod" ? "cash" : "card",
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
    cardLastFour?: string;
    cardBrand?: string;
    gatewayResponse?: Record<string, unknown>;
  }
) {
  // Get the order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  // Create transaction record
  await db.insert(orderTransactions).values({
    orderId,
    tenantId: order.tenantId,
    type: "payment",
    amount: paymentInfo.amount.toString(),
    currencyCode: order.currencyCode || "AFN",
    paymentMethod: paymentInfo.gateway === "hesabpay" ? "card" : "card",
    status: "completed",
    gateway: paymentInfo.gateway,
    gatewayTransactionId: paymentInfo.transactionId,
    gatewayResponse: paymentInfo.gatewayResponse,
    cardLastFour: paymentInfo.cardLastFour,
    cardBrand: paymentInfo.cardBrand,
    processedAt: new Date().toISOString(),
  });

  // Update order
  const newAmountPaid =
    parseFloat(order.amountPaid || "0") + paymentInfo.amount;
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
        isFullyPaid && order.status === "pending" ? "confirmed" : order.status,
      confirmedAt:
        isFullyPaid && order.status === "pending"
          ? new Date().toISOString()
          : order.confirmedAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
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

    // Check permission
    const canManage = await canManageStore(tenantId);
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

    // Check permission
    const canManage = await canManageStore(tenantId);
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
        await db
          .update(tenants)
          .set({
            subscriptionStatus: "active",
            subscriptionStartedAt: new Date().toISOString(),
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
