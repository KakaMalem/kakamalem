import { db } from "@/lib/db";
import {
  userNotificationPreferences,
  storeNotificationPreferences,
  type StoreEventPreferences,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface PreferenceFilterResult {
  inAppUserIds: string[];
  pushUserIds: string[];
}

/**
 * Given a list of user IDs, a tenant ID, and a notification event type,
 * filter down to only those who should receive it on each channel.
 *
 * Adds exactly 2 DB queries (global prefs + store prefs), both indexed.
 * If no preference rows exist for a user, defaults apply (everything enabled).
 */
export async function filterByPreferences(
  userIds: string[],
  tenantId: string,
  eventType: string
): Promise<PreferenceFilterResult> {
  if (userIds.length === 0) return { inAppUserIds: [], pushUserIds: [] };

  // Batch fetch both preference types
  const [globalPrefs, storePrefs] = await Promise.all([
    db.query.userNotificationPreferences.findMany({
      where: inArray(userNotificationPreferences.userId, userIds),
    }),
    db.query.storeNotificationPreferences.findMany({
      where: and(
        inArray(storeNotificationPreferences.userId, userIds),
        eq(storeNotificationPreferences.tenantId, tenantId)
      ),
    }),
  ]);

  // Index by userId for O(1) lookup
  const globalMap = new Map(globalPrefs.map((p) => [p.userId, p]));
  const storeMap = new Map(storePrefs.map((p) => [p.userId, p]));

  const inAppUserIds: string[] = [];
  const pushUserIds: string[] = [];

  for (const userId of userIds) {
    const global = globalMap.get(userId);
    const store = storeMap.get(userId);

    // Store master switch: if explicitly disabled, skip everything
    if (store?.notificationsEnabled === false) continue;

    // Resolve per-event preferences (store overrides > global defaults)
    const eventPref = (store?.eventPreferences as StoreEventPreferences)?.[
      eventType as keyof StoreEventPreferences
    ];

    // In-app: event-level override → global default → true
    const inAppAllowed = eventPref?.inApp ?? global?.inAppEnabled ?? true;
    // Push: event-level override → global default → true
    const pushAllowed = eventPref?.push ?? global?.pushEnabled ?? true;

    // Quiet hours: suppress push only (in-app is always silent/queued)
    const isQuietHours =
      global?.quietHoursEnabled &&
      checkQuietHours(
        global.quietHoursStart,
        global.quietHoursEnd,
        global.timezone || "Asia/Kabul"
      );

    if (inAppAllowed) inAppUserIds.push(userId);
    if (pushAllowed && !isQuietHours) pushUserIds.push(userId);
  }

  return { inAppUserIds, pushUserIds };
}

function checkQuietHours(
  start: string | null,
  end: string | null,
  timezone: string
): boolean {
  if (!start || !end) return false;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now); // "HH:MM"

    // Handle overnight ranges (e.g., 22:00 - 08:00)
    if (start <= end) {
      return currentTime >= start && currentTime < end;
    } else {
      return currentTime >= start || currentTime < end;
    }
  } catch {
    return false;
  }
}
