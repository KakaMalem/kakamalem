import { headers } from "next/headers";
import { auth } from "./index";
import { db } from "@/lib/db";
import { userProfiles, tenants, tenantMembers, affiliates, deliveryProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

// =============================================================================
// SERVER-SIDE AUTH HELPERS
// =============================================================================
// Use these in Server Components, Server Actions, and API routes
// =============================================================================

/**
 * Get the current session from headers
 * Cached per request using React's cache()
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: {
      // Disable cookie cache to fix session reading issues
      // See: https://github.com/better-auth/better-auth/issues/7008
      disableCookieCache: true,
    },
  });
  return session;
});

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 */
export const getUser = cache(async () => {
  const session = await getSession();
  return session?.user ?? null;
});

/**
 * Require authentication - throws if not authenticated
 * Use in protected server actions/routes
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Get the current user's extended profile
 */
export const getUserProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.id),
  });

  return profile;
});

/**
 * Get all portal access for the current user
 * Returns which portals the user can access
 */
export const getPortalAccess = cache(async () => {
  const user = await getUser();
  if (!user) {
    return {
      isAuthenticated: false,
      user: null,
      seller: null,
      staff: [],
      affiliate: null,
      delivery: null,
    };
  }

  // Fetch all access in parallel
  const [ownedStores, staffMemberships, affiliateProfile, deliveryProfile] =
    await Promise.all([
      // Stores the user owns
      db.query.tenants.findMany({
        where: eq(tenants.ownerId, user.id),
        columns: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      }),
      // Stores the user is staff at
      db.query.tenantMembers.findMany({
        where: eq(tenantMembers.userId, user.id),
        with: {
          tenant: {
            columns: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      }),
      // Affiliate profile
      db.query.affiliates.findFirst({
        where: eq(affiliates.userId, user.id),
        columns: {
          id: true,
          displayName: true,
          slug: true,
          status: true,
        },
      }),
      // Delivery provider profile
      db.query.deliveryProviders.findFirst({
        where: eq(deliveryProviders.userId, user.id),
        columns: {
          id: true,
          displayName: true,
          slug: true,
          status: true,
          type: true,
        },
      }),
    ]);

  return {
    isAuthenticated: true,
    user,
    seller: ownedStores.length > 0 ? ownedStores : null,
    staff: staffMemberships,
    affiliate: affiliateProfile,
    delivery: deliveryProfile,
  };
});

/**
 * Check if the current user owns a specific store
 */
export async function isStoreOwner(tenantId: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { ownerId: true },
  });

  return tenant?.ownerId === user.id;
}

/**
 * Check if the current user has access to a specific store
 * (either as owner or staff)
 */
export async function hasStoreAccess(
  tenantId: string
): Promise<{ hasAccess: boolean; role: string | null }> {
  const user = await getUser();
  if (!user) return { hasAccess: false, role: null };

  // Check if owner
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { ownerId: true },
  });

  if (tenant?.ownerId === user.id) {
    return { hasAccess: true, role: "owner" };
  }

  // Check if staff
  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.tenantId, tenantId),
    columns: { role: true },
  });

  if (membership) {
    return { hasAccess: true, role: membership.role };
  }

  return { hasAccess: false, role: null };
}

/**
 * Create user profile after sign up
 * Call this in a webhook or after successful registration
 */
export async function createUserProfile(userId: string, data?: {
  phone?: string;
  preferredCurrency?: string;
  preferredLanguage?: string;
}) {
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const [profile] = await db.insert(userProfiles).values({
    userId,
    phone: data?.phone,
    preferredCurrency: data?.preferredCurrency ?? "AFN",
    preferredLanguage: data?.preferredLanguage ?? "fa",
    platformRole: "user",
  }).returning();

  return profile;
}
