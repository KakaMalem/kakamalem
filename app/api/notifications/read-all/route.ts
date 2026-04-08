import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications, tenantMembers } from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";

const OWNER_TYPES = [
  "new_order",
  "order_cancelled",
  "low_stock",
  "out_of_stock",
  "new_review",
  "payment_received",
  "refund_processed",
  "daily_summary",
  "store_transfer_request",
  "store_transfer_accepted",
  "store_transfer_rejected",
  "store_transfer_cancelled",
  "store_transfer_expired",
  "subscription_reminder",
  "subscription_expired",
  "subscription_paused",
  "subscription_resumed",
];

const CUSTOMER_TYPES = [
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "back_in_stock",
  "price_drop",
];

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get("tenantId");
  const context = searchParams.get("context") || "owner";

  const typeFilter = context === "customer" ? CUSTOMER_TYPES : OWNER_TYPES;

  const conditions = [
    eq(notifications.userId, user.id),
    isNull(notifications.readAt),
    inArray(notifications.type, typeFilter),
  ];

  if (tenantId) {
    if (context === "owner") {
      const membership = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.userId, user.id),
          eq(tenantMembers.tenantId, tenantId)
        ),
        columns: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    conditions.push(eq(notifications.tenantId, tenantId));
  }

  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(...conditions));

  return NextResponse.json({ success: true });
}
