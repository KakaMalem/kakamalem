"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tenants, tenantMembers } from "@/lib/db/schema";
import { eq, or, inArray, and, isNotNull } from "drizzle-orm";
import { getPlatformSettings } from "@/lib/db/queries/admin";

export async function getTenantByOwnerId(ownerId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.ownerId, ownerId),
  });

  return tenant;
}

/**
 * Get all stores a user has access to (owned or as a member)
 * Includes the user's role at each store for client-side navigation
 */
export async function getUserStores(userId: string) {
  // First, get tenant IDs where user is a member (with their role)
  const memberships = await db.query.tenantMembers.findMany({
    where: eq(tenantMembers.userId, userId),
    columns: { tenantId: true, role: true },
  });

  const membershipMap = new Map(memberships.map((m) => [m.tenantId, m.role]));
  const memberTenantIds = memberships.map((m) => m.tenantId);

  // Get all tenants where user is owner OR a member
  const userTenants = await db.query.tenants.findMany({
    where:
      memberTenantIds.length > 0
        ? or(eq(tenants.ownerId, userId), inArray(tenants.id, memberTenantIds))
        : eq(tenants.ownerId, userId),
    orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
  });

  // Add user's role for each store
  return userTenants.map((tenant) => ({
    ...tenant,
    userRole: (tenant.ownerId === userId
      ? "owner"
      : (membershipMap.get(tenant.id) ?? null)) as
      | "owner"
      | "admin"
      | "staff"
      | null,
  }));
}

export async function getTenantById(tenantId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  return tenant;
}

export async function getTenantBySlug(slug: string) {
  // Normalize Unicode to match how slugs are stored (NFKC from slugify)
  // Also decode URL encoding in case it wasn't decoded by the framework
  let normalizedSlug: string;
  try {
    normalizedSlug = decodeURIComponent(slug).normalize("NFKC");
  } catch {
    // If decoding fails, just normalize the original
    normalizedSlug = slug.normalize("NFKC");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, normalizedSlug),
  });

  return tenant;
}

/**
 * Get a tenant by custom domain (for custom domain routing)
 * Only returns tenants with active custom domain configuration
 */
export async function getTenantByCustomDomain(domain: string) {
  const tenant = await db.query.tenants.findFirst({
    where: and(
      eq(tenants.customDomain, domain.toLowerCase()),
      eq(tenants.customDomainStatus, "active"),
      isNotNull(tenants.customDomain)
    ),
  });

  return tenant;
}

/**
 * Resolve tenant from a route slug.
 * If the request has an x-custom-domain header (custom domain routing),
 * looks up the tenant by domain. Otherwise, looks up by slug.
 */
export async function resolveTenant(slug: string) {
  const headersList = await headers();
  const customDomain = headersList.get("x-custom-domain");

  if (customDomain) {
    return getTenantByCustomDomain(customDomain);
  }

  return getTenantBySlug(slug);
}

/**
 * Check if a slug is available (not already in use)
 */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  // Normalize Unicode to match how slugs are stored (NFKC from slugify)
  const normalizedSlug = slug.normalize("NFKC");

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, normalizedSlug),
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
  // Store location
  storeLocationLat?: number | null;
  storeLocationLng?: number | null;
  storeLocationCity?: string | null;
  storeLocationAccuracy?: number | null;
  storeLocationSource?: "gps" | "manual" | null;
  storeLocationPlusCode?: string | null;
}) {
  // Determine channel settings based on store mode
  let onlineCheckoutEnabled = true;
  let posEnabled = true;

  switch (data.storeMode) {
    case "online_only":
      posEnabled = false;
      break;
    case "offline_only":
      onlineCheckoutEnabled = false;
      break;
    case "catalog":
      onlineCheckoutEnabled = false;
      posEnabled = false;
      break;
    // "full" mode keeps all channels enabled
  }

  // Calculate trial dates
  const platformSettings = await getPlatformSettings();
  const trialDurationDays = platformSettings?.trialDurationDays ?? 7;

  const now = new Date();
  const trialEndsAtDate = new Date(
    now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000
  );

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
      status: "active", // New stores are active by default
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEndsAtDate.toISOString(),
      // Store location
      storeLocationLat: data.storeLocationLat?.toString() ?? null,
      storeLocationLng: data.storeLocationLng?.toString() ?? null,
      storeLocationCity: data.storeLocationCity || null,
      storeLocationAccuracy: data.storeLocationAccuracy ?? null,
      storeLocationSource: data.storeLocationSource || null,
      storeLocationPlusCode: data.storeLocationPlusCode || null,
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
    enableShipping: boolean;
    storeMode: "full" | "online_only" | "offline_only" | "catalog";
    onlineCheckoutEnabled: boolean;
    posEnabled: boolean;
    phoneOrdersEnabled: boolean;
    posScannerMode: string;
    receiptPaperWidth: string;
    receiptShowLogo: boolean;
    receiptShowContact: boolean;
    receiptFooterText: string | null;
    receiptPrintMode: string;
    socialLinks: Record<string, string | boolean | undefined>;
    seo: Record<string, string | undefined>;
    status: "pending_review" | "active" | "suspended" | "inactive";
    // Store location
    storeLocationLat: string | null;
    storeLocationLng: string | null;
    storeLocationCity: string | null;
    storeLocationAccuracy: number | null;
    storeLocationSource: string | null;
    storeLocationPlusCode: string | null;
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
