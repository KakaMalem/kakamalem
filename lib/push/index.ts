import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

// Lazy-init: configure web-push with VAPID keys on first use
let configured = false;

function ensureConfigured() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:kakamalem.team@gmail.com";

  if (!publicKey || !privateKey) {
    console.warn(
      "VAPID keys not configured — push notifications will be skipped"
    );
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Returns true if VAPID keys are configured (push can be sent).
 */
export function isVapidConfigured(): boolean {
  ensureConfigured();
  return configured;
}

export interface PushPayload {
  title: string;
  body: string;
  actionUrl?: string;
  type?: string;
}

/**
 * Send push notifications to all active subscriptions for the given user IDs.
 * Fire-and-forget — errors are handled internally (auto-deactivate expired subs).
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;

  ensureConfigured();
  if (!configured) return;

  // Get all active subscriptions for these users
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      failCount: pushSubscriptions.failCount,
    })
    .from(pushSubscriptions)
    .where(
      and(
        inArray(pushSubscriptions.userId, userIds),
        eq(pushSubscriptions.isActive, true)
      )
    );

  if (subs.length === 0) return;

  // Deduplicate by endpoint — same device may have rows for multiple tenants
  const uniqueByEndpoint = new Map<
    string,
    {
      ids: string[];
      endpoint: string;
      p256dh: string;
      auth: string;
      failCount: number;
    }
  >();
  for (const sub of subs) {
    const existing = uniqueByEndpoint.get(sub.endpoint);
    if (existing) {
      existing.ids.push(sub.id);
    } else {
      uniqueByEndpoint.set(sub.endpoint, {
        ids: [sub.id],
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        failCount: sub.failCount,
      });
    }
  }

  const uniqueSubs = Array.from(uniqueByEndpoint.values());
  console.log(
    `[Push] Sending to ${uniqueSubs.length} device(s) for ${userIds.length} user(s)`
  );

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    uniqueSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        );

        console.log(`[Push] ✓ Sent to ${sub.endpoint.slice(0, 60)}...`);
        // Success — update lastUsedAt, reset fail count for all rows with this endpoint
        await db
          .update(pushSubscriptions)
          .set({
            lastUsedAt: new Date().toISOString(),
            failCount: 0,
            failedAt: null,
          })
          .where(inArray(pushSubscriptions.id, sub.ids));
      } catch (error: unknown) {
        const statusCode =
          error instanceof webpush.WebPushError ? error.statusCode : 0;

        console.error(`[Push] ✗ Failed (status ${statusCode}):`, error);
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — deactivate all rows
          await db
            .update(pushSubscriptions)
            .set({ isActive: false, failedAt: new Date().toISOString() })
            .where(inArray(pushSubscriptions.id, sub.ids));
        } else {
          // Other error — increment fail count
          const newFailCount = sub.failCount + 1;
          await db
            .update(pushSubscriptions)
            .set({
              failCount: sql`${pushSubscriptions.failCount} + 1`,
              failedAt: new Date().toISOString(),
              ...(newFailCount >= 5 ? { isActive: false } : {}),
            })
            .where(inArray(pushSubscriptions.id, sub.ids));
        }
      }
    })
  );
}
