import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orders, orderEvents, shipments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifyApiKey } from "@/lib/integrations/verify-api-key";
import {
  checkRateLimit,
  validateBody,
} from "@/lib/integrations/api-middleware";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const TrackingSchema = z.object({
  tracking_number: z.string().min(1, "Tracking number is required"),
  carrier: z.string().optional(),
  tracking_url: z.string().url("Must be a valid URL").optional(),
});

/**
 * POST /api/v1/integrations/autods/[tenantId]/orders/:id/tracking
 * AutoDS provides tracking info for a fulfilled order
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; orderId: string }> }
) {
  const { tenantId, orderId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "POST /orders/:id/tracking");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await validateBody(req, TrackingSchema);
  if ("error" in parsed) return parsed.error;
  const { tracking_number, carrier = null, tracking_url = null } = parsed.data;

  try {
    // Update order status to 'shipped'
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "shipped",
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .returning();

    if (!updatedOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Insert tracking details as a new shipment record
    await db.insert(shipments).values({
      tenantId,
      orderId,
      carrierName: carrier ?? null,
      trackingNumber: tracking_number,
      trackingUrl: tracking_url ?? null,
      status: "in_transit" as const,
      shippedAt: new Date().toISOString(),
    });

    // Log the fulfillment event
    await db.insert(orderEvents).values({
      tenantId,
      orderId,
      eventType: "order.fulfilled",
      eventCategory: "fulfillment",
      actorType: "system",
      actorName: "AutoDS Integration",
      data: { tracking_number, carrier, tracking_url },
      occurredAt: new Date().toISOString(),
    });

    // Revalidate paths for dashboard and storefront
    revalidatePath(`/dashboard/[slug]/orders/${orderId}`, "page");
    revalidatePath(`/orders/${orderId}`, "page");

    return NextResponse.json({
      success: true,
      message: `Order marked as shipped. Tracking: ${tracking_number}`,
    });
  } catch (error) {
    console.error("AutoDS Tracking Update Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
