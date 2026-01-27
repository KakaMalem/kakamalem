import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { orders, tenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrderForInvoice, generateInvoicePdf } from "@/lib/invoice";

// =============================================================================
// CUSTOMER INVOICE DOWNLOAD API
// =============================================================================
// GET: Download invoice PDF for customer's own order
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    // Require authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Verify user owns this order
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.tenantId, tenant.id),
        eq(orders.userId, session.user.id)
      ),
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
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
