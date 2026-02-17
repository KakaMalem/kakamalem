import { renderToBuffer } from "@react-pdf/renderer";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, tenants, tenantMembers, user } from "@/lib/db/schema";
import {
  SubscriptionInvoiceDocument,
  type SubscriptionInvoiceData,
} from "./subscription-template";

const STORAGE_ROOT = process.env.STORAGE_PATH || "/var/www/kakamalem-uploads";
const PUBLIC_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || "/uploads";

/**
 * Build subscription invoice data from the database
 */
export async function getSubscriptionInvoiceData(
  invoiceId: string,
  tenantId: string
): Promise<SubscriptionInvoiceData | null> {
  // Get the invoice
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
  });

  if (!invoice) return null;

  // Get tenant info
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
    },
  });

  if (!tenant) return null;

  // Use invoice billing fields if available, otherwise look up the store owner
  let buyerName = invoice.billingName || "";
  let buyerEmail = invoice.billingEmail || "";
  const buyerPhone = invoice.billingPhone || "";

  if (!buyerName) {
    // Look up the store owner
    const ownerMember = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.role, "owner")
      ),
      columns: { userId: true },
    });

    if (ownerMember) {
      const ownerUser = await db.query.user.findFirst({
        where: eq(user.id, ownerMember.userId),
        columns: { name: true, email: true },
      });

      if (ownerUser) {
        buyerName = ownerUser.name || "Store Owner";
        buyerEmail = buyerEmail || ownerUser.email;
      }
    }
  }

  // Parse items from JSONB
  const items = (invoice.items as Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }> | null) || [
    {
      description: "Kaka Malem Pro Subscription",
      quantity: 1,
      unitPrice: parseFloat(invoice.total),
      total: parseFloat(invoice.total),
    },
  ];

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.createdAt,
    periodStart: invoice.periodStart || invoice.createdAt,
    periodEnd:
      invoice.periodEnd ||
      new Date(
        new Date(invoice.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    status: invoice.status,
    buyer: {
      name: buyerName || "Store Owner",
      email: buyerEmail || undefined,
      phone: buyerPhone || undefined,
      storeName: tenant.name,
    },
    items,
    subtotal: parseFloat(invoice.subtotal),
    tax: parseFloat(invoice.tax),
    total: parseFloat(invoice.total),
    paidAmount: parseFloat(invoice.paidAmount || "0"),
    currency: invoice.currency,
    paidAt: invoice.paidAt || undefined,
  };
}

/**
 * Generate subscription invoice PDF buffer
 */
export async function generateSubscriptionInvoicePdf(
  data: SubscriptionInvoiceData
): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(
    <SubscriptionInvoiceDocument data={data} />
  );
  return Buffer.from(pdfBuffer);
}

/**
 * Generate a subscription invoice PDF, store it on disk, and update the invoice record.
 */
export async function generateAndStoreSubscriptionInvoicePdf(
  invoiceId: string,
  tenantId: string,
  extra?: {
    paymentMethod?: string;
    transactionId?: string;
  }
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
  try {
    const data = await getSubscriptionInvoiceData(invoiceId, tenantId);
    if (!data) {
      return { success: false, error: "Invoice data not found" };
    }

    // Merge payment method/transactionId if provided
    if (extra?.paymentMethod) data.paymentMethod = extra.paymentMethod;
    if (extra?.transactionId) data.transactionId = extra.transactionId;

    // Generate PDF
    const pdfBuffer = await generateSubscriptionInvoicePdf(data);

    // Write to filesystem
    const relativeDir = join("tenants", tenantId, "invoices");
    const absoluteDir = join(STORAGE_ROOT, relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const filename = `${invoiceId}.pdf`;
    const absolutePath = join(absoluteDir, filename);
    await writeFile(absolutePath, pdfBuffer);

    // Build the public URL
    const pdfUrl = `${PUBLIC_URL}/${relativeDir.replace(/\\/g, "/")}/${filename}`;

    // Update the invoice record
    await db
      .update(invoices)
      .set({ pdfUrl, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, invoiceId));

    return { success: true, pdfUrl };
  } catch (error) {
    console.error("[generateAndStoreSubscriptionInvoicePdf] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "PDF generation failed",
    };
  }
}
