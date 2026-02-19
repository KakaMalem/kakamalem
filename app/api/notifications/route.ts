import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications, tenants } from "@/lib/db/schema";
import { eq, and, isNull, isNotNull, inArray, desc, count } from "drizzle-orm";

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

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const context = searchParams.get("context") || "owner";
  const tenantId = searchParams.get("tenantId");
  const filter = searchParams.get("filter"); // "unread" | "read" | null
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  const typeFilter = context === "customer" ? CUSTOMER_TYPES : OWNER_TYPES;

  const conditions = [
    eq(notifications.userId, user.id),
    isNull(notifications.archivedAt),
    inArray(notifications.type, typeFilter),
  ];

  if (tenantId) {
    conditions.push(eq(notifications.tenantId, tenantId));
  }

  // Apply read/unread filter
  if (filter === "unread") {
    conditions.push(isNull(notifications.readAt));
  } else if (filter === "read") {
    conditions.push(isNotNull(notifications.readAt));
  }

  const whereClause = and(...conditions);

  // Build base conditions without the read filter for unread count
  const baseConditions = [
    eq(notifications.userId, user.id),
    isNull(notifications.archivedAt),
    inArray(notifications.type, typeFilter),
  ];
  if (tenantId) {
    baseConditions.push(eq(notifications.tenantId, tenantId));
  }

  const [items, [unreadResult], [totalResult]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        actionUrl: notifications.actionUrl,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        tenantName: tenants.name,
      })
      .from(notifications)
      .leftJoin(tenants, eq(notifications.tenantId, tenants.id))
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(...baseConditions, isNull(notifications.readAt))),
    db.select({ count: count() }).from(notifications).where(whereClause),
  ]);

  return NextResponse.json({
    notifications: items,
    unreadCount: unreadResult?.count ?? 0,
    pagination: {
      hasMore: offset + limit < (totalResult?.count ?? 0),
      total: totalResult?.count ?? 0,
    },
  });
}
