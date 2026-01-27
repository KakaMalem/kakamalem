import { NextRequest, NextResponse } from "next/server";
import {
  getOrderFromToken,
  getOrderForInvoice,
  generateInvoicePdf,
} from "@/lib/invoice";

// =============================================================================
// PUBLIC INVOICE PDF DOWNLOAD
// =============================================================================
// GET: Download invoice PDF via shareable token (no auth required)
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token and get order info
    const tokenData = await getOrderFromToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid or expired invoice link" },
        { status: 404 }
      );
    }

    // Get invoice data
    const invoiceData = await getOrderForInvoice(
      tokenData.orderId,
      tokenData.tenantId
    );
    if (!invoiceData) {
      return NextResponse.json(
        { error: "Failed to generate invoice" },
        { status: 500 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    // Return PDF - ArrayBuffer is a valid BodyInit
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceData.order.orderNumber}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Public invoice download error:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
