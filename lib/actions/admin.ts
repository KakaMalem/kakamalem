"use server";

import { db } from "@/lib/db";
import {
  tenants,
  platformSettings,
  adminAuditLog,
  billingTransactions,
  invoices,
  type BillingTransactionType,
  type PaymentMethod,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { headers } from "next/headers";
import { generateInvoiceNumber } from "@/lib/db/queries/billing";

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

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true, message: `Store status updated to ${status}` };
  } catch (error) {
    console.error("Failed to update store status:", error);
    return { success: false, error: "Failed to update store status" };
  }
}

/**
 * Update store subscription (upgrade to pro, downgrade to free, etc.)
 */
export async function updateStoreSubscription(
  storeId: string,
  plan: "free" | "pro",
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired",
  notes?: string
): Promise<ActionResult> {
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

    // If upgrading to pro with active status, set subscription start
    if (plan === "pro" && status === "active") {
      updateData.subscriptionStartedAt = now;
      // Set subscription end to 30 days from now
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      updateData.subscriptionEndsAt = endDate.toISOString();
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
  freeProductLimit?: number;
  freeStoreLimit?: number;
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
    } = data;

    // Get store info
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        currency: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const now = new Date().toISOString();
    let invoiceId: string | undefined;

    // Create invoice if requested
    if (createInvoice && type === "subscription_payment") {
      const invoiceNumber = await generateInvoiceNumber(storeId);
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
              description: "Pro Plan Subscription (Monthly)",
              quantity: 1,
              unitPrice: amount,
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

    // Upgrade to pro if this is a payment and upgrade is requested
    if (upgradeToProOnPayment && type === "subscription_payment") {
      // Calculate subscription period (30 days from now)
      const subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

      await db
        .update(tenants)
        .set({
          subscriptionPlan: "pro",
          subscriptionStatus: "active",
          subscriptionStartedAt: now,
          subscriptionEndsAt: subscriptionEnd.toISOString(),
          updatedAt: now,
        })
        .where(eq(tenants.id, storeId));
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
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);
    revalidatePath(`/dashboard/${store.name}/billing`);

    return {
      success: true,
      message: `Transaction recorded successfully${invoiceId ? " with invoice" : ""}`,
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
        currency: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const invoiceNumber = await generateInvoiceNumber(storeId);
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
        status: "sent",
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

    revalidatePath(`/admin/stores/${invoice.tenantId}`);

    return { success: true, message: "Invoice marked as paid" };
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

    if (invoice.status === "paid") {
      return { success: false, error: "Cannot void a paid invoice" };
    }

    // Update invoice status
    await db
      .update(invoices)
      .set({
        status: "void",
        notes: reason
          ? `${invoice.notes ?? ""}\n\nVoided: ${reason}`.trim()
          : invoice.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId));

    // Log the action
    await logAdminAction(admin.id, "invoice.void", "invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      reason,
    });

    revalidatePath(`/admin/stores/${invoice.tenantId}`);

    return { success: true, message: "Invoice voided" };
  } catch (error) {
    console.error("Failed to void invoice:", error);
    return { success: false, error: "Failed to void invoice" };
  }
}
