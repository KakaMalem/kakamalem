"use server";

/**
 * Crypto Payment Server Actions
 *
 * Handles the self-hosted USDT payment flow:
 * 1. Customer initiates crypto payment
 * 2. System creates session with wallet details
 * 3. Customer sends USDT and submits transaction hash
 * 4. Admin verifies the transaction
 * 5. Order is marked as paid
 */

import { db } from "@/lib/db";
import { eq, and, desc, lte } from "drizzle-orm";
import {
  cryptoPayments,
  paymentSessions,
  orders,
  orderTransactions,
  invoices,
  tenants,
  billingTransactions,
  type CryptoNetwork,
} from "@/lib/db/schema";
import { getUser, isPlatformAdmin } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { creditSellerEarnings } from "@/lib/actions/earnings";
import { revalidatePath } from "next/cache";
import {
  validateTransactionHash,
  getEnabledNetworks,
  getWalletForNetwork,
  convertAfnToUsdt,
  DEFAULT_AFN_TO_USDT_RATE,
  NETWORK_INFO,
} from "@/lib/payments/crypto";

// =============================================================================
// TYPES
// =============================================================================

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type CryptoPaymentDetails = {
  id: string;
  paymentSessionId: string;
  network: CryptoNetwork;
  walletAddress: string;
  expectedAmount: string;
  exchangeRate: string | null;
  originalAmountAfn: string | null;
  status: string;
  transactionHash: string | null;
  expiresAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  customerNotes: string | null;
  createdAt: string;
  // Related order info
  orderId?: string;
  orderNumber?: string;
  storeName?: string;
};

// =============================================================================
// CUSTOMER ACTIONS
// =============================================================================

/**
 * Create a crypto payment session for an order
 */
export async function createCryptoPaymentSession(
  orderId: string,
  network: CryptoNetwork
): Promise<
  ActionResult<{
    cryptoPaymentId: string;
    walletAddress: string;
    expectedAmount: number;
    expiresAt: string;
    networkInfo: (typeof NETWORK_INFO)[CryptoNetwork];
  }>
> {
  try {
    // Get order and verify it exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        tenant: {
          columns: { id: true, name: true, slug: true },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.isPaid) {
      return { success: false, error: "Order is already paid" };
    }

    // Get platform settings for wallet config
    const settings = await db.query.platformSettings.findFirst();
    const walletConfig = settings?.usdtWalletConfig;

    if (!walletConfig) {
      return { success: false, error: "Crypto payments not configured" };
    }

    // Get wallet for selected network
    const wallet = getWalletForNetwork(walletConfig, network);
    if (!wallet) {
      return {
        success: false,
        error: `${network.toUpperCase()} wallet not available`,
      };
    }

    // Check if network is enabled
    const enabledNetworks = getEnabledNetworks(walletConfig);
    if (!enabledNetworks.includes(network)) {
      return {
        success: false,
        error: `${network.toUpperCase()} is not enabled`,
      };
    }

    // Get exchange rate (TODO: fetch from API)
    const exchangeRate = DEFAULT_AFN_TO_USDT_RATE;

    // Convert AFN to USDT
    const orderTotal = parseFloat(order.total);
    const usdtAmount = convertAfnToUsdt(orderTotal, exchangeRate);

    // Check minimum amount
    const minAmount = walletConfig.minAmount || 1;
    if (usdtAmount < minAmount) {
      return {
        success: false,
        error: `Order total converts to ${usdtAmount} USDT, minimum is ${minAmount} USDT`,
      };
    }

    // Calculate expiration
    const expirationMinutes = walletConfig.expirationMinutes || 60;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Create payment session
    const [session] = await db
      .insert(paymentSessions)
      .values({
        tenantId: order.tenantId,
        orderId: order.id,
        gateway: "crypto_usdt",
        amount: orderTotal.toString(),
        currency: "USDT",
        status: "pending",
        expiresAt: expiresAt.toISOString(),
        gatewaySessionId: `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        gatewayResponse: {
          network,
          walletAddress: wallet.address,
          expectedAmount: usdtAmount,
          exchangeRate,
        },
        metadata: {
          network,
          originalAmountAfn: orderTotal,
          exchangeRate,
        },
      })
      .returning();

    // Create crypto payment record
    const [cryptoPayment] = await db
      .insert(cryptoPayments)
      .values({
        paymentSessionId: session.id,
        network,
        walletAddress: wallet.address,
        expectedAmount: usdtAmount.toString(),
        exchangeRate: exchangeRate.toString(),
        originalAmountAfn: orderTotal.toString(),
        status: "pending",
        expiresAt: expiresAt.toISOString(),
      })
      .returning();

    // Update order with payment method (use "card" as crypto is digital payment)
    await db
      .update(orders)
      .set({
        paymentMethod: "card",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    return {
      success: true,
      data: {
        cryptoPaymentId: cryptoPayment.id,
        walletAddress: wallet.address,
        expectedAmount: usdtAmount,
        expiresAt: expiresAt.toISOString(),
        networkInfo: NETWORK_INFO[network],
      },
    };
  } catch (error) {
    console.error("[createCryptoPaymentSession] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create payment",
    };
  }
}

/**
 * Submit transaction hash (customer action)
 */
export async function submitTransactionHash(
  cryptoPaymentId: string,
  transactionHash: string,
  customerNotes?: string
): Promise<ActionResult> {
  try {
    // Require authentication
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    // Get the crypto payment
    const cryptoPayment = await db.query.cryptoPayments.findFirst({
      where: eq(cryptoPayments.id, cryptoPaymentId),
    });

    if (!cryptoPayment) {
      return { success: false, error: "Payment not found" };
    }

    // Check if already verified or rejected
    if (cryptoPayment.status === "verified") {
      return { success: false, error: "Payment already verified" };
    }

    if (cryptoPayment.status === "rejected") {
      return { success: false, error: "Payment was rejected" };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(cryptoPayment.expiresAt);
    if (now > expiresAt) {
      // Update status to expired
      await db
        .update(cryptoPayments)
        .set({
          status: "expired",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cryptoPayments.id, cryptoPaymentId));

      return { success: false, error: "Payment session has expired" };
    }

    // Validate transaction hash format
    if (!validateTransactionHash(transactionHash, cryptoPayment.network)) {
      return {
        success: false,
        error: `Invalid transaction hash format for ${cryptoPayment.network.toUpperCase()}`,
      };
    }

    // Update crypto payment with submitted hash
    await db
      .update(cryptoPayments)
      .set({
        transactionHash,
        customerNotes: customerNotes || null,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cryptoPayments.id, cryptoPaymentId));

    return { success: true };
  } catch (error) {
    console.error("[submitTransactionHash] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit",
    };
  }
}

/**
 * Get crypto payment details for customer
 */
export async function getCryptoPaymentDetails(
  cryptoPaymentId: string
): Promise<ActionResult<CryptoPaymentDetails>> {
  try {
    const cryptoPayment = await db.query.cryptoPayments.findFirst({
      where: eq(cryptoPayments.id, cryptoPaymentId),
      with: {
        paymentSession: {
          with: {
            // Note: Relations may need to be added
          },
        },
      },
    });

    if (!cryptoPayment) {
      return { success: false, error: "Payment not found" };
    }

    // Get related order if exists
    const session = await db.query.paymentSessions.findFirst({
      where: eq(paymentSessions.id, cryptoPayment.paymentSessionId),
    });

    let orderInfo: { orderNumber?: string; storeName?: string } = {};
    if (session?.orderId) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, session.orderId),
        with: {
          tenant: { columns: { name: true } },
        },
      });
      if (order) {
        orderInfo = {
          orderNumber: order.orderNumber,
          storeName: order.tenant?.name,
        };
      }
    }

    return {
      success: true,
      data: {
        id: cryptoPayment.id,
        paymentSessionId: cryptoPayment.paymentSessionId,
        network: cryptoPayment.network,
        walletAddress: cryptoPayment.walletAddress,
        expectedAmount: cryptoPayment.expectedAmount,
        exchangeRate: cryptoPayment.exchangeRate,
        originalAmountAfn: cryptoPayment.originalAmountAfn,
        status: cryptoPayment.status,
        transactionHash: cryptoPayment.transactionHash,
        expiresAt: cryptoPayment.expiresAt,
        submittedAt: cryptoPayment.submittedAt,
        verifiedAt: cryptoPayment.verifiedAt,
        customerNotes: cryptoPayment.customerNotes,
        createdAt: cryptoPayment.createdAt,
        orderId: session?.orderId || undefined,
        ...orderInfo,
      },
    };
  } catch (error) {
    console.error("[getCryptoPaymentDetails] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get details",
    };
  }
}

// =============================================================================
// ADMIN ACTIONS
// =============================================================================

/**
 * Get pending crypto payments for verification (admin only)
 */
export async function getPendingCryptoPayments(options?: {
  tenantId?: string;
  limit?: number;
}): Promise<ActionResult<CryptoPaymentDetails[]>> {
  try {
    // Check admin permission
    const isAdmin = await isPlatformAdmin();

    // If not platform admin, check if store owner
    const tenantFilter: string | undefined = options?.tenantId;

    if (!isAdmin && tenantFilter) {
      const canManage = await canManageStore(tenantFilter);
      if (!canManage) {
        return { success: false, error: "Permission denied" };
      }
    } else if (!isAdmin && !tenantFilter) {
      return { success: false, error: "Permission denied" };
    }

    // Build query
    const query = db
      .select({
        cryptoPayment: cryptoPayments,
        session: paymentSessions,
        order: orders,
        tenant: tenants,
      })
      .from(cryptoPayments)
      .innerJoin(
        paymentSessions,
        eq(cryptoPayments.paymentSessionId, paymentSessions.id)
      )
      .leftJoin(orders, eq(paymentSessions.orderId, orders.id))
      .leftJoin(tenants, eq(paymentSessions.tenantId, tenants.id))
      .where(
        and(
          eq(cryptoPayments.status, "submitted"),
          tenantFilter ? eq(paymentSessions.tenantId, tenantFilter) : undefined
        )
      )
      .orderBy(desc(cryptoPayments.submittedAt))
      .limit(options?.limit || 50);

    const results = await query;

    const payments: CryptoPaymentDetails[] = results.map((r) => ({
      id: r.cryptoPayment.id,
      paymentSessionId: r.cryptoPayment.paymentSessionId,
      network: r.cryptoPayment.network,
      walletAddress: r.cryptoPayment.walletAddress,
      expectedAmount: r.cryptoPayment.expectedAmount,
      exchangeRate: r.cryptoPayment.exchangeRate,
      originalAmountAfn: r.cryptoPayment.originalAmountAfn,
      status: r.cryptoPayment.status,
      transactionHash: r.cryptoPayment.transactionHash,
      expiresAt: r.cryptoPayment.expiresAt,
      submittedAt: r.cryptoPayment.submittedAt,
      verifiedAt: r.cryptoPayment.verifiedAt,
      customerNotes: r.cryptoPayment.customerNotes,
      createdAt: r.cryptoPayment.createdAt,
      orderId: r.order?.id,
      orderNumber: r.order?.orderNumber,
      storeName: r.tenant?.name,
    }));

    return { success: true, data: payments };
  } catch (error) {
    console.error("[getPendingCryptoPayments] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get payments",
    };
  }
}

/**
 * Verify a crypto payment (admin action)
 */
export async function verifyCryptoPayment(
  cryptoPaymentId: string,
  adminNotes?: string
): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the crypto payment
    const cryptoPayment = await db.query.cryptoPayments.findFirst({
      where: eq(cryptoPayments.id, cryptoPaymentId),
    });

    if (!cryptoPayment) {
      return { success: false, error: "Payment not found" };
    }

    // Get the payment session
    const session = await db.query.paymentSessions.findFirst({
      where: eq(paymentSessions.id, cryptoPayment.paymentSessionId),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check permission
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      const canManage = await canManageStore(session.tenantId);
      if (!canManage) {
        return { success: false, error: "Permission denied" };
      }
    }

    // Check if already processed
    if (cryptoPayment.status === "verified") {
      return { success: false, error: "Already verified" };
    }

    if (cryptoPayment.status !== "submitted") {
      return { success: false, error: "Payment must be submitted first" };
    }

    const now = new Date().toISOString();

    // Update crypto payment
    await db
      .update(cryptoPayments)
      .set({
        status: "verified",
        verifiedAt: now,
        verifiedBy: user.id,
        adminNotes: adminNotes || null,
        updatedAt: now,
      })
      .where(eq(cryptoPayments.id, cryptoPaymentId));

    // Update payment session
    await db
      .update(paymentSessions)
      .set({
        status: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentSessions.id, session.id));

    // If this is for an order, mark it as paid
    if (session.orderId) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, session.orderId),
      });

      if (order) {
        // Create transaction record (use "card" as payment method, gateway tracks crypto)
        await db.insert(orderTransactions).values({
          orderId: order.id,
          tenantId: session.tenantId,
          type: "payment",
          amount: session.amount,
          currencyCode: "USDT",
          paymentMethod: "card", // Use card as crypto is digital payment
          status: "completed",
          gateway: "crypto_usdt",
          gatewayTransactionId:
            cryptoPayment.transactionHash || cryptoPayment.id,
          gatewayResponse: {
            cryptoPaymentId: cryptoPayment.id,
            network: cryptoPayment.network,
            usdtAmount: cryptoPayment.expectedAmount,
            transactionHash: cryptoPayment.transactionHash,
          },
          processedAt: now,
          recordedBy: user.id,
        });

        // Update order
        const amountPaid =
          parseFloat(order.amountPaid || "0") + parseFloat(session.amount);
        const orderTotal = parseFloat(order.total);
        const isPaid = amountPaid >= orderTotal;

        await db
          .update(orders)
          .set({
            amountPaid: amountPaid.toString(),
            amountDue: Math.max(0, orderTotal - amountPaid).toString(),
            paymentStatus: isPaid ? "paid" : "partial",
            isPaid,
            paidAt: isPaid ? now : undefined,
            status: order.status === "pending" ? "confirmed" : order.status,
            confirmedAt: order.status === "pending" ? now : order.confirmedAt,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id));

        // Credit seller earnings if fully paid
        // Credit in the order's base currency (store currency)
        if (isPaid) {
          await creditSellerEarnings(
            session.tenantId,
            order.id,
            order.orderNumber,
            orderTotal,
            order.currencyCode || "USDT",
            "crypto_usdt"
          );
        }
      }

      revalidatePath(`/dashboard/[slug]/orders/${session.orderId}`);
    }

    // If this is for an invoice (subscription), update it
    if (session.invoiceId) {
      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, session.invoiceId),
      });

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: "paid",
            paidAt: now,
            paidAmount: invoice.total,
            updatedAt: now,
          })
          .where(eq(invoices.id, invoice.id));

        // Update tenant subscription
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, session.tenantId),
        });

        if (tenant) {
          // Check billing interval from invoice items
          const isYearly = invoice.items?.some(
            (item: { description?: string }) =>
              item.description?.toLowerCase().includes("yearly")
          );

          // Use invoice periodEnd if available, otherwise calculate
          let subscriptionEnd: string;
          if (invoice.periodEnd) {
            subscriptionEnd = invoice.periodEnd;
          } else {
            const periodEnd = new Date();
            if (isYearly) {
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }
            subscriptionEnd = periodEnd.toISOString();
          }

          await db
            .update(tenants)
            .set({
              subscriptionPlan: "pro",
              subscriptionStatus: "active",
              // Only set subscriptionStartedAt for new subscriptions
              ...(tenant.subscriptionStartedAt
                ? {}
                : { subscriptionStartedAt: now }),
              subscriptionEndsAt: subscriptionEnd,
              billingInterval: isYearly ? "yearly" : "monthly",
              updatedAt: now,
            })
            .where(eq(tenants.id, tenant.id));

          // Update billing transaction
          await db
            .update(billingTransactions)
            .set({
              status: "completed",
              processedBy: user.id,
              updatedAt: now,
            })
            .where(eq(billingTransactions.invoiceId, invoice.id));

          // Generate and send subscription invoice PDF + email (non-blocking)
          try {
            const { sendSubscriptionInvoice } =
              await import("@/lib/invoice/send-subscription-invoice");
            await sendSubscriptionInvoice({
              invoiceId: invoice.id,
              tenantId: session.tenantId,
              paymentMethod: "USDT",
              transactionId: cryptoPayment.transactionHash || undefined,
            });
          } catch (invoiceError) {
            console.error(
              "[verifyCryptoPayment] Failed to send subscription invoice:",
              invoiceError
            );
          }
        }

        revalidatePath(`/dashboard/[slug]/billing`);
      }
    }

    revalidatePath("/admin/payments");

    return { success: true };
  } catch (error) {
    console.error("[verifyCryptoPayment] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Reject a crypto payment (admin action)
 */
export async function rejectCryptoPayment(
  cryptoPaymentId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the crypto payment
    const cryptoPayment = await db.query.cryptoPayments.findFirst({
      where: eq(cryptoPayments.id, cryptoPaymentId),
    });

    if (!cryptoPayment) {
      return { success: false, error: "Payment not found" };
    }

    // Get the payment session
    const session = await db.query.paymentSessions.findFirst({
      where: eq(paymentSessions.id, cryptoPayment.paymentSessionId),
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check permission
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      const canManage = await canManageStore(session.tenantId);
      if (!canManage) {
        return { success: false, error: "Permission denied" };
      }
    }

    // Check if already processed
    if (cryptoPayment.status === "verified") {
      return { success: false, error: "Cannot reject verified payment" };
    }

    if (cryptoPayment.status === "rejected") {
      return { success: false, error: "Already rejected" };
    }

    const now = new Date().toISOString();

    // Update crypto payment
    await db
      .update(cryptoPayments)
      .set({
        status: "rejected",
        verifiedBy: user.id,
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(cryptoPayments.id, cryptoPaymentId));

    // Update payment session
    await db
      .update(paymentSessions)
      .set({
        status: "failed",
        failedAt: now,
        failureReason: reason,
        updatedAt: now,
      })
      .where(eq(paymentSessions.id, session.id));

    revalidatePath("/admin/payments");

    return { success: true };
  } catch (error) {
    console.error("[rejectCryptoPayment] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Rejection failed",
    };
  }
}

/**
 * Expire old crypto payment sessions (cron job / scheduled task)
 */
export async function expireOldCryptoPayments(): Promise<
  ActionResult<{ expiredCount: number }>
> {
  try {
    // Only platform admin can run this
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return { success: false, error: "Permission denied" };
    }

    const now = new Date().toISOString();

    // Find and update expired payments
    const result = await db
      .update(cryptoPayments)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(cryptoPayments.status, "pending"),
          lte(cryptoPayments.expiresAt, now)
        )
      )
      .returning({ id: cryptoPayments.id });

    // Also update payment sessions
    for (const payment of result) {
      const cryptoPayment = await db.query.cryptoPayments.findFirst({
        where: eq(cryptoPayments.id, payment.id),
      });

      if (cryptoPayment) {
        await db
          .update(paymentSessions)
          .set({
            status: "expired",
            updatedAt: now,
          })
          .where(eq(paymentSessions.id, cryptoPayment.paymentSessionId));
      }
    }

    return {
      success: true,
      data: { expiredCount: result.length },
    };
  } catch (error) {
    console.error("[expireOldCryptoPayments] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to expire payments",
    };
  }
}

/**
 * Get enabled crypto networks
 */
export async function getEnabledCryptoNetworks(): Promise<
  ActionResult<{
    networks: CryptoNetwork[];
    networkInfo: typeof NETWORK_INFO;
  }>
> {
  try {
    const settings = await db.query.platformSettings.findFirst();
    const walletConfig = settings?.usdtWalletConfig;

    const networks = getEnabledNetworks(walletConfig);

    return {
      success: true,
      data: {
        networks,
        networkInfo: NETWORK_INFO,
      },
    };
  } catch (error) {
    console.error("[getEnabledCryptoNetworks] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get networks",
    };
  }
}
