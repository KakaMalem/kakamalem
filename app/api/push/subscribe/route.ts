import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pushSubscriptions, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// =============================================================================
// PUSH SUBSCRIPTION API ROUTE
// =============================================================================
// Handles subscribing and unsubscribing from push notifications
// =============================================================================

const subscribeSchema = z.object({
  tenantId: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  deviceName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { tenantId, subscription, deviceName } = validation.data;

    // Verify user has owner/admin access to this tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, session.user.id)
      ),
      columns: { role: true },
    });

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Not authorized for this store" },
        { status: 403 }
      );
    }

    // Upsert subscription (update if endpoint exists, insert if not)
    const existing = await db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.endpoint, subscription.endpoint),
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.tenantId, tenantId)
      ),
      columns: { id: true },
    });

    const userAgent = request.headers.get("user-agent") || undefined;

    if (existing) {
      // Update existing subscription
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent,
          deviceName,
          isActive: true,
          failCount: 0,
          failedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.id, existing.id));

      return NextResponse.json({
        success: true,
        subscriptionId: existing.id,
        isNew: false,
      });
    }

    // Create new subscription
    const [newSub] = await db
      .insert(pushSubscriptions)
      .values({
        tenantId,
        userId: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        deviceName,
      })
      .returning({ id: pushSubscriptions.id });

    return NextResponse.json({
      success: true,
      subscriptionId: newSub.id,
      isNew: true,
    });
  } catch (error) {
    console.error("Push subscription error:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const endpoint = searchParams.get("endpoint");

    if (!tenantId || !endpoint) {
      return NextResponse.json(
        { error: "Missing tenantId or endpoint" },
        { status: 400 }
      );
    }

    // Deactivate subscription (soft delete)
    await db
      .update(pushSubscriptions)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
