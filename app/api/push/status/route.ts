import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// PUSH SUBSCRIPTION STATUS API ROUTE
// =============================================================================
// Returns the push notification subscription status for a tenant
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: and(
        eq(pushSubscriptions.tenantId, tenantId),
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.isActive, true)
      ),
      columns: {
        id: true,
        deviceName: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      enabled: subscriptions.length > 0,
      subscriptions,
    });
  } catch (error) {
    console.error("Push status error:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
