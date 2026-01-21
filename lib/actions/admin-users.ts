"use server";

import { db } from "@/lib/db";
import { user, userProfiles, adminAuditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requirePlatformAdmin,
  getUserProfile,
  isSuperAdmin,
} from "@/lib/auth/server";
import { headers } from "next/headers";

// =============================================================================
// ADMIN USER SERVER ACTIONS
// =============================================================================
// Server actions for user management with audit logging
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
 * Update user's platform role
 */
export async function updateUserPlatformRole(
  userId: string,
  role: "user" | "platform_admin" | "super_admin"
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get target user
    const [targetUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent self-demotion for super admin
    if (admin.id === userId && role !== "super_admin") {
      const currentProfile = await getUserProfile();
      if (currentProfile?.platformRole === "super_admin") {
        return {
          success: false,
          error: "Cannot demote yourself as super admin",
        };
      }
    }

    // Only super admin can promote to super admin
    if (role === "super_admin") {
      const isSuper = await isSuperAdmin();
      if (!isSuper) {
        return {
          success: false,
          error: "Only super admins can promote to super admin",
        };
      }
    }

    // Get current role for audit log
    const [currentProfile] = await db
      .select({ platformRole: userProfiles.platformRole })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const previousRole = currentProfile?.platformRole || "user";

    // Update role
    await db
      .update(userProfiles)
      .set({
        platformRole: role,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userProfiles.userId, userId));

    // Log the action
    await logAdminAction(admin.id, "user.role.update", "user", userId, {
      userName: targetUser.name,
      userEmail: targetUser.email,
      previousRole,
      newRole: role,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: `Role updated to ${role.replace("_", " ")}`,
    };
  } catch (error) {
    console.error("Failed to update user role:", error);
    return { success: false, error: "Failed to update user role" };
  }
}

/**
 * Soft delete a user (set deletedAt timestamp)
 */
export async function softDeleteUser(
  userId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Prevent self-deletion
    if (admin.id === userId) {
      return { success: false, error: "Cannot delete your own account" };
    }

    // Get target user
    const [targetUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Check if already deleted
    const [profile] = await db
      .select({ deletedAt: userProfiles.deletedAt })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (profile?.deletedAt) {
      return { success: false, error: "User is already deleted" };
    }

    // Soft delete
    const now = new Date().toISOString();
    await db
      .update(userProfiles)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));

    // Log the action
    await logAdminAction(admin.id, "user.soft_delete", "user", userId, {
      userName: targetUser.name,
      userEmail: targetUser.email,
      reason,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}

/**
 * Restore a soft-deleted user
 */
export async function restoreUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    // Get target user
    const [targetUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Check if actually deleted
    const [profile] = await db
      .select({ deletedAt: userProfiles.deletedAt })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile?.deletedAt) {
      return { success: false, error: "User is not deleted" };
    }

    // Restore
    await db
      .update(userProfiles)
      .set({
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userProfiles.userId, userId));

    // Log the action
    await logAdminAction(admin.id, "user.restore", "user", userId, {
      userName: targetUser.name,
      userEmail: targetUser.email,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, message: "User restored successfully" };
  } catch (error) {
    console.error("Failed to restore user:", error);
    return { success: false, error: "Failed to restore user" };
  }
}

/**
 * Add admin note for a user (stored in audit log)
 */
export async function addUserAdminNote(
  userId: string,
  note: string
): Promise<ActionResult> {
  try {
    const admin = await requirePlatformAdmin();

    if (!note.trim()) {
      return { success: false, error: "Note cannot be empty" };
    }

    // Get target user
    const [targetUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Log the note as an audit entry
    await logAdminAction(admin.id, "user.note", "user", userId, {
      userName: targetUser.name,
      userEmail: targetUser.email,
      note: note.trim(),
    });

    revalidatePath(`/admin/users/${userId}`);

    return { success: true, message: "Note added" };
  } catch (error) {
    console.error("Failed to add note:", error);
    return { success: false, error: "Failed to add note" };
  }
}
