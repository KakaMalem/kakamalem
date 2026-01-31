import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// =============================================================================
// PUSH RESUBSCRIBE API ROUTE
// =============================================================================
// Handles automatic subscription refresh from service worker
// When Chrome refreshes a push subscription, the service worker calls this
// endpoint to update the stored subscription with new credentials
// =============================================================================

const resubscribeSchema = z.object({
  oldEndpoint: z.string().url().optional(),
  newSubscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = resubscribeSchema.safeParse(body);

    if (!validation.success) {
      console.error("Resubscribe validation failed:", validation.error.issues);
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { oldEndpoint, newSubscription } = validation.data;
    const userAgent = request.headers.get("user-agent") || undefined;

    // If we have an old endpoint, update all subscriptions with that endpoint
    if (oldEndpoint) {
      const existingSubscriptions = await db.query.pushSubscriptions.findMany({
        where: eq(pushSubscriptions.endpoint, oldEndpoint),
        columns: { id: true, userId: true, tenantId: true },
      });

      if (existingSubscriptions.length > 0) {
        // Update all subscriptions with the old endpoint to use the new one
        await db
          .update(pushSubscriptions)
          .set({
            endpoint: newSubscription.endpoint,
            p256dh: newSubscription.keys.p256dh,
            auth: newSubscription.keys.auth,
            userAgent,
            isActive: true,
            failCount: 0,
            failedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(pushSubscriptions.endpoint, oldEndpoint));

        console.log(
          `[Push Resubscribe] Updated ${existingSubscriptions.length} subscription(s) from old endpoint`
        );

        return NextResponse.json({
          success: true,
          updated: existingSubscriptions.length,
        });
      }
    }

    // If no old endpoint or no matching subscriptions found,
    // try to find subscriptions with the new endpoint and reactivate them
    const newEndpointSubs = await db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.endpoint, newSubscription.endpoint),
      columns: { id: true },
    });

    if (newEndpointSubs.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: newSubscription.keys.p256dh,
          auth: newSubscription.keys.auth,
          userAgent,
          isActive: true,
          failCount: 0,
          failedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.endpoint, newSubscription.endpoint));

      console.log(
        `[Push Resubscribe] Reactivated ${newEndpointSubs.length} subscription(s) with existing endpoint`
      );

      return NextResponse.json({
        success: true,
        updated: newEndpointSubs.length,
      });
    }

    // No matching subscriptions found - the user will need to re-subscribe
    // through the UI. This can happen if the subscription was deleted or
    // if this is a completely new browser/device.
    console.log(
      "[Push Resubscribe] No matching subscriptions found for endpoint"
    );

    return NextResponse.json({
      success: false,
      message:
        "No matching subscription found. Please re-enable notifications.",
      updated: 0,
    });
  } catch (error) {
    console.error("Push resubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
