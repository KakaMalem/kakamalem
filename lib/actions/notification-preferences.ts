"use server";

import { db } from "@/lib/db";
import {
  userNotificationPreferences,
  storeNotificationPreferences,
  pushSubscriptions,
  tenantMembers,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/server";
import {
  updateGlobalPreferencesSchema,
  updateStorePreferencesSchema,
  removeDeviceSchema,
  type UpdateGlobalPreferencesInput,
  type UpdateStorePreferencesInput,
  type RemoveDeviceInput,
} from "@/lib/validations/notification-preferences";
import { parseDeviceName } from "@/lib/utils/device";

// =============================================================================
// TYPES
// =============================================================================

export type DeviceInfo = {
  endpoint: string;
  deviceName: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
  subscriptionIds: string[];
};

export type GlobalPreferences = {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
};

export type StorePreferences = {
  tenantId: string;
  notificationsEnabled: boolean;
  eventPreferences: Record<
    string,
    { inApp?: boolean; push?: boolean; email?: boolean }
  >;
};

export type NotificationPreferencesData = {
  global: GlobalPreferences;
  stores: Record<string, StorePreferences>;
  devices: DeviceInfo[];
};

// =============================================================================
// GET PREFERENCES
// =============================================================================

const GLOBAL_DEFAULTS: GlobalPreferences = {
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "Asia/Kabul",
  inAppEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
};

export async function getNotificationPreferences(): Promise<NotificationPreferencesData> {
  const user = await requireAuth();

  const [globalRow, storeRows, deviceRows] = await Promise.all([
    db.query.userNotificationPreferences.findFirst({
      where: eq(userNotificationPreferences.userId, user.id),
    }),
    db.query.storeNotificationPreferences.findMany({
      where: eq(storeNotificationPreferences.userId, user.id),
    }),
    db.query.pushSubscriptions.findMany({
      where: and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.isActive, true)
      ),
    }),
  ]);

  // Global preferences (use defaults if no row exists)
  const global: GlobalPreferences = globalRow
    ? {
        quietHoursEnabled: globalRow.quietHoursEnabled,
        quietHoursStart: globalRow.quietHoursStart,
        quietHoursEnd: globalRow.quietHoursEnd,
        timezone: globalRow.timezone,
        inAppEnabled: globalRow.inAppEnabled,
        pushEnabled: globalRow.pushEnabled,
        emailEnabled: globalRow.emailEnabled,
        smsEnabled: globalRow.smsEnabled,
      }
    : GLOBAL_DEFAULTS;

  // Store preferences indexed by tenantId
  const stores: Record<string, StorePreferences> = {};
  for (const row of storeRows) {
    stores[row.tenantId] = {
      tenantId: row.tenantId,
      notificationsEnabled: row.notificationsEnabled,
      eventPreferences:
        (row.eventPreferences as Record<
          string,
          { inApp?: boolean; push?: boolean; email?: boolean }
        >) || {},
    };
  }

  // Devices grouped by endpoint (same browser = one device even if multi-tenant rows)
  const deviceMap = new Map<string, DeviceInfo>();
  for (const sub of deviceRows) {
    const existing = deviceMap.get(sub.endpoint);
    if (existing) {
      existing.subscriptionIds.push(sub.id);
      // Use the most recent lastUsedAt
      if (
        sub.lastUsedAt &&
        (!existing.lastUsedAt || sub.lastUsedAt > existing.lastUsedAt)
      ) {
        existing.lastUsedAt = sub.lastUsedAt;
      }
    } else {
      deviceMap.set(sub.endpoint, {
        endpoint: sub.endpoint,
        deviceName: sub.deviceName || parseDeviceName(sub.userAgent),
        lastUsedAt: sub.lastUsedAt,
        createdAt: sub.createdAt,
        isActive: sub.isActive ?? true,
        subscriptionIds: [sub.id],
      });
    }
  }

  return {
    global,
    stores,
    devices: Array.from(deviceMap.values()),
  };
}

// =============================================================================
// UPDATE GLOBAL PREFERENCES
// =============================================================================

export async function updateGlobalPreferences(
  input: UpdateGlobalPreferencesInput
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  const parsed = updateGlobalPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  // Check if row exists
  const existing = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, user.id),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(userNotificationPreferences)
      .set({
        quietHoursEnabled: data.quietHoursEnabled,
        quietHoursStart: data.quietHoursStart ?? null,
        quietHoursEnd: data.quietHoursEnd ?? null,
        timezone: data.timezone,
        inAppEnabled: data.inAppEnabled,
        pushEnabled: data.pushEnabled,
        updatedAt: now,
      })
      .where(eq(userNotificationPreferences.id, existing.id));
  } else {
    await db.insert(userNotificationPreferences).values({
      userId: user.id,
      quietHoursEnabled: data.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart ?? null,
      quietHoursEnd: data.quietHoursEnd ?? null,
      timezone: data.timezone || "Asia/Kabul",
      inAppEnabled: data.inAppEnabled,
      pushEnabled: data.pushEnabled,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

// =============================================================================
// UPDATE STORE PREFERENCES
// =============================================================================

export async function updateStorePreferences(
  input: UpdateStorePreferencesInput
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  const parsed = updateStorePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const data = parsed.data;

  // Verify user is a member of this store
  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.userId, user.id),
      eq(tenantMembers.tenantId, data.tenantId)
    ),
    columns: { id: true },
  });

  if (!membership) {
    return { success: false, error: "Not a member of this store" };
  }

  const now = new Date().toISOString();

  // Check if row exists
  const existing = await db.query.storeNotificationPreferences.findFirst({
    where: and(
      eq(storeNotificationPreferences.userId, user.id),
      eq(storeNotificationPreferences.tenantId, data.tenantId)
    ),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(storeNotificationPreferences)
      .set({
        notificationsEnabled: data.notificationsEnabled,
        eventPreferences: data.eventPreferences || {},
        updatedAt: now,
      })
      .where(eq(storeNotificationPreferences.id, existing.id));
  } else {
    await db.insert(storeNotificationPreferences).values({
      userId: user.id,
      tenantId: data.tenantId,
      notificationsEnabled: data.notificationsEnabled,
      eventPreferences: data.eventPreferences || {},
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

// =============================================================================
// REMOVE DEVICE
// =============================================================================

export async function removeDevice(
  input: RemoveDeviceInput
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  const parsed = removeDeviceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  // Deactivate all subscription rows for this endpoint + user
  const subs = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.userId, user.id),
      eq(pushSubscriptions.endpoint, parsed.data.endpoint)
    ),
    columns: { id: true },
  });

  if (subs.length === 0) {
    return { success: false, error: "Device not found" };
  }

  await db
    .update(pushSubscriptions)
    .set({
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
    .where(
      inArray(
        pushSubscriptions.id,
        subs.map((s) => s.id)
      )
    );

  return { success: true };
}
