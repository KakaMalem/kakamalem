"use server";

import { db } from "@/lib/db";
import {
  tenants,
  tenantMembers,
  user,
  platformSettings,
  adminAuditLog,
  billingTransactions,
  invoices,
  platformAffiliateReferrals,
  platformAffiliateCommissions,
  platformAffiliates,
  type BillingTransactionType,
  type PaymentMethod,
} from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { headers } from "next/headers";
import { generateInvoiceNumber } from "@/lib/db/queries/billing";
import { sendEmail } from "@/lib/email";
import { getStoreSuspendedEmailHtml } from "@/lib/email/templates/store-suspended";

// =============================================================================
// ADMIN SERVER ACTIONS
// =============================================================================
// Server actions for admin operations with audit logging
// =============================================================================

type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/**
 * Log an admin action to the audit log
 */
async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details?: Record<string, unknown>
) {
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0] ||
    headersList.get("x-real-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  await db.insert(adminAuditLog).values({
    adminId,
    action,
    targetType,
    targetId,
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Update store status (suspend, activate, etc.)
 */
export async function updateStoreStatus(
  storeId: string,
  status: "pending_review" | "active" | "suspended" | "inactive",
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current store state for audit log
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const previousStatus = store.status;

    // Update status
    await db
      .update(tenants)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, `store.${status}`, "tenant", storeId, {
      storeName: store.name,
      previousStatus,
      newStatus: status,
      reason,
    });

    // Notify owners/admins when a store is newly suspended.
    // Fire-and-forget: email failures shouldn't roll back the suspension.
    if (status === "suspended" && previousStatus !== "suspended") {
      try {
        await sendStoreSuspendedEmail({
          storeId,
          storeName: store.name,
          reason,
        });
      } catch (emailError) {
        console.error("Failed to send store suspension email:", emailError);
      }
    }

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true, message: `Store status updated to ${status}` };
  } catch (error) {
    console.error("Failed to update store status:", error);
    return { success: false, error: "Failed to update store status" };
  }
}

async function sendStoreSuspendedEmail({
  storeId,
  storeName,
  reason,
}: {
  storeId: string;
  storeName: string;
  reason?: string;
}) {
  const members = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, storeId),
      inArray(tenantMembers.role, ["owner", "admin"])
    ),
    columns: { userId: true },
  });

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return;

  const recipients = await db.query.user.findMany({
    where: inArray(user.id, userIds),
    columns: { email: true, name: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const supportEmail =
    process.env.SUPPORT_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    "kakamalem.team@gmail.com";

  await Promise.all(
    recipients
      .filter((r) => !!r.email)
      .map((r) =>
        sendEmail({
          to: r.email,
          subject: `Your store ${storeName} has been suspended`,
          html: getStoreSuspendedEmailHtml({
            ownerName: r.name || "Store Owner",
            storeName,
            reason,
            supportEmail,
            baseUrl,
          }),
        }).catch((err) => {
          console.error(`Failed to send suspension email to ${r.email}:`, err);
        })
      )
  );
}

/**
 * Permanently delete a store and all associated data.
 * Requires typing the store name as confirmation.
 */
export async function deleteStore(
  storeId: string,
  confirmationName: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: { id: true, name: true, slug: true },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    if (confirmationName !== store.name) {
      return { success: false, error: "Store name does not match" };
    }

    // Log before deleting (the store won't exist after)
    await logAdminAction(admin.id, "store.delete", "tenant", storeId, {
      storeName: store.name,
      storeSlug: store.slug,
    });

    // Cascade delete via FK constraints
    await db.delete(tenants).where(eq(tenants.id, storeId));

    revalidatePath("/admin/stores");

    return { success: true, message: `Store "${store.name}" deleted` };
  } catch (error) {
    console.error("Failed to delete store:", error);
    return { success: false, error: "Failed to delete store" };
  }
}

/**
 * Update store subscription (upgrade to pro, downgrade to free, etc.)
 */
export async function updateStoreSubscription(
  storeId: string,
  plan: "free" | "pro",
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired",
  options: {
    months?: number;
    billingInterval?: "monthly" | "yearly";
    customEndDate?: string;
    notes?: string;
    resetReminders?: boolean;
  } = {}
): Promise<ActionResult> {
  const {
    months = 1,
    billingInterval = "monthly",
    customEndDate,
    notes,
    resetReminders = true,
  } = options;

  try {
    const admin = await requirePlatformAdmin();

    // Get current store state for audit log
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionStartedAt: true,
        subscriptionEndsAt: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const now = new Date().toISOString();

    // Build update data
    const updateData: Record<string, unknown> = {
      subscriptionPlan: plan,
      subscriptionStatus: status,
      updatedAt: now,
    };

    // If upgrading to pro with active status, set subscription dates
    if (plan === "pro" && status === "active") {
      updateData.billingInterval = billingInterval;

      // Only set subscriptionStartedAt for new subscriptions or upgrades from free
      if (!store.subscriptionStartedAt || store.subscriptionPlan === "free") {
        updateData.subscriptionStartedAt = now;
      }

      // Calculate end date or use custom one
      if (customEndDate) {
        updateData.subscriptionEndsAt = customEndDate;
      } else {
        // Calculate end date based on months
        // If already Pro and extending, start from current end date
        let currentEnd =
          store.subscriptionPlan === "pro" && store.subscriptionEndsAt
            ? new Date(store.subscriptionEndsAt)
            : new Date();

        // If current end date is in the past, start from now
        if (currentEnd < new Date()) {
          currentEnd = new Date();
        }

        const endDate = new Date(currentEnd);
        endDate.setMonth(endDate.getMonth() + months);
        updateData.subscriptionEndsAt = endDate.toISOString();
      }
    }

    // Reset reminder tracking to avoid annoying persistent emails for new periods
    if (resetReminders) {
      updateData.lastReminderSentAt = null;
      updateData.lastReminderDaysBefore = null;
    }

    // Add notes if provided
    if (notes) {
      updateData.subscriptionNotes = notes;
    }

    // Update subscription
    await db.update(tenants).set(updateData).where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(
      admin.id,
      `subscription.${plan}.${status}`,
      "tenant",
      storeId,
      {
        storeName: store.name,
        previousPlan: store.subscriptionPlan,
        previousStatus: store.subscriptionStatus,
        newPlan: plan,
        newStatus: status,
        notes,
      }
    );

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return {
      success: true,
      message: `Subscription updated to ${plan} (${status})`,
    };
  } catch (error) {
    console.error("Failed to update subscription:", error);
    return { success: false, error: "Failed to update subscription" };
  }
}

/**
 * Extend store trial period
 */
export async function extendStoreTrial(
  storeId: string,
  days: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current store state
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    // Calculate new trial end date
    const currentEnd = store.trialEndsAt
      ? new Date(store.trialEndsAt)
      : new Date();
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

    // Update trial
    await db
      .update(tenants)
      .set({
        trialEndsAt: newEnd.toISOString(),
        subscriptionStatus: "trialing",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, "trial.extend", "tenant", storeId, {
      storeName: store.name,
      previousEnd: store.trialEndsAt,
      newEnd: newEnd.toISOString(),
      daysAdded: days,
      reason,
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true, message: `Trial extended by ${days} days` };
  } catch (error) {
    console.error("Failed to extend trial:", error);
    return { success: false, error: "Failed to extend trial" };
  }
}

/**
 * Add admin notes to a store
 */
export async function addStoreNotes(
  storeId: string,
  notes: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    await db
      .update(tenants)
      .set({
        subscriptionNotes: notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, "store.notes", "tenant", storeId, {
      notes,
    });

    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to add notes:", error);
    return { success: false, error: "Failed to add notes" };
  }
}

/**
 * Update platform settings
 */
export async function updatePlatformSettings(data: {
  proPlanPriceAfn?: string;
  proPlanYearlyPriceAfn?: string;
  freeProductLimit?: number;
  trialDurationDays?: number;
  transactionFeePercent?: string;
  trialWarningDays?: number;
}): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current settings
    const currentSettings = await db.query.platformSettings.findFirst();

    const now = new Date().toISOString();

    if (currentSettings) {
      // Update existing settings
      await db
        .update(platformSettings)
        .set({
          ...data,
          updatedAt: now,
          updatedBy: admin.id,
        })
        .where(eq(platformSettings.id, currentSettings.id));
    } else {
      // Create initial settings
      await db.insert(platformSettings).values({
        ...data,
        updatedAt: now,
        updatedBy: admin.id,
      });
    }

    // Log the action
    await logAdminAction(admin.id, "settings.update", "settings", null, {
      previousSettings: currentSettings,
      newSettings: data,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return { success: true, message: "Settings updated successfully" };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

// =============================================================================
// BILLING ACTIONS
// =============================================================================

/**
 * Record a billing transaction (payment, refund, credit, etc.)
 * This also optionally upgrades the store subscription and creates an invoice
 */
export async function recordBillingTransaction(data: {
  storeId: string;
  type: BillingTransactionType;
  amount: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
  createInvoice?: boolean;
  upgradeToProOnPayment?: boolean;
  periodMonths?: number; // For multi-month subscriptions
  billingInterval?: "monthly" | "yearly"; // Force specific interval
}): Promise<ActionResult & { transactionId?: string; invoiceId?: string }> {
  try {
    const admin = await requirePlatformAdmin();

    const {
      storeId,
      type,
      amount,
      paymentMethod,
      paymentReference,
      periodStart,
      periodEnd,
      notes,
      createInvoice = false,
      upgradeToProOnPayment = false,
      periodMonths = 1,
      billingInterval,
    } = data;

    // Get store info (including subscription end date for proper extension)
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        slug: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        currency: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const now = new Date().toISOString();
    let invoiceId: string | undefined;

    // Create invoice if requested
    if (
      createInvoice &&
      (type === "subscription_payment" || type === "subscription_upgrade")
    ) {
      const invoiceNumber = generateInvoiceNumber(store.slug);
      const periodLabel =
        periodMonths === 1
          ? "Monthly"
          : periodMonths === 12
            ? "Yearly"
            : `${periodMonths}-Month`;
      const [newInvoice] = await db
        .insert(invoices)
        .values({
          tenantId: storeId,
          invoiceNumber,
          subtotal: amount.toString(),
          tax: "0",
          total: amount.toString(),
          currency: store.currency ?? "AFN",
          periodStart,
          periodEnd,
          dueDate: now,
          status: "paid",
          paidAt: now,
          paidAmount: amount.toString(),
          items: [
            {
              description: `Pro Plan Subscription (${periodLabel})`,
              quantity: periodMonths,
              unitPrice: amount / periodMonths,
              total: amount,
            },
          ],
          notes,
        })
        .returning({ id: invoices.id });

      invoiceId = newInvoice.id;
    }

    // Create billing transaction
    const [transaction] = await db
      .insert(billingTransactions)
      .values({
        tenantId: storeId,
        type,
        amount: amount.toString(),
        currency: store.currency ?? "AFN",
        paymentMethod,
        paymentReference,
        periodStart,
        periodEnd,
        fromPlan:
          type === "subscription_upgrade" ? store.subscriptionPlan : undefined,
        toPlan: type === "subscription_upgrade" ? "pro" : undefined,
        status: "completed",
        invoiceId,
        processedBy: admin.id,
        notes,
      })
      .returning({ id: billingTransactions.id });

    if (
      (upgradeToProOnPayment || store.subscriptionPlan === "pro") &&
      (type === "subscription_payment" || type === "subscription_upgrade")
    ) {
      // Industry standard: extend from the LATER of (now) or (current subscription end)
      // This allows payments to "stack" - if already Pro until March 15,
      // adding another month extends to April 15, not "today + 30 days"
      const currentEnd = store.subscriptionEndsAt
        ? new Date(store.subscriptionEndsAt)
        : new Date();
      const nowDate = new Date();

      // If already Pro with time remaining, extend from current end date
      // Otherwise, start fresh from now
      const isAlreadyProWithTimeRemaining =
        store.subscriptionPlan === "pro" && currentEnd > nowDate;

      // Use provided periodEnd if available, otherwise calculate from months
      const subscriptionEnd = periodEnd
        ? new Date(periodEnd)
        : (() => {
            const extendFrom = isAlreadyProWithTimeRemaining
              ? currentEnd
              : nowDate;
            const end = new Date(extendFrom);
            end.setMonth(end.getMonth() + periodMonths);
            return end;
          })();

      // Only update subscriptionStartedAt if this is a NEW subscription (not extension)
      const isNewSubscription = !isAlreadyProWithTimeRemaining;

      // Determine interval (if not provided, auto-detect yearly if months >= 12)
      const interval =
        billingInterval ?? (periodMonths >= 12 ? "yearly" : "monthly");

      await db
        .update(tenants)
        .set({
          subscriptionPlan: "pro",
          subscriptionStatus: "active",
          billingInterval: interval,
          ...(isNewSubscription && { subscriptionStartedAt: now }),
          subscriptionEndsAt: subscriptionEnd.toISOString(),
          // Reset reminders since we just updated the end date
          lastReminderSentAt: null,
          lastReminderDaysBefore: null,
          updatedAt: now,
        })
        .where(eq(tenants.id, storeId));
    }

    // =========================================================================
    // AFFILIATE COMMISSION ATTRIBUTION
    // Check if this store was referred by an affiliate and create commission
    // =========================================================================
    let commissionCreated = false;
    if (type === "subscription_payment") {
      try {
        // Check if this store has an affiliate referral
        const referral = await db.query.platformAffiliateReferrals.findFirst({
          where: eq(platformAffiliateReferrals.tenantId, storeId),
          with: {
            affiliate: {
              columns: {
                id: true,
                currentCommissionRate: true,
                status: true,
              },
            },
          },
        });

        if (referral && referral.affiliate?.status === "approved") {
          // Check if commission period is still active
          const commissionEndsAt = referral.commissionEndsAt
            ? new Date(referral.commissionEndsAt)
            : null;
          const isWithinCommissionPeriod =
            !commissionEndsAt || commissionEndsAt > new Date();

          if (isWithinCommissionPeriod) {
            // Get commission rate (from referral or affiliate's current rate)
            const commissionRate = parseFloat(
              referral.commissionRate ||
                referral.affiliate.currentCommissionRate ||
                "30"
            );

            // Calculate commission amount
            const commissionAmount = (amount * commissionRate) / 100;

            // Determine commission month (count existing commissions + 1)
            const existingCommissions =
              await db.query.platformAffiliateCommissions.findMany({
                where: eq(platformAffiliateCommissions.referralId, referral.id),
                columns: { id: true },
              });
            const commissionMonth = existingCommissions.length + 1;

            // Only create commission if within 12 months
            if (commissionMonth <= 12) {
              // Create commission record
              await db.insert(platformAffiliateCommissions).values({
                affiliateId: referral.affiliateId,
                referralId: referral.id,
                tenantId: storeId,
                subscriptionAmount: amount.toString(),
                commissionRate: commissionRate.toString(),
                commissionAmount: commissionAmount.toString(),
                commissionMonth,
                currency: store.currency ?? "AFN",
                periodStart: periodStart || now,
                periodEnd: periodEnd || now,
                status: "available", // Available for payout
              });

              // Update affiliate totals
              await db
                .update(platformAffiliates)
                .set({
                  totalEarned: sql`${platformAffiliates.totalEarned} + ${commissionAmount}`,
                  successfulReferrals: sql`CASE
                    WHEN ${commissionMonth} = 1 THEN ${platformAffiliates.successfulReferrals} + 1
                    ELSE ${platformAffiliates.successfulReferrals}
                  END`,
                })
                .where(eq(platformAffiliates.id, referral.affiliateId));

              // If this is the first payment, update referral record
              if (commissionMonth === 1) {
                const commissionEndDate = new Date();
                commissionEndDate.setMonth(commissionEndDate.getMonth() + 12);

                await db
                  .update(platformAffiliateReferrals)
                  .set({
                    firstPaidAt: now,
                    commissionEndsAt: commissionEndDate.toISOString(),
                    status: "active",
                  })
                  .where(eq(platformAffiliateReferrals.id, referral.id));
              }

              commissionCreated = true;
            }
          }
        }
      } catch (commissionError) {
        // Log but don't fail the main transaction
        console.error(
          "Failed to create affiliate commission:",
          commissionError
        );
      }
    }

    // Log the action
    await logAdminAction(admin.id, `billing.${type}`, "tenant", storeId, {
      storeName: store.name,
      amount,
      paymentMethod,
      paymentReference,
      transactionId: transaction.id,
      invoiceId,
      upgradeToProOnPayment,
      affiliateCommissionCreated: commissionCreated,
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);
    revalidatePath(`/dashboard/${store.slug}/billing`);

    // Build success message
    let message = "Transaction recorded successfully";
    if (invoiceId) message += " with invoice";
    if (commissionCreated) message += " (affiliate commission attributed)";

    return {
      success: true,
      message,
      transactionId: transaction.id,
      invoiceId,
    };
  } catch (error) {
    console.error("Failed to record billing transaction:", error);
    return { success: false, error: "Failed to record billing transaction" };
  }
}

/**
 * Create an invoice for a store (without recording a payment)
 */
export async function createInvoice(data: {
  storeId: string;
  amount: number;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  description?: string;
  notes?: string;
}): Promise<ActionResult & { invoiceId?: string; invoiceNumber?: string }> {
  try {
    const admin = await requirePlatformAdmin();

    const {
      storeId,
      amount,
      periodStart,
      periodEnd,
      dueDate,
      description = "Pro Plan Subscription (Monthly)",
      notes,
    } = data;

    // Get store info
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        slug: true,
        currency: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const invoiceNumber = generateInvoiceNumber(store.slug);
    const now = new Date().toISOString();

    // Create invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        tenantId: storeId,
        invoiceNumber,
        subtotal: amount.toString(),
        tax: "0",
        total: amount.toString(),
        currency: store.currency ?? "AFN",
        periodStart,
        periodEnd,
        dueDate: dueDate ?? now,
        status: "unpaid",
        paidAmount: "0",
        items: [
          {
            description,
            quantity: 1,
            unitPrice: amount,
            total: amount,
          },
        ],
        notes,
        sentAt: now,
      })
      .returning({ id: invoices.id });

    // Log the action
    await logAdminAction(admin.id, "invoice.create", "tenant", storeId, {
      storeName: store.name,
      invoiceId: invoice.id,
      invoiceNumber,
      amount,
    });

    revalidatePath(`/admin/stores/${storeId}`);
    revalidatePath(`/dashboard/${store.name}/billing`);

    return {
      success: true,
      message: `Invoice ${invoiceNumber} created`,
      invoiceId: invoice.id,
      invoiceNumber,
    };
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return { success: false, error: "Failed to create invoice" };
  }
}

/**
 * Mark an invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: string,
  paymentData: {
    paymentMethod?: PaymentMethod;
    paymentReference?: string;
    notes?: string;
  }
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get invoice
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const now = new Date().toISOString();

    // Update invoice status
    await db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: now,
        paidAmount: invoice.total,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    // Create billing transaction for this payment
    await db.insert(billingTransactions).values({
      tenantId: invoice.tenantId,
      type: "subscription_payment",
      amount: invoice.total,
      currency: invoice.currency,
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      status: "completed",
      invoiceId,
      processedBy: admin.id,
      notes: paymentData.notes,
    });

    // Log the action
    await logAdminAction(admin.id, "invoice.paid", "invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.total,
      ...paymentData,
    });

    // Update tenant subscription status and period
    if (invoice.periodEnd) {
      await db
        .update(tenants)
        .set({
          subscriptionPlan: "pro",
          subscriptionStatus: "active",
          subscriptionEndsAt: invoice.periodEnd,
          subscriptionStartedAt:
            invoice.periodStart || new Date().toISOString(),
          updatedAt: now,
        })
        .where(eq(tenants.id, invoice.tenantId));
    }

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/stores/${invoice.tenantId}`);

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} marked as paid and subscription updated`,
    };
  } catch (error) {
    console.error("Failed to mark invoice as paid:", error);
    return { success: false, error: "Failed to mark invoice as paid" };
  }
}

/**
 * Void/cancel an invoice
 */
export async function voidInvoice(
  invoiceId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get invoice
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice.status === "void") {
      return { success: false, error: "Invoice is already voided" };
    }

    // Update invoice status
    await db
      .update(invoices)
      .set({
        status: "void",
        notes: reason
          ? `${invoice.notes ?? ""}\n\nVoided: ${reason} (Admin Override)`.trim()
          : invoice.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId));

    // Log the action
    await logAdminAction(admin.id, "invoice.void", "invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      previousStatus: invoice.status,
      reason,
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/stores/${invoice.tenantId}`);

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} voided`,
    };
  } catch (error) {
    console.error("Failed to void invoice:", error);
    return { success: false, error: "Failed to void invoice" };
  }
}

export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "paid"
  | "overdue"
  | "void"
  | "partially_paid";

/**
 * Administrative override to edit ANY invoice field (even if paid/void)
 * Use for production data fixes only.
 */
export async function updateInvoiceAdmin(
  invoiceId: string,
  data: {
    total?: string;
    subtotal?: string;
    description?: string;
    status?: InvoiceStatus;
    dueDate?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
    invoiceNumber?: string;
  }
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) return { success: false, error: "Invoice not found" };

    await db
      .update(invoices)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId));

    // Log high-priority override
    await logAdminAction(admin.id, "invoice.override", "invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      changes: data,
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/stores/${invoice.tenantId}`);

    return { success: true, message: "Invoice override successful" };
  } catch (error) {
    console.error("Failed to override invoice:", error);
    return { success: false, error: "Override failed" };
  }
}
