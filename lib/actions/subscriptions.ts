"use server";

import { db } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  tenants,
  tenantMembers,
  invoices,
  billingTransactions,
  type BillingInterval,
} from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { generateInvoiceNumber } from "@/lib/db/queries/billing";
import { createInvoicePaymentSession } from "@/lib/actions/payments";
import { revalidatePath } from "next/cache";

// =============================================================================
// TYPES
// =============================================================================

export type InitiateUpgradeResult = {
  success: boolean;
  error?: string;
  paymentUrl?: string;
  invoiceId?: string;
  /** True if a cancelled subscription was reactivated without payment */
  reactivated?: boolean;
};

// =============================================================================
// PRO UPGRADE
// =============================================================================

/**
 * Initiate a Pro subscription upgrade for a tenant
 *
 * Creates a HesabPay invoice-based payment for the Pro plan
 * (monthly or yearly). The seller is redirected to HesabPay's
 * hosted checkout, then the webhook activates the subscription.
 */
export async function initiateProUpgrade(
  tenantId: string,
  options?: {
    /** Billing interval: monthly or yearly (default: monthly) */
    billingInterval?: BillingInterval;
  }
): Promise<InitiateUpgradeResult> {
  try {
    // 1. Auth check
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Permission check
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Get tenant and verify eligibility
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    if (
      tenant.subscriptionPlan === "pro" &&
      tenant.subscriptionStatus === "active"
    ) {
      return {
        success: false,
        error: "Store already has an active Pro subscription",
      };
    }

    // If cancelled but still has remaining time, just reactivate (no payment needed)
    if (
      tenant.subscriptionPlan === "pro" &&
      tenant.subscriptionStatus === "cancelled" &&
      tenant.subscriptionEndsAt &&
      new Date(tenant.subscriptionEndsAt) > new Date()
    ) {
      await db
        .update(tenants)
        .set({
          subscriptionStatus: "active",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tenants.id, tenantId));

      revalidatePath(`/dashboard/${tenant.slug}/billing`);

      return {
        success: true,
        reactivated: true,
      };
    }

    // 4. Create HesabPay invoice
    const settings = await db.query.platformSettings.findFirst();
    const billingInterval = options?.billingInterval || "monthly";
    const proPlanPrice =
      billingInterval === "yearly"
        ? parseFloat(settings?.proPlanYearlyPriceAfn || "12000")
        : parseFloat(settings?.proPlanPriceAfn || "1100");

    // Check for existing unpaid subscription invoice with matching amount
    const [existingInvoice] = await db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.tenantId, tenantId), eq(invoices.status, "unpaid"))
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let invoice: typeof existingInvoice | undefined = existingInvoice;

    // Void existing invoice if it has a different amount (interval changed)
    if (invoice && parseFloat(invoice.total) !== proPlanPrice) {
      await db
        .update(invoices)
        .set({ status: "void", updatedAt: new Date().toISOString() })
        .where(eq(invoices.id, invoice.id));
      invoice = undefined;
    }

    // Create new invoice if none exists or previous was voided
    if (!invoice) {
      const now = new Date();
      // If tenant has remaining subscription time, extend from that date
      const hasRemainingTime =
        tenant.subscriptionEndsAt && new Date(tenant.subscriptionEndsAt) > now;
      const periodStart = hasRemainingTime
        ? new Date(tenant.subscriptionEndsAt!)
        : now;
      const periodEnd = new Date(periodStart);
      // Set period end based on billing interval
      if (billingInterval === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Generate unique invoice number with store code prefix
      const invoiceNumber = generateInvoiceNumber(tenant.slug);

      const subscriptionDescription =
        billingInterval === "yearly"
          ? "Kaka Malem Pro - Yearly Subscription"
          : "Kaka Malem Pro - Monthly Subscription";

      try {
        const [newInvoice] = await db
          .insert(invoices)
          .values({
            tenantId,
            invoiceNumber,
            subtotal: proPlanPrice.toString(),
            tax: "0",
            total: proPlanPrice.toString(),
            currency: "AFN",
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            dueDate: now.toISOString(),
            status: "unpaid",
            items: [
              {
                description: subscriptionDescription,
                quantity: 1,
                unitPrice: proPlanPrice,
                total: proPlanPrice,
              },
            ],
            billingName: tenant.name || "Store Owner",
            billingEmail: tenant.contactEmail || null,
            billingPhone: tenant.contactPhone || null,
          })
          .returning();

        invoice = newInvoice;

        // Create billing transaction (pending)
        await db.insert(billingTransactions).values({
          tenantId,
          type: "subscription_upgrade",
          amount: proPlanPrice.toString(),
          currency: "AFN",
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          fromPlan: tenant.subscriptionPlan,
          toPlan: "pro",
          status: "pending",
          invoiceId: invoice.id,
        });
      } catch (insertError) {
        // Handle duplicate invoice number (race condition)
        console.error(
          "[initiateProUpgrade] Invoice insert error:",
          insertError
        );

        // Try to find the invoice that was just created
        const [retryInvoice] = await db
          .select()
          .from(invoices)
          .where(
            and(eq(invoices.tenantId, tenantId), eq(invoices.status, "unpaid"))
          )
          .orderBy(desc(invoices.createdAt))
          .limit(1);

        if (retryInvoice) {
          invoice = retryInvoice;
        } else {
          return {
            success: false,
            error: "Failed to create invoice. Please try again.",
          };
        }
      }
    }

    // Create HesabPay payment session
    const paymentResult = await createInvoicePaymentSession(
      invoice.id,
      "hesabpay"
    );

    if (!paymentResult.success) {
      return {
        success: false,
        error: paymentResult.error || "Failed to create payment session",
      };
    }

    // Revalidate billing page
    revalidatePath(`/dashboard/${tenant.slug}/billing`);

    return {
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      invoiceId: invoice.id,
    };
  } catch (error) {
    console.error("[initiateProUpgrade] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upgrade failed",
    };
  }
}

// =============================================================================
// SUBSCRIPTION CANCEL
// =============================================================================

/**
 * Cancel a Pro subscription at period end.
 *
 * HesabPay invoices are one-time payments, so there's no recurring charge to
 * stop. This marks the subscription as cancelled so it won't be renewed, and
 * the store keeps Pro access until subscriptionEndsAt.
 */
export async function cancelSubscription(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    if (tenant.subscriptionPlan !== "pro") {
      return { success: false, error: "No active Pro subscription to cancel" };
    }

    if (
      tenant.subscriptionStatus !== "active" &&
      tenant.subscriptionStatus !== "past_due"
    ) {
      return { success: false, error: "Subscription is not active" };
    }

    const now = new Date().toISOString();
    await db
      .update(tenants)
      .set({
        subscriptionStatus: "cancelled",
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    await db.insert(billingTransactions).values({
      id: crypto.randomUUID(),
      tenantId,
      type: "subscription_downgrade",
      amount: "0",
      currency: tenant.currency,
      fromPlan: "pro",
      toPlan: "free",
      status: "completed",
      processedBy: currentUser.id,
      notes:
        "Subscription cancelled by store owner. Access continues until period end.",
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath(`/dashboard/${tenant.slug}/billing`);

    return { success: true };
  } catch (error) {
    console.error("[cancelSubscription] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
    };
  }
}

// =============================================================================
// SUBSCRIPTION PAUSE/RESUME
// =============================================================================

export type PauseSubscriptionResult = {
  success: boolean;
  error?: string;
  pausedAt?: string;
  autoResumeAt?: string;
};

export type ResumeSubscriptionResult = {
  success: boolean;
  error?: string;
  creditsDays?: number;
  newEndDate?: string;
};

/**
 * Pause a Pro subscription
 *
 * When paused:
 * - Store keeps Pro features until resume
 * - Time while paused counts toward credits (extends subscription on resume)
 * - Can set optional auto-resume date
 */
export async function pauseSubscription(
  tenantId: string,
  options: {
    reason?: string;
    autoResumeAt?: string; // ISO date string
  }
): Promise<PauseSubscriptionResult> {
  try {
    // 1. Auth check
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Permission check
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Get tenant and verify eligibility
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    // Can only pause active Pro subscriptions
    if (tenant.subscriptionPlan !== "pro") {
      return { success: false, error: "Only Pro subscriptions can be paused" };
    }

    if (tenant.subscriptionStatus !== "active") {
      return { success: false, error: "Subscription must be active to pause" };
    }

    if (tenant.pausedAt) {
      return { success: false, error: "Subscription is already paused" };
    }

    // 4. Validate auto-resume date if provided
    let autoResumeAt: string | null = null;
    if (options.autoResumeAt) {
      const resumeDate = new Date(options.autoResumeAt);
      const now = new Date();

      // Must be in the future
      if (resumeDate <= now) {
        return {
          success: false,
          error: "Auto-resume date must be in the future",
        };
      }

      // Maximum pause duration: 90 days
      const maxPauseDays = 90;
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + maxPauseDays);

      if (resumeDate > maxDate) {
        return {
          success: false,
          error: `Cannot pause for more than ${maxPauseDays} days`,
        };
      }

      autoResumeAt = resumeDate.toISOString();
    }

    // 5. Update tenant
    const now = new Date().toISOString();
    await db
      .update(tenants)
      .set({
        pausedAt: now,
        pauseReason: options.reason,
        autoResumeAt,
        subscriptionStatus: "active", // Keep as active, pausedAt indicates pause
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // 6. Send notification to all owners/admins
    const { sendSubscriptionPausedNotification } =
      await import("@/lib/notifications/triggers");
    const members = await db.query.tenantMembers.findMany({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        inArray(tenantMembers.role, ["owner", "admin"])
      ),
      columns: { userId: true },
    });

    for (const member of members) {
      await sendSubscriptionPausedNotification({
        userId: member.userId,
        tenantId,
        storeName: tenant.name,
        storeSlug: tenant.slug,
        autoResumeDate: autoResumeAt || undefined,
      });
    }

    // Revalidate billing page
    revalidatePath(`/dashboard/${tenant.slug}/billing`);

    return {
      success: true,
      pausedAt: now,
      autoResumeAt: autoResumeAt || undefined,
    };
  } catch (error) {
    console.error("[pauseSubscription] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to pause subscription",
    };
  }
}

/**
 * Resume a paused Pro subscription
 *
 * On resume:
 * - Days spent paused are credited (subscription end date extended)
 * - Store immediately regains full Pro features
 */
export async function resumeSubscription(
  tenantId: string
): Promise<ResumeSubscriptionResult> {
  try {
    // 1. Auth check
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Permission check
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Get tenant and verify eligibility
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    if (!tenant.pausedAt) {
      return { success: false, error: "Subscription is not paused" };
    }

    // 4. Calculate pause credits
    const pausedDate = new Date(tenant.pausedAt);
    const now = new Date();
    const daysPaused = Math.floor(
      (now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 5. Extend subscription end date by days paused
    let newEndDate: Date;
    if (tenant.subscriptionEndsAt) {
      newEndDate = new Date(tenant.subscriptionEndsAt);
      newEndDate.setDate(newEndDate.getDate() + daysPaused);
    } else {
      // Edge case: no end date, set 30 days from now
      newEndDate = new Date(now);
      newEndDate.setDate(newEndDate.getDate() + 30);
    }

    // 6. Update tenant
    const nowIso = now.toISOString();
    const totalCredits = (tenant.pauseCreditsDays || 0) + daysPaused;

    await db
      .update(tenants)
      .set({
        pausedAt: null,
        pauseReason: null,
        autoResumeAt: null,
        pauseCreditsDays: totalCredits,
        subscriptionEndsAt: newEndDate.toISOString(),
        subscriptionStatus: "active",
        updatedAt: nowIso,
      })
      .where(eq(tenants.id, tenantId));

    // 7. Send notification to all owners/admins
    const { sendSubscriptionResumedNotification } =
      await import("@/lib/notifications/triggers");
    const members = await db.query.tenantMembers.findMany({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        inArray(tenantMembers.role, ["owner", "admin"])
      ),
      columns: { userId: true },
    });

    for (const member of members) {
      await sendSubscriptionResumedNotification({
        userId: member.userId,
        tenantId,
        storeName: tenant.name,
        storeSlug: tenant.slug,
        creditsDays: daysPaused,
        newEndDate: newEndDate.toISOString(),
      });
    }

    // Revalidate billing page
    revalidatePath(`/dashboard/${tenant.slug}/billing`);

    return {
      success: true,
      creditsDays: daysPaused,
      newEndDate: newEndDate.toISOString(),
    };
  } catch (error) {
    console.error("[resumeSubscription] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume subscription",
    };
  }
}

// =============================================================================
// PRORATED SUBSCRIPTION REFUNDS (Admin Only)
// =============================================================================

export type ProratedRefundCalculation = {
  originalAmount: number;
  refundAmount: number;
  daysUsed: number;
  daysRemaining: number;
  dailyRate: number;
  periodStart: string;
  periodEnd: string;
};

export type RequestSubscriptionRefundResult = {
  success: boolean;
  error?: string;
  refundId?: string;
  calculation?: ProratedRefundCalculation;
};

/**
 * Calculate prorated refund for a subscription (internal helper)
 *
 * Formula:
 * - dailyRate = originalAmount / totalDays
 * - refundAmount = dailyRate * daysRemaining
 */
function calculateProratedRefund(
  originalAmount: number,
  periodStart: Date,
  periodEnd: Date,
  refundDate: Date = new Date()
): ProratedRefundCalculation {
  // Calculate days
  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysUsed = Math.max(
    0,
    Math.ceil(
      (refundDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const daysRemaining = Math.max(0, totalDays - daysUsed);

  // Calculate rates
  const dailyRate = originalAmount / totalDays;
  const refundAmount = Math.round(dailyRate * daysRemaining * 100) / 100; // Round to 2 decimals

  return {
    originalAmount,
    refundAmount,
    daysUsed,
    daysRemaining,
    dailyRate: Math.round(dailyRate * 10000) / 10000, // 4 decimal places
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

/**
 * Request a prorated subscription refund (Admin only)
 *
 * Creates a refund request that can be approved and processed.
 * The subscription is immediately downgraded to free.
 */
export async function requestSubscriptionRefund(
  tenantId: string,
  options: {
    reason: string;
    reasonCode:
      | "cancellation"
      | "downgrade"
      | "admin"
      | "dispute"
      | "service_issue";
    refundMethod?: "original_payment" | "store_credit" | "manual";
    adminNotes?: string;
  }
): Promise<RequestSubscriptionRefundResult> {
  try {
    // 1. Auth check - require platform admin
    const { requirePlatformAdmin } = await import("@/lib/auth/server");
    const adminUser = await requirePlatformAdmin();

    // 2. Get tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    // Must be a Pro subscription
    if (tenant.subscriptionPlan !== "pro") {
      return {
        success: false,
        error: "Only Pro subscriptions can be refunded",
      };
    }

    // Must have billing dates
    if (!tenant.subscriptionStartedAt || !tenant.subscriptionEndsAt) {
      return {
        success: false,
        error: "Subscription period dates not found",
      };
    }

    // 3. Get the original payment amount from the most recent billing transaction
    const [billingTx] = await db
      .select()
      .from(billingTransactions)
      .where(
        and(
          eq(billingTransactions.tenantId, tenantId),
          eq(billingTransactions.status, "completed"),
          eq(billingTransactions.toPlan, "pro")
        )
      )
      .orderBy(desc(billingTransactions.createdAt))
      .limit(1);

    if (!billingTx) {
      return {
        success: false,
        error: "No completed payment found for this subscription",
      };
    }

    const originalAmount = parseFloat(billingTx.amount);
    const periodStart = new Date(tenant.subscriptionStartedAt);
    const periodEnd = new Date(tenant.subscriptionEndsAt);

    // 4. Calculate prorated refund
    const calculation = calculateProratedRefund(
      originalAmount,
      periodStart,
      periodEnd
    );

    // 5. Create refund record
    const { subscriptionRefunds } = await import("@/lib/db/schema");
    const now = new Date().toISOString();

    const [refund] = await db
      .insert(subscriptionRefunds)
      .values({
        tenantId,
        originalAmount: calculation.originalAmount.toString(),
        refundAmount: calculation.refundAmount.toString(),
        daysUsed: calculation.daysUsed,
        daysRemaining: calculation.daysRemaining,
        dailyRate: calculation.dailyRate.toString(),
        periodStart: calculation.periodStart,
        periodEnd: calculation.periodEnd,
        reason: options.reason,
        reasonCode: options.reasonCode,
        status: "pending",
        refundMethod: options.refundMethod || "original_payment",
        requestedBy: adminUser.id,
        requestedAt: now,
        adminNotes: options.adminNotes,
      })
      .returning();

    // 6. Downgrade the subscription immediately
    await db
      .update(tenants)
      .set({
        subscriptionPlan: "free",
        subscriptionStatus: "cancelled",
        subscriptionNotes: `Refund requested: ${options.reason}. Refund ID: ${refund.id}`,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // Revalidate billing page
    revalidatePath(`/dashboard/${tenant.slug}/billing`);

    return {
      success: true,
      refundId: refund.id,
      calculation,
    };
  } catch (error) {
    console.error("[requestSubscriptionRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request refund",
    };
  }
}

/**
 * Approve a subscription refund (Admin only)
 */
export async function approveSubscriptionRefund(
  refundId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Auth check - require platform admin
    const { requirePlatformAdmin } = await import("@/lib/auth/server");
    const adminUser = await requirePlatformAdmin();

    // Get refund
    const { subscriptionRefunds } = await import("@/lib/db/schema");
    const [refund] = await db
      .select()
      .from(subscriptionRefunds)
      .where(eq(subscriptionRefunds.id, refundId))
      .limit(1);

    if (!refund) {
      return { success: false, error: "Refund not found" };
    }

    if (refund.status !== "pending") {
      return {
        success: false,
        error: `Cannot approve refund with status: ${refund.status}`,
      };
    }

    // Update status
    const now = new Date().toISOString();
    await db
      .update(subscriptionRefunds)
      .set({
        status: "approved",
        approvedBy: adminUser.id,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(subscriptionRefunds.id, refundId));

    return { success: true };
  } catch (error) {
    console.error("[approveSubscriptionRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to approve refund",
    };
  }
}

/**
 * Process a subscription refund (Admin only)
 *
 * Marks the refund as completed. Triggering the actual gateway
 * refund (HesabPay) is currently manual.
 */
export async function processSubscriptionRefund(
  refundId: string,
  options?: {
    gatewayRefundId?: string;
    adminNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Auth check - require platform admin
    const { requirePlatformAdmin } = await import("@/lib/auth/server");
    const adminUser = await requirePlatformAdmin();

    // Get refund
    const { subscriptionRefunds } = await import("@/lib/db/schema");
    const [refund] = await db
      .select()
      .from(subscriptionRefunds)
      .where(eq(subscriptionRefunds.id, refundId))
      .limit(1);

    if (!refund) {
      return { success: false, error: "Refund not found" };
    }

    if (refund.status !== "approved") {
      return {
        success: false,
        error: `Cannot process refund with status: ${refund.status}`,
      };
    }

    // Update status
    const now = new Date().toISOString();
    await db
      .update(subscriptionRefunds)
      .set({
        status: "completed",
        processedBy: adminUser.id,
        processedAt: now,
        gatewayRefundId: options?.gatewayRefundId,
        adminNotes: options?.adminNotes
          ? `${refund.adminNotes || ""}\n${now}: ${options.adminNotes}`
          : refund.adminNotes,
        updatedAt: now,
      })
      .where(eq(subscriptionRefunds.id, refundId));

    // Get tenant for notification
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, refund.tenantId))
      .limit(1);

    if (tenant) {
      revalidatePath(`/dashboard/${tenant.slug}/billing`);
    }

    return { success: true };
  } catch (error) {
    console.error("[processSubscriptionRefund] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process refund",
    };
  }
}

/**
 * Get refund preview without creating the refund
 */
export async function getRefundPreview(tenantId: string): Promise<{
  success: boolean;
  error?: string;
  calculation?: ProratedRefundCalculation;
}> {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { success: false, error: "Store not found" };
    }

    if (tenant.subscriptionPlan !== "pro") {
      return {
        success: false,
        error: "Only Pro subscriptions can be refunded",
      };
    }

    if (!tenant.subscriptionStartedAt || !tenant.subscriptionEndsAt) {
      return { success: false, error: "Subscription period dates not found" };
    }

    // Get the original payment amount
    const [billingTx] = await db
      .select()
      .from(billingTransactions)
      .where(
        and(
          eq(billingTransactions.tenantId, tenantId),
          eq(billingTransactions.status, "completed"),
          eq(billingTransactions.toPlan, "pro")
        )
      )
      .orderBy(desc(billingTransactions.createdAt))
      .limit(1);

    if (!billingTx) {
      return { success: false, error: "No completed payment found" };
    }

    const calculation = calculateProratedRefund(
      parseFloat(billingTx.amount),
      new Date(tenant.subscriptionStartedAt),
      new Date(tenant.subscriptionEndsAt)
    );

    return { success: true, calculation };
  } catch (error) {
    console.error("[getRefundPreview] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to calculate refund",
    };
  }
}
