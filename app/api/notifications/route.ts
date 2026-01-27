import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications, tenants } from "@/lib/db/schema";
import { eq, and, isNull, isNotNull, desc, count, inArray } from "drizzle-orm";

// =============================================================================
// NOTIFICATIONS API ROUTE
// =============================================================================
// GET: List notifications for the current user
// =============================================================================

// Notification types by context - ensures clean separation between owner and customer notifications
const OWNER_NOTIFICATION_TYPES = [
  "new_order",
  "order_cancelled", // Owner sees when orders are cancelled
  "low_stock",
  "new_review",
];

const CUSTOMER_NOTIFICATION_TYPES = [
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled", // Customer sees when their order is cancelled
  "back_in_stock",
];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const filter = searchParams.get("filter"); // "all" | "unread" | "read"
    const context = searchParams.get("context"); // "owner" | "customer" - filters notification types
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build base conditions
    const baseConditions = [
      eq(notifications.userId, session.user.id),
      isNull(notifications.archivedAt),
    ];

    // Add tenant filter if specified
    if (tenantId) {
      baseConditions.push(eq(notifications.tenantId, tenantId));
    }

    // Add context filter to separate owner and customer notifications
    if (context === "owner") {
      baseConditions.push(
        inArray(notifications.type, OWNER_NOTIFICATION_TYPES)
      );
    } else if (context === "customer") {
      baseConditions.push(
        inArray(notifications.type, CUSTOMER_NOTIFICATION_TYPES)
      );
    }

    // Add read/unread filter
    if (filter === "unread") {
      baseConditions.push(isNull(notifications.readAt));
    } else if (filter === "read") {
      baseConditions.push(isNotNull(notifications.readAt));
    }

    const whereClause = and(...baseConditions);

    // Fetch notifications
    const userNotifications = await db.query.notifications.findMany({
      where: whereClause,
      orderBy: desc(notifications.createdAt),
      limit,
      offset,
    });

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(whereClause);

    // Get unread count (always useful for badge)
    const unreadConditions = [
      eq(notifications.userId, session.user.id),
      isNull(notifications.readAt),
      isNull(notifications.archivedAt),
    ];
    if (tenantId) {
      unreadConditions.push(eq(notifications.tenantId, tenantId));
    }
    // Apply same context filter to unread count
    if (context === "owner") {
      unreadConditions.push(
        inArray(notifications.type, OWNER_NOTIFICATION_TYPES)
      );
    } else if (context === "customer") {
      unreadConditions.push(
        inArray(notifications.type, CUSTOMER_NOTIFICATION_TYPES)
      );
    }

    const [unreadResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...unreadConditions));

    // Get tenant names for the notifications
    const tenantIds = [
      ...new Set(
        userNotifications
          .map((n) => n.tenantId)
          .filter((id): id is string => id !== null)
      ),
    ];

    let tenantMap: Record<string, string> = {};
    if (tenantIds.length > 0) {
      const tenantData = await db.query.tenants.findMany({
        where: inArray(tenants.id, tenantIds),
        columns: { id: true, name: true },
      });
      tenantMap = Object.fromEntries(tenantData.map((t) => [t.id, t.name]));
    }

    // Enrich notifications with tenant names
    const enrichedNotifications = userNotifications.map((n) => ({
      ...n,
      tenantName: n.tenantId ? tenantMap[n.tenantId] || null : null,
    }));

    return NextResponse.json({
      notifications: enrichedNotifications,
      totalCount: totalResult?.count || 0,
      unreadCount: unreadResult?.count || 0,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < (totalResult?.count || 0),
      },
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
