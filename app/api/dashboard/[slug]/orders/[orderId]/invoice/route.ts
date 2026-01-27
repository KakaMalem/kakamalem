import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, tenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canManageStore } from "@/lib/auth/context";
import { getOrderForInvoice, generateInvoicePdf } from "@/lib/invoice";

// =============================================================================
// DASHBOARD INVOICE DOWNLOAD API
// =============================================================================
// GET: Download invoice PDF for any order (store owner/admin)
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Verify user can manage this store
    const canManage = await canManageStore(tenant.id);
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify order exists for this tenant
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)),
      columns: { id: true, orderNumber: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Generate invoice PDF
    const invoiceData = await getOrderForInvoice(orderId, tenant.id);
    if (!invoiceData) {
      return NextResponse.json(
        { error: "Failed to generate invoice" },
        { status: 500 }
      );
    }

    const pdfBuffer = await generateInvoicePdf(invoiceData);

    // Return PDF - ArrayBuffer is a valid BodyInit
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${order.orderNumber}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Invoice download error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate invoice", details: errorMessage },
      { status: 500 }
    );
  }
}
