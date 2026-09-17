import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

import { verifyApiKey } from "@/lib/integrations/verify-api-key";
import { checkRateLimit } from "@/lib/integrations/api-middleware";
import { formatRecipientName, hasMapLocation } from "@/lib/geo/address";

/**
 * GET /api/v1/integrations/autods/[tenantId]/orders
 * AutoDS pulls new orders for fulfillment
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "GET /orders");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also fetch the tenant currency
  const storeSettings = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { currency: true },
  });
  const storeCurrency = storeSettings?.currency || "USD";

  try {
    // Fetch orders that are:
    // 1. In 'confirmed' status (ready to fulfill)
    // 2. Have atleast one item from AutoDS/AliExpress source
    // 3. Not yet fulfilled by an external service (we might need a flag for this)

    const confirmedOrders = await db.query.orders.findMany({
      where: and(eq(orders.tenantId, tenantId), eq(orders.status, "confirmed")),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      limit: 50,
    });

    // Map to AutoDS expected format
    const formattedOrders = confirmedOrders.map((order) => ({
      id: order.id,
      order_number: order.orderNumber,
      status: order.status,
      created_at: order.createdAt,
      total: order.total,
      currency: storeCurrency,
      customer_name:
        order.customerSnapshot?.name ||
        formatRecipientName(order.shippingAddress) ||
        "Customer",
      customer_email: order.customerSnapshot?.email,
      customer_phone: order.customerSnapshot?.phone,
      // Stores using the standard form have a real postal address; GPS stores
      // only have a pin, where the delivery notes are the best street line.
      shipping_address: {
        address1:
          order.shippingAddress?.addressLine1 ||
          order.shippingAddress?.notes ||
          "Refer to GPS",
        address2: order.shippingAddress?.addressLine2 || undefined,
        city: order.shippingAddress?.city || "Kabul",
        province: order.shippingAddress?.province || undefined,
        zip: order.shippingAddress?.postalCode || "1001",
        country: order.shippingAddress?.country || "AF",
        latitude: hasMapLocation(order.shippingAddress)
          ? order.shippingAddress?.latitude
          : undefined,
        longitude: hasMapLocation(order.shippingAddress)
          ? order.shippingAddress?.longitude
          : undefined,
      },
      items: order.items.map((item) => ({
        id: item.id,
        product_id: item.productId,
        external_id: item.product?.sourceId, // This is what AutoDS needs
        sku: item.product?.sku,
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        variant_id: item.variantId,
      })),
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("AutoDS Order Pull Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
