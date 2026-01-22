import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions, tenantMembers } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

// Initialize web-push with VAPID keys
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:kakamalem.team@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// =============================================================================
// TYPES
// =============================================================================

export type PushNotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  orderId?: string;
  tenantSlug?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
};

export type SendNotificationResult = {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
};

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Send push notification to all owners/admins of a tenant
 * Used for order alerts
 */
export async function sendOrderNotificationToTenant(
  tenantId: string,
  tenantSlug: string,
  payload: {
    orderNumber: string;
    orderId: string;
    customerName: string;
    total: string;
    currency: string;
    isOffline?: boolean;
  }
): Promise<SendNotificationResult> {
  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get all users with owner/admin role for this tenant
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin"])
    ),
    columns: { userId: true },
  });

  if (eligibleMembers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const userIds = eligibleMembers.map((m) => m.userId);

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const orderType = payload.isOffline ? "Offline Sale" : "New Order";
  const notificationPayload: PushNotificationPayload = {
    title: `${orderType}: ${payload.orderNumber}`,
    body: `${payload.customerName} - ${payload.total} ${payload.currency}`,
    tag: `order-${payload.orderId}`,
    url: `/dashboard/${tenantSlug}/orders/${payload.orderId}`,
    orderId: payload.orderId,
    tenantSlug,
    requireInteraction: true,
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

/**
 * Send push notification to specific subscriptions
 */
async function sendPushNotifications(
  subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  payload: PushNotificationPayload
): Promise<SendNotificationResult> {
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          }
        );

        // Update last used timestamp
        await db
          .update(pushSubscriptions)
          .set({
            lastUsedAt: new Date().toISOString(),
            failCount: 0,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(pushSubscriptions.id, sub.id));

        return { success: true, id: sub.id };
      } catch (error) {
        // Handle subscription expiration/unsubscription
        if (error instanceof webpush.WebPushError) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            // Subscription no longer valid - deactivate
            await db
              .update(pushSubscriptions)
              .set({
                isActive: false,
                failedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(pushSubscriptions.id, sub.id));
          } else {
            // Other error - increment fail count
            await db
              .update(pushSubscriptions)
              .set({
                failCount: sql`${pushSubscriptions.failCount} + 1`,
                failedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(pushSubscriptions.id, sub.id));
          }
        }
        throw error;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message || "Unknown error");

  return {
    success: failed === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Check if web push is configured
 */
export function isPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  );
}
