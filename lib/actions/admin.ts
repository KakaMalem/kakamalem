"use server";

import { db } from "@/lib/db";
import { tenants, platformSettings, adminAuditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { headers } from "next/headers";

// =============================================================================
// ADMIN SERVER ACTIONS
// =============================================================================
// Server actions for admin operations with audit logging
// =============================================================================

type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/**
 * Log an admin action to the audit log
 */
async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details?: Record<string, unknown>
) {
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0] ||
    headersList.get("x-real-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  await db.insert(adminAuditLog).values({
    adminId,
    action,
    targetType,
    targetId,
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Update store status (suspend, activate, etc.)
 */
export async function updateStoreStatus(
  storeId: string,
  status: "pending_review" | "active" | "suspended" | "inactive",
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current store state for audit log
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const previousStatus = store.status;

    // Update status
    await db
      .update(tenants)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, `store.${status}`, "tenant", storeId, {
      storeName: store.name,
      previousStatus,
      newStatus: status,
      reason,
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true, message: `Store status updated to ${status}` };
  } catch (error) {
    console.error("Failed to update store status:", error);
    return { success: false, error: "Failed to update store status" };
  }
}

/**
 * Update store subscription (upgrade to pro, downgrade to free, etc.)
 */
export async function updateStoreSubscription(
  storeId: string,
  plan: "free" | "pro",
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired",
  notes?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current store state for audit log
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    const now = new Date().toISOString();

    // Build update data
    const updateData: Record<string, unknown> = {
      subscriptionPlan: plan,
      subscriptionStatus: status,
      updatedAt: now,
    };

    // If upgrading to pro with active status, set subscription start
    if (plan === "pro" && status === "active") {
      updateData.subscriptionStartedAt = now;
      // Set subscription end to 30 days from now
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      updateData.subscriptionEndsAt = endDate.toISOString();
    }

    // Add notes if provided
    if (notes) {
      updateData.subscriptionNotes = notes;
    }

    // Update subscription
    await db.update(tenants).set(updateData).where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(
      admin.id,
      `subscription.${plan}.${status}`,
      "tenant",
      storeId,
      {
        storeName: store.name,
        previousPlan: store.subscriptionPlan,
        previousStatus: store.subscriptionStatus,
        newPlan: plan,
        newStatus: status,
        notes,
      }
    );

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return {
      success: true,
      message: `Subscription updated to ${plan} (${status})`,
    };
  } catch (error) {
    console.error("Failed to update subscription:", error);
    return { success: false, error: "Failed to update subscription" };
  }
}

/**
 * Extend store trial period
 */
export async function extendStoreTrial(
  storeId: string,
  days: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current store state
    const store = await db.query.tenants.findFirst({
      where: eq(tenants.id, storeId),
      columns: {
        id: true,
        name: true,
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    });

    if (!store) {
      return { success: false, error: "Store not found" };
    }

    // Calculate new trial end date
    const currentEnd = store.trialEndsAt
      ? new Date(store.trialEndsAt)
      : new Date();
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

    // Update trial
    await db
      .update(tenants)
      .set({
        trialEndsAt: newEnd.toISOString(),
        subscriptionStatus: "trialing",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, "trial.extend", "tenant", storeId, {
      storeName: store.name,
      previousEnd: store.trialEndsAt,
      newEnd: newEnd.toISOString(),
      daysAdded: days,
      reason,
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true, message: `Trial extended by ${days} days` };
  } catch (error) {
    console.error("Failed to extend trial:", error);
    return { success: false, error: "Failed to extend trial" };
  }
}

/**
 * Add admin notes to a store
 */
export async function addStoreNotes(
  storeId: string,
  notes: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    await db
      .update(tenants)
      .set({
        subscriptionNotes: notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Log the action
    await logAdminAction(admin.id, "store.notes", "tenant", storeId, {
      notes,
    });

    revalidatePath(`/admin/stores/${storeId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to add notes:", error);
    return { success: false, error: "Failed to add notes" };
  }
}

/**
 * Update platform settings
 */
export async function updatePlatformSettings(data: {
  proPlanPriceAfn?: string;
  freeProductLimit?: number;
  freeStoreLimit?: number;
  trialDurationDays?: number;
  transactionFeePercent?: string;
  trialWarningDays?: number;
}): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get current settings
    const currentSettings = await db.query.platformSettings.findFirst();

    const now = new Date().toISOString();

    if (currentSettings) {
      // Update existing settings
      await db
        .update(platformSettings)
        .set({
          ...data,
          updatedAt: now,
          updatedBy: admin.id,
        })
        .where(eq(platformSettings.id, currentSettings.id));
    } else {
      // Create initial settings
      await db.insert(platformSettings).values({
        ...data,
        updatedAt: now,
        updatedBy: admin.id,
      });
    }

    // Log the action
    await logAdminAction(admin.id, "settings.update", "settings", null, {
      previousSettings: currentSettings,
      newSettings: data,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return { success: true, message: "Settings updated successfully" };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}
