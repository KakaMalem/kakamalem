"use server";

import { db } from "@/lib/db";
import { tenants, tenantMembers } from "@/lib/db/schema";
import { eq, or, inArray } from "drizzle-orm";

export async function getTenantByOwnerId(ownerId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.ownerId, ownerId),
  });

  return tenant;
}

/**
 * Get all stores a user has access to (owned or as a member)
 */
export async function getUserStores(userId: string) {
  // First, get tenant IDs where user is a member
  const memberships = await db.query.tenantMembers.findMany({
    where: eq(tenantMembers.userId, userId),
    columns: { tenantId: true },
  });

  const memberTenantIds = memberships.map((m) => m.tenantId);

  // Get all tenants where user is owner OR a member
  const userTenants = await db.query.tenants.findMany({
    where:
      memberTenantIds.length > 0
        ? or(eq(tenants.ownerId, userId), inArray(tenants.id, memberTenantIds))
        : eq(tenants.ownerId, userId),
    orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
  });

  return userTenants;
}

export async function getTenantById(tenantId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  return tenant;
}
