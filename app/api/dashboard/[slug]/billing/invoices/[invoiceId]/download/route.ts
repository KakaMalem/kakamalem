import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, tenants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";

const STORAGE_ROOT = process.env.STORAGE_PATH || "/var/www/kakamalem-uploads";
const PUBLIC_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || "/uploads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; invoiceId: string }> }
) {
  try {
    const { slug, invoiceId } = await params;

    await requireAuth();

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check permission
    const hasAccess = await canManageStore(tenant.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get the invoice
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenant.id)),
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let pdfBuffer: Buffer;

    if (invoice.pdfUrl) {
      // PDF exists on disk — read it
      // Convert public URL to filesystem path
      const relativePath = invoice.pdfUrl.replace(PUBLIC_URL + "/", "");
      const absolutePath = join(STORAGE_ROOT, relativePath);

      try {
        pdfBuffer = await readFile(absolutePath);
      } catch {
        // File missing on disk — regenerate
        pdfBuffer = await generateOnTheFly(invoiceId, tenant.id);
      }
    } else {
      // No PDF stored yet (legacy invoice) — generate on-the-fly
      pdfBuffer = await generateOnTheFly(invoiceId, tenant.id);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Invoice Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download invoice" },
      { status: 500 }
    );
  }
}

async function generateOnTheFly(
  invoiceId: string,
  tenantId: string
): Promise<Buffer> {
  const {
    generateAndStoreSubscriptionInvoicePdf,
    getSubscriptionInvoiceData,
    generateSubscriptionInvoicePdf,
  } = await import("@/lib/invoice/subscription-service");

  // Try to generate and store for future downloads
  const storeResult = await generateAndStoreSubscriptionInvoicePdf(
    invoiceId,
    tenantId
  );

  if (storeResult.success && storeResult.pdfUrl) {
    // Read back from disk
    const relativePath = storeResult.pdfUrl.replace(PUBLIC_URL + "/", "");
    const absolutePath = join(STORAGE_ROOT, relativePath);
    return readFile(absolutePath);
  }

  // If storage failed, still return the PDF buffer directly
  const data = await getSubscriptionInvoiceData(invoiceId, tenantId);
  if (!data) {
    throw new Error("Invoice data not found");
  }
  return generateSubscriptionInvoicePdf(data);
}
