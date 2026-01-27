import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// =============================================================================
// MARK ALL NOTIFICATIONS AS READ API ROUTE
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    // Build where clause
    const whereClause = tenantId
      ? and(
          eq(notifications.userId, session.user.id),
          eq(notifications.tenantId, tenantId),
          isNull(notifications.readAt)
        )
      : and(
          eq(notifications.userId, session.user.id),
          isNull(notifications.readAt)
        );

    // Mark all unread notifications as read
    await db
      .update(notifications)
      .set({
        readAt: new Date().toISOString(),
      })
      .where(whereClause);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark all read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
