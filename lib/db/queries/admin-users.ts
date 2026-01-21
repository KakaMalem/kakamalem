import { db } from "@/lib/db";
import {
  user,
  userProfiles,
  tenants,
  tenantMembers,
  orders,
  adminAuditLog,
} from "@/lib/db/schema";
import {
  eq,
  sql,
  desc,
  and,
  or,
  ilike,
  count,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { cache } from "react";

// =============================================================================
// ADMIN USER QUERIES
// =============================================================================
// Database queries for the admin users management page
// =============================================================================

/**
 * Get users with pagination and filters
 */
export async function getAdminUsers(options: {
  page?: number;
  limit?: number;
  search?: string;
  platformRole?: "user" | "platform_admin" | "super_admin";
  emailVerified?: boolean;
  includeDeleted?: boolean;
  sortBy?: "createdAt" | "name" | "email";
  sortOrder?: "asc" | "desc";
}) {
  const {
    page = 1,
    limit = 20,
    search,
    platformRole,
    emailVerified,
    includeDeleted = false,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];

  // Search filter
  if (search) {
    conditions.push(
      or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))
    );
  }

  // Platform role filter
  if (platformRole) {
    conditions.push(eq(userProfiles.platformRole, platformRole));
  }

  // Email verified filter
  if (emailVerified !== undefined) {
    conditions.push(eq(user.emailVerified, emailVerified));
  }

  // Soft delete filter (exclude deleted by default)
  if (!includeDeleted) {
    conditions.push(isNull(userProfiles.deletedAt));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get users with profile and store counts
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: {
        id: userProfiles.id,
        platformRole: userProfiles.platformRole,
        phone: userProfiles.phone,
        deletedAt: userProfiles.deletedAt,
      },
      storesOwned: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${tenants}
        WHERE ${tenants.ownerId} = ${user.id}
      )`,
      storesMemberOf: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${tenantMembers}
        WHERE ${tenantMembers.userId} = ${user.id}
      )`,
    })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(whereClause)
    .orderBy(
      sortOrder === "desc"
        ? desc(user[sortBy as keyof typeof user] as typeof user.createdAt)
        : (user[sortBy as keyof typeof user] as typeof user.createdAt)
    )
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ total }] = await db
    .select({ total: count() })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(whereClause);

  return {
    users,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

/**
 * Get a single user by ID with full details for admin view
 */
export async function getAdminUserById(userId: string) {
  // Get user with profile
  const [userData] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: {
        id: userProfiles.id,
        platformRole: userProfiles.platformRole,
        phone: userProfiles.phone,
        preferredCurrency: userProfiles.preferredCurrency,
        preferredLanguage: userProfiles.preferredLanguage,
        deletedAt: userProfiles.deletedAt,
        createdAt: userProfiles.createdAt,
      },
    })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) return null;

  // Get stores owned
  const storesOwned = await db.query.tenants.findMany({
    where: eq(tenants.ownerId, userId),
    columns: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscriptionStatus: true,
    },
  });

  // Get stores member of (excluding owned)
  const memberships = await db
    .select({
      id: tenantMembers.id,
      role: tenantMembers.role,
      tenant: {
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
      },
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(
      and(
        eq(tenantMembers.userId, userId),
        // Exclude stores they own (they're already in storesOwned)
        sql`${tenants.ownerId} != ${userId}`
      )
    );

  // Get orders count
  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.userId, userId));

  // Get recent activity from audit log (actions targeting this user)
  const recentActivity = await db.query.adminAuditLog.findMany({
    where: or(
      and(
        eq(adminAuditLog.targetType, "user"),
        eq(adminAuditLog.targetId, userId)
      ),
      eq(adminAuditLog.adminId, userId)
    ),
    with: {
      admin: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: desc(adminAuditLog.createdAt),
    limit: 20,
  });

  return {
    ...userData,
    stats: {
      storesOwned: storesOwned.length,
      storesMemberOf: memberships.length,
      ordersPlaced: Number(orderCount?.count ?? 0),
    },
    stores: {
      owned: storesOwned,
      memberOf: memberships.map((m) => ({
        ...m.tenant,
        role: m.role,
      })),
    },
    recentActivity,
  };
}

/**
 * Get user statistics for admin dashboard
 */
export const getAdminUserStats = cache(async () => {
  // Count users by platform role
  const roleStats = await db
    .select({
      platformRole: userProfiles.platformRole,
      count: count(),
    })
    .from(userProfiles)
    .where(isNull(userProfiles.deletedAt))
    .groupBy(userProfiles.platformRole);

  // Count verified vs unverified
  const [verifiedCount] = await db
    .select({ count: count() })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(and(eq(user.emailVerified, true), isNull(userProfiles.deletedAt)));

  const [totalCount] = await db
    .select({ count: count() })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(isNull(userProfiles.deletedAt));

  // Count deleted users
  const [deletedCount] = await db
    .select({ count: count() })
    .from(userProfiles)
    .where(isNotNull(userProfiles.deletedAt));

  let regularUsers = 0;
  let platformAdmins = 0;
  let superAdmins = 0;

  roleStats.forEach((stat) => {
    const c = Number(stat.count);
    if (stat.platformRole === "user") regularUsers = c;
    if (stat.platformRole === "platform_admin") platformAdmins = c;
    if (stat.platformRole === "super_admin") superAdmins = c;
  });

  return {
    total: Number(totalCount?.count ?? 0),
    regularUsers,
    platformAdmins,
    superAdmins,
    verified: Number(verifiedCount?.count ?? 0),
    deleted: Number(deletedCount?.count ?? 0),
  };
});

/**
 * Get admin notes for a user from audit log
 */
export async function getUserAdminNotes(userId: string) {
  return db.query.adminAuditLog.findMany({
    where: and(
      eq(adminAuditLog.targetType, "user"),
      eq(adminAuditLog.targetId, userId),
      eq(adminAuditLog.action, "user.note")
    ),
    with: {
      admin: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: desc(adminAuditLog.createdAt),
  });
}
