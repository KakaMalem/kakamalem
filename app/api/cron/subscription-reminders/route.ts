import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, tenantMembers, user } from "@/lib/db/schema";
import { eq, and, gte, lte, or, isNull, inArray, not } from "drizzle-orm";
import { sendSubscriptionRenewalReminder } from "@/lib/push";

/**
 * Subscription Reminders Cron Job
 *
 * Runs daily to send renewal reminders to Pro subscribers:
 * - 7 days before expiry
 * - 3 days before expiry
 * - 1 day before expiry (final notice)
 *
 * Also handles:
 * - Auto-resume paused subscriptions
 * - Expire past-due subscriptions
 *
 * Security: Requires CRON_SECRET authorization header
 *
 * Recommended schedule: Run every hour or daily at 9 AM
 * Example: 0 9 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://kakamalem.com/api/cron/subscription-reminders
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[SubReminders] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[SubReminders] Starting subscription reminders job...");

  const results = {
    reminders: { sent: 0, skipped: 0, failed: 0 },
    autoResume: { processed: 0 },
    expired: { processed: 0 },
    details: [] as Array<{
      tenantId: string;
      action: string;
      success: boolean;
    }>,
  };

  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // ==========================================================================
    // 1. RENEWAL REMINDERS
    // ==========================================================================
    // Find Pro subscriptions expiring in 7, 3, or 1 days
    const reminderDays = [7, 3, 1];

    for (const daysUntil of reminderDays) {
      // Calculate the target date range (within that day)
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysUntil);

      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find tenants with subscriptions expiring on this day
      const expiringTenants = await db.query.tenants.findMany({
        where: and(
          eq(tenants.subscriptionPlan, "pro"),
          eq(tenants.subscriptionStatus, "active"),
          isNull(tenants.pausedAt), // Not paused
          gte(tenants.subscriptionEndsAt, startOfDay.toISOString()),
          lte(tenants.subscriptionEndsAt, endOfDay.toISOString()),
          // Avoid duplicate reminders
          or(
            isNull(tenants.lastReminderDaysBefore),
            not(eq(tenants.lastReminderDaysBefore, daysUntil))
          )
        ),
        columns: {
          id: true,
          slug: true,
          name: true,
          subscriptionEndsAt: true,
          lastReminderSentAt: true,
          lastReminderDaysBefore: true,
        },
      });

      console.log(
        `[SubReminders] Found ${expiringTenants.length} tenants expiring in ${daysUntil} days`
      );

      for (const tenant of expiringTenants) {
        try {
          // Get all owners/admins of this tenant
          const members = await db.query.tenantMembers.findMany({
            where: and(
              eq(tenantMembers.tenantId, tenant.id),
              inArray(tenantMembers.role, ["owner", "admin"])
            ),
            columns: { userId: true },
          });

          const userIds = members.map((m) => m.userId);

          if (userIds.length === 0) {
            results.reminders.skipped++;
            continue;
          }

          // Get user details for notification
          const users = await db.query.user.findMany({
            where: inArray(user.id, userIds),
            columns: { id: true, email: true, name: true },
          });

          // Send reminder to each owner/admin
          for (const user of users) {
            await sendSubscriptionRenewalReminder({
              userId: user.id,
              tenantId: tenant.id,
              storeName: tenant.name,
              storeSlug: tenant.slug,
              daysUntilExpiry: daysUntil,
              expiryDate: tenant.subscriptionEndsAt!,
            });
          }

          // Update reminder tracking to avoid duplicate sends
          await db
            .update(tenants)
            .set({
              lastReminderSentAt: nowIso,
              lastReminderDaysBefore: daysUntil,
              updatedAt: nowIso,
            })
            .where(eq(tenants.id, tenant.id));

          results.reminders.sent++;
          results.details.push({
            tenantId: tenant.id,
            action: `Sent ${daysUntil}-day reminder`,
            success: true,
          });
        } catch (error) {
          console.error(
            `[SubReminders] Error sending reminder for ${tenant.slug}:`,
            error
          );
          results.reminders.failed++;
          results.details.push({
            tenantId: tenant.id,
            action: `Failed ${daysUntil}-day reminder`,
            success: false,
          });
        }
      }
    }

    // ==========================================================================
    // 2. AUTO-RESUME PAUSED SUBSCRIPTIONS
    // ==========================================================================
    const pausedToResume = await db.query.tenants.findMany({
      where: and(
        eq(tenants.subscriptionPlan, "pro"),
        not(isNull(tenants.pausedAt)),
        not(isNull(tenants.autoResumeAt)),
        lte(tenants.autoResumeAt, nowIso)
      ),
      columns: {
        id: true,
        slug: true,
        pausedAt: true,
        pauseCreditsDays: true,
        subscriptionEndsAt: true,
      },
    });

    console.log(
      `[SubReminders] Found ${pausedToResume.length} paused subscriptions to auto-resume`
    );

    for (const tenant of pausedToResume) {
      try {
        // Calculate credits: days paused that should extend the subscription
        const pausedDate = new Date(tenant.pausedAt!);
        const daysPaused = Math.floor(
          (now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Extend subscription end date by days paused
        let newEndDate: Date;
        if (tenant.subscriptionEndsAt) {
          newEndDate = new Date(tenant.subscriptionEndsAt);
          newEndDate.setDate(newEndDate.getDate() + daysPaused);
        } else {
          // Edge case: no end date set, use 30 days from now
          newEndDate = new Date(now);
          newEndDate.setDate(newEndDate.getDate() + 30);
        }

        await db
          .update(tenants)
          .set({
            pausedAt: null,
            pauseReason: null,
            autoResumeAt: null,
            pauseCreditsDays: (tenant.pauseCreditsDays || 0) + daysPaused,
            subscriptionEndsAt: newEndDate.toISOString(),
            subscriptionStatus: "active",
            updatedAt: nowIso,
          })
          .where(eq(tenants.id, tenant.id));

        results.autoResume.processed++;
        results.details.push({
          tenantId: tenant.id,
          action: `Auto-resumed, added ${daysPaused} days credit`,
          success: true,
        });
      } catch (error) {
        console.error(
          `[SubReminders] Error auto-resuming ${tenant.slug}:`,
          error
        );
        results.details.push({
          tenantId: tenant.id,
          action: "Auto-resume failed",
          success: false,
        });
      }
    }

    // ==========================================================================
    // 3. EXPIRE PAST-DUE SUBSCRIPTIONS
    // ==========================================================================
    // Find subscriptions that have ended (give 1-day grace period)
    const gracePeriodDays = 1;
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - gracePeriodDays);

    const expiredSubscriptions = await db.query.tenants.findMany({
      where: and(
        eq(tenants.subscriptionPlan, "pro"),
        eq(tenants.subscriptionStatus, "active"),
        isNull(tenants.pausedAt),
        lte(tenants.subscriptionEndsAt, graceCutoff.toISOString())
      ),
      columns: {
        id: true,
        slug: true,
        subscriptionEndsAt: true,
      },
    });

    console.log(
      `[SubReminders] Found ${expiredSubscriptions.length} expired subscriptions`
    );

    for (const tenant of expiredSubscriptions) {
      try {
        await db
          .update(tenants)
          .set({
            subscriptionStatus: "expired",
            subscriptionNotes: `Expired on ${tenant.subscriptionEndsAt}. Previous status: active.`,
            updatedAt: nowIso,
          })
          .where(eq(tenants.id, tenant.id));

        results.expired.processed++;
        results.details.push({
          tenantId: tenant.id,
          action: "Marked as expired",
          success: true,
        });

        // TODO: Send expiration notification to owners
      } catch (error) {
        console.error(`[SubReminders] Error expiring ${tenant.slug}:`, error);
        results.details.push({
          tenantId: tenant.id,
          action: "Expiration failed",
          success: false,
        });
      }
    }

    console.log(
      `[SubReminders] Complete: ${results.reminders.sent} reminders sent, ` +
        `${results.autoResume.processed} auto-resumed, ${results.expired.processed} expired`
    );

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      ...results,
    });
  } catch (error) {
    console.error("[SubReminders] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: nowIso,
      },
      { status: 500 }
    );
  }
}
