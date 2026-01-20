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

/**
 * Check if a slug is available (not already in use)
 */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    columns: { id: true },
  });

  return !existing;
}

/**
 * Create a new tenant/store
 */
export async function createTenant(data: {
  name: string;
  slug: string;
  ownerId: string;
  tagline?: string;
  logoUrl?: string;
  headerDisplay?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency?: string;
  storeMode?: "full" | "online_only" | "offline_only" | "catalog";
}) {
  // Determine channel settings based on store mode
  let onlineCheckoutEnabled = true;
  let posEnabled = true;
  let phoneOrdersEnabled = true;

  switch (data.storeMode) {
    case "online_only":
      posEnabled = false;
      phoneOrdersEnabled = false;
      break;
    case "offline_only":
      onlineCheckoutEnabled = false;
      break;
    case "catalog":
      onlineCheckoutEnabled = false;
      posEnabled = false;
      phoneOrdersEnabled = false;
      break;
    // "full" mode keeps all channels enabled
  }

  const [newTenant] = await db
    .insert(tenants)
    .values({
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId,
      tagline: data.tagline || null,
      logoUrl: data.logoUrl || null,
      headerDisplay: data.headerDisplay || "name_only",
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      currency: data.currency || "AFN",
      storeMode: data.storeMode || "full",
      onlineCheckoutEnabled,
      posEnabled,
      phoneOrdersEnabled,
      status: "active", // New stores are active by default
    })
    .returning();

  // Auto-create tenant member with owner role
  if (newTenant) {
    await db.insert(tenantMembers).values({
      tenantId: newTenant.id,
      userId: data.ownerId,
      role: "owner",
    });
  }

  return newTenant;
}

/**
 * Update tenant settings
 */
export async function updateTenant(
  tenantId: string,
  data: Partial<{
    name: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    headerDisplay: string;
    contactEmail: string | null;
    contactPhone: string | null;
    currency: string;
    deliveryMode: "distance_based" | "service_level" | "weight_price_based";
    enableDeliveryZones: boolean;
    storeMode: "full" | "online_only" | "offline_only" | "catalog";
    onlineCheckoutEnabled: boolean;
    posEnabled: boolean;
    phoneOrdersEnabled: boolean;
    receiptPaperWidth: string;
    receiptShowLogo: boolean;
    receiptShowContact: boolean;
    receiptFooterText: string | null;
    socialLinks: Record<string, string | undefined>;
    seo: Record<string, string | undefined>;
    status: "pending_review" | "active" | "suspended" | "inactive";
  }>
) {
  const [updated] = await db
    .update(tenants)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();

  return updated;
}

/**
 * Delete a tenant and all related data
 */
export async function deleteTenant(tenantId: string) {
  // Delete tenant - cascades will handle related records
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}
