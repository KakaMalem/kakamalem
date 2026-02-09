"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  pushSubscriptions,
  tenantMembers,
  customerNotificationPreferences,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// PUSH NOTIFICATION SERVER ACTIONS
// =============================================================================
// Server-side actions for managing push notification subscriptions
// =============================================================================

export type PushSubscriptionResult = {
  success: boolean;
  error?: string;
};

/**
 * Get push notification status for a tenant
 */
export async function getPushNotificationStatus(
  tenantId: string
): Promise<{ enabled: boolean; deviceCount: number }> {
  const user = await getUser();
  if (!user) {
    return { enabled: false, deviceCount: 0 };
  }

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.userId, user.id),
      eq(pushSubscriptions.isActive, true)
    ),
    columns: { id: true },
  });

  return {
    enabled: subscriptions.length > 0,
    deviceCount: subscriptions.length,
  };
}

/**
 * Disable push notifications for a tenant (all devices)
 */
export async function disablePushNotifications(
  tenantId: string,
  storeSlug: string
): Promise<PushSubscriptionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await db
      .update(pushSubscriptions)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.userId, user.id)
        )
      );

    revalidatePath(`/dashboard/${storeSlug}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Failed to disable push notifications:", error);
    return { success: false, error: "Failed to disable notifications" };
  }
}

/**
 * Disable push notifications for a specific device by subscription ID
 */
export async function disablePushNotificationsForDevice(
  tenantId: string,
  subscriptionId: string
): Promise<PushSubscriptionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify the subscription belongs to this user and tenant
    const subscription = await db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.tenantId, tenantId),
        eq(pushSubscriptions.userId, user.id)
      ),
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    await db
      .update(pushSubscriptions)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pushSubscriptions.id, subscriptionId));

    return { success: true };
  } catch (error) {
    console.error("Failed to disable device notifications:", error);
    return { success: false, error: "Failed to disable device" };
  }
}

/**
 * Check if user can receive notifications for a tenant
 * (must be owner or admin)
 */
export async function canReceiveNotifications(
  tenantId: string
): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, user.id)
    ),
    columns: { role: true },
  });

  return !!membership && ["owner", "admin"].includes(membership.role);
}

// =============================================================================
// CUSTOMER PUSH NOTIFICATION ACTIONS
// =============================================================================
// For customers subscribing to order updates at checkout
// =============================================================================

export type CustomerPushSubscriptionInput = {
  tenantId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

/**
 * Save push subscription for a customer at checkout
 * Works for both logged-in users and guests (requires userId)
 */
export async function saveCustomerPushSubscription(
  input: CustomerPushSubscriptionInput
): Promise<PushSubscriptionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Check if subscription already exists for this endpoint + user + tenant
    const existing = await db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.endpoint, input.endpoint),
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.tenantId, input.tenantId)
      ),
    });

    if (existing) {
      // Update existing subscription (might have new keys)
      await db
        .update(pushSubscriptions)
        .set({
          p256dh: input.p256dh,
          auth: input.auth,
          isActive: true,
          userAgent: input.userAgent,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.id, existing.id));
    } else {
      // Create new subscription
      await db.insert(pushSubscriptions).values({
        tenantId: input.tenantId,
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
        isActive: true,
      });
    }

    // Also create/update customer notification preferences
    const existingPrefs =
      await db.query.customerNotificationPreferences.findFirst({
        where: and(
          eq(customerNotificationPreferences.userId, user.id),
          eq(customerNotificationPreferences.tenantId, input.tenantId)
        ),
      });

    if (!existingPrefs) {
      await db.insert(customerNotificationPreferences).values({
        userId: user.id,
        tenantId: input.tenantId,
        orderUpdatesPush: true,
        orderUpdatesEmail: true,
        orderUpdatesSms: false,
        promotionalPush: false,
        promotionalEmail: false,
        backInStockEnabled: true,
        priceDropEnabled: true,
      });
    } else if (!existingPrefs.orderUpdatesPush) {
      // Enable push if they're subscribing
      await db
        .update(customerNotificationPreferences)
        .set({
          orderUpdatesPush: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(customerNotificationPreferences.id, existingPrefs.id));
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to save customer push subscription:", error);
    return { success: false, error: "Failed to save notification settings" };
  }
}

/**
 * Check if customer has push notifications enabled for a store
 */
export async function getCustomerPushStatus(
  tenantId: string
): Promise<{ hasSubscription: boolean; pushEnabled: boolean }> {
  const user = await getUser();
  if (!user) {
    return { hasSubscription: false, pushEnabled: false };
  }

  const [subscription, prefs] = await Promise.all([
    db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.tenantId, tenantId),
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.isActive, true)
      ),
      columns: { id: true },
    }),
    db.query.customerNotificationPreferences.findFirst({
      where: and(
        eq(customerNotificationPreferences.tenantId, tenantId),
        eq(customerNotificationPreferences.userId, user.id)
      ),
      columns: { orderUpdatesPush: true },
    }),
  ]);

  return {
    hasSubscription: !!subscription,
    pushEnabled: prefs?.orderUpdatesPush ?? true,
  };
}

/**
 * Disable customer push notifications for a store
 */
export async function disableCustomerPushNotifications(
  tenantId: string
): Promise<PushSubscriptionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Deactivate all push subscriptions for this user+tenant
    await db
      .update(pushSubscriptions)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.userId, user.id)
        )
      );

    // Update preferences
    await db
      .update(customerNotificationPreferences)
      .set({
        orderUpdatesPush: false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(customerNotificationPreferences.tenantId, tenantId),
          eq(customerNotificationPreferences.userId, user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to disable customer push notifications:", error);
    return { success: false, error: "Failed to update notification settings" };
  }
}
