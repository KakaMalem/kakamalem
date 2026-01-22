"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pushSubscriptions, tenantMembers } from "@/lib/db/schema";
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
