import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  userNotificationPreferences,
  storeNotificationPreferences,
  tenantMembers,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// =============================================================================
// NOTIFICATION PREFERENCES API ROUTE
// =============================================================================

interface EventPreference {
  push: boolean;
  inApp: boolean;
}

interface GlobalPrefsInput {
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface StorePrefsInput {
  storeId: string;
  notificationsEnabled: boolean;
  eventPreferences: Record<string, EventPreference>;
}

// GET: Fetch user's notification preferences
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get global preferences
    const globalPrefs = await db.query.userNotificationPreferences.findFirst({
      where: eq(userNotificationPreferences.userId, session.user.id),
    });

    // Get user's stores
    const memberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, session.user.id),
      columns: { tenantId: true },
    });

    const tenantIds = memberships.map((m) => m.tenantId);

    // Get store-specific preferences
    let storePrefs: Array<{
      storeId: string;
      notificationsEnabled: boolean;
      eventPreferences: Record<string, EventPreference>;
    }> = [];

    if (tenantIds.length > 0) {
      const prefs = await db.query.storeNotificationPreferences.findMany({
        where: and(
          eq(storeNotificationPreferences.userId, session.user.id),
          inArray(storeNotificationPreferences.tenantId, tenantIds)
        ),
      });

      storePrefs = prefs.map((p) => ({
        storeId: p.tenantId,
        notificationsEnabled: p.notificationsEnabled,
        eventPreferences:
          (p.eventPreferences as Record<string, EventPreference>) ?? {},
      }));
    }

    return NextResponse.json({
      global: globalPrefs
        ? {
            pushEnabled: globalPrefs.pushEnabled,
            emailEnabled: globalPrefs.emailEnabled,
            quietHoursEnabled: globalPrefs.quietHoursEnabled,
            quietHoursStart: globalPrefs.quietHoursStart,
            quietHoursEnd: globalPrefs.quietHoursEnd,
          }
        : {
            pushEnabled: true,
            emailEnabled: true,
            quietHoursEnabled: false,
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00",
          },
      stores: storePrefs,
    });
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// POST: Save user's notification preferences
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { global, stores } = body as {
      global?: GlobalPrefsInput;
      stores?: StorePrefsInput[];
    };

    // Upsert global preferences
    if (global) {
      const existing = await db.query.userNotificationPreferences.findFirst({
        where: eq(userNotificationPreferences.userId, session.user.id),
      });

      if (existing) {
        await db
          .update(userNotificationPreferences)
          .set({
            pushEnabled: global.pushEnabled,
            quietHoursEnabled: global.quietHoursEnabled,
            quietHoursStart: global.quietHoursStart,
            quietHoursEnd: global.quietHoursEnd,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userNotificationPreferences.userId, session.user.id));
      } else {
        await db.insert(userNotificationPreferences).values({
          userId: session.user.id,
          pushEnabled: global.pushEnabled,
          quietHoursEnabled: global.quietHoursEnabled,
          quietHoursStart: global.quietHoursStart,
          quietHoursEnd: global.quietHoursEnd,
        });
      }
    }

    // Upsert store-specific preferences
    if (stores && stores.length > 0) {
      for (const storePref of stores) {
        const existing = await db.query.storeNotificationPreferences.findFirst({
          where: and(
            eq(storeNotificationPreferences.userId, session.user.id),
            eq(storeNotificationPreferences.tenantId, storePref.storeId)
          ),
        });

        if (existing) {
          await db
            .update(storeNotificationPreferences)
            .set({
              notificationsEnabled: storePref.notificationsEnabled,
              eventPreferences: storePref.eventPreferences,
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(storeNotificationPreferences.userId, session.user.id),
                eq(storeNotificationPreferences.tenantId, storePref.storeId)
              )
            );
        } else {
          await db.insert(storeNotificationPreferences).values({
            userId: session.user.id,
            tenantId: storePref.storeId,
            notificationsEnabled: storePref.notificationsEnabled,
            eventPreferences: storePref.eventPreferences,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save preferences:", error);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
