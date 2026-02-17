import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, tenants, tenantMembers, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getSubscriptionInvoiceEmailHtml } from "@/lib/email/templates/subscription-invoice";
import { generateAndStoreSubscriptionInvoicePdf } from "./subscription-service";

/**
 * Generate a subscription invoice PDF, store it, and email it to the store owner.
 *
 * This function is designed to be non-blocking — it catches all errors internally
 * and should never cause a payment webhook to fail.
 */
export async function sendSubscriptionInvoice(params: {
  invoiceId: string;
  tenantId: string;
  paymentMethod: string;
  transactionId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Generate and store the PDF
    const pdfResult = await generateAndStoreSubscriptionInvoicePdf(
      params.invoiceId,
      params.tenantId,
      {
        paymentMethod: params.paymentMethod,
        transactionId: params.transactionId,
      }
    );

    if (!pdfResult.success) {
      console.error(
        "[sendSubscriptionInvoice] PDF generation failed:",
        pdfResult.error
      );
      // Continue — we can still send an email without the PDF link
    }

    // 2. Get the invoice for email data
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, params.invoiceId),
        eq(invoices.tenantId, params.tenantId)
      ),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // 3. Get tenant info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, params.tenantId),
      columns: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // 4. Find the store owner's email
    const ownerMember = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, params.tenantId),
        eq(tenantMembers.role, "owner")
      ),
      columns: { userId: true },
    });

    let ownerEmail = "";
    let ownerName = "Store Owner";

    if (ownerMember) {
      const ownerUser = await db.query.user.findFirst({
        where: eq(user.id, ownerMember.userId),
        columns: { name: true, email: true },
      });
      if (ownerUser) {
        ownerEmail = ownerUser.email;
        ownerName = ownerUser.name || "Store Owner";
      }
    }

    // Fallback to invoice billing email or tenant contact
    if (!ownerEmail) {
      ownerEmail = invoice.billingEmail || "";
    }

    if (!ownerEmail) {
      console.warn(
        "[sendSubscriptionInvoice] No email address found for tenant:",
        params.tenantId
      );
      return { success: false, error: "No recipient email found" };
    }

    // 5. Determine plan name from invoice items
    const items = invoice.items as Array<{ description?: string }> | null;
    const planName = items?.[0]?.description || "Kaka Malem Pro Subscription";

    // 6. Format the amount
    const total = parseFloat(invoice.total);
    const formattedAmount =
      invoice.currency === "USD"
        ? `$${total.toFixed(2)}`
        : total.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });

    // 7. Build email HTML
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const html = getSubscriptionInvoiceEmailHtml({
      ownerName,
      storeName: tenant.name,
      storeSlug: tenant.slug,
      invoiceNumber: invoice.invoiceNumber,
      planName,
      periodStart: invoice.periodStart || invoice.createdAt,
      periodEnd:
        invoice.periodEnd ||
        new Date(
          new Date(invoice.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      amount: formattedAmount,
      currency: invoice.currency,
      paymentMethod: params.paymentMethod,
      pdfUrl: pdfResult.pdfUrl || "",
      baseUrl,
    });

    // 8. Send email
    await sendEmail({
      to: ownerEmail,
      subject: `Payment Confirmed - Invoice ${invoice.invoiceNumber}`,
      html,
    });

    // 9. Update invoice sentAt if not already set
    if (!invoice.sentAt) {
      await db
        .update(invoices)
        .set({ sentAt: new Date().toISOString() })
        .where(eq(invoices.id, params.invoiceId));
    }

    console.log(
      `[sendSubscriptionInvoice] Invoice ${invoice.invoiceNumber} sent to ${ownerEmail}`
    );

    return { success: true };
  } catch (error) {
    console.error("[sendSubscriptionInvoice] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invoice",
    };
  }
}
