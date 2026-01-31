"use server";

import { db } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { tenants, invoices, billingTransactions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/server";
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
};

// =============================================================================
// PRO UPGRADE
// =============================================================================

/**
 * Initiate a Pro subscription upgrade for a tenant
 *
 * Creates an invoice for the subscription and redirects to HesabPay payment.
 * If an unpaid subscription invoice already exists, it will be reused.
 */
export async function initiateProUpgrade(
  tenantId: string
): Promise<InitiateUpgradeResult> {
  try {
    // 1. Auth check
    await requireAuth();

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

    // Check if already has active Pro subscription
    if (
      tenant.subscriptionPlan === "pro" &&
      tenant.subscriptionStatus === "active"
    ) {
      return {
        success: false,
        error: "Store already has an active Pro subscription",
      };
    }

    // 4. Get platform settings for price
    const settings = await db.query.platformSettings.findFirst();
    const proPlanPrice = parseFloat(settings?.proPlanPriceAfn || "1100");

    // 5. Check for existing unpaid subscription invoice
    const [existingInvoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, "sent") // Unpaid invoice
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let invoice = existingInvoice;

    // 6. Create new invoice if none exists
    if (!invoice) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Generate unique invoice number with store code prefix
      const invoiceNumber = generateInvoiceNumber(tenant.slug);

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
            periodStart: now.toISOString(),
            periodEnd: periodEnd.toISOString(),
            dueDate: now.toISOString(),
            status: "sent",
            items: [
              {
                description: "Kaka Malem Pro - Monthly Subscription",
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

        // 7. Create billing transaction (pending)
        await db.insert(billingTransactions).values({
          tenantId,
          type: "subscription_upgrade",
          amount: proPlanPrice.toString(),
          currency: "AFN",
          periodStart: now.toISOString(),
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
            and(eq(invoices.tenantId, tenantId), eq(invoices.status, "sent"))
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

    // 8. Create payment session
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
