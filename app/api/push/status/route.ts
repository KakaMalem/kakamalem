import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// PUSH SUBSCRIPTION STATUS API ROUTE
// =============================================================================
// Returns the push notification subscription status for a tenant
// Now includes current device detection for accurate UI state
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const currentEndpoint = searchParams.get("endpoint"); // Current device's push endpoint

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    // Get all active subscriptions for this user and tenant
    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: and(
        eq(pushSubscriptions.tenantId, tenantId),
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.isActive, true)
      ),
      columns: {
        id: true,
        endpoint: true,
        deviceName: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    // Determine if the current device is subscribed
    let currentDeviceSubscribed = false;
    const devices = subscriptions.map((sub) => {
      const isCurrent = currentEndpoint
        ? sub.endpoint === currentEndpoint
        : false;
      if (isCurrent) {
        currentDeviceSubscribed = true;
      }
      return {
        id: sub.id,
        deviceName: sub.deviceName,
        lastUsedAt: sub.lastUsedAt,
        createdAt: sub.createdAt,
        isCurrent,
      };
    });

    return NextResponse.json({
      // True only if THIS device is subscribed (for toggle state)
      currentDeviceEnabled: currentDeviceSubscribed,
      // True if ANY device is subscribed (for general status)
      anyDeviceEnabled: subscriptions.length > 0,
      // Total number of subscribed devices
      totalDevices: subscriptions.length,
      // List of all devices with current indicator
      devices,
      // Legacy field for backwards compatibility
      enabled: subscriptions.length > 0,
      subscriptions: devices,
    });
  } catch (error) {
    console.error("Push status error:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
