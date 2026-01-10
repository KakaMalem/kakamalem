import { cache } from "react";
import { db } from "@/lib/db";
import {
  tenants,
  tenantMembers,
  storeCustomers,
  orders,
  userAddresses,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "./server";

// =============================================================================
// STORE CONTEXT HELPERS
// =============================================================================
// Utilities for detecting user's relationship to a specific store
// Used in store pages to show appropriate UI (owner badge, customer account, etc.)
// =============================================================================

export type StoreRole = "owner" | "admin" | "staff" | null;

export interface UserStoreContext {
  /** Is this user the store owner? */
  isOwner: boolean;
  /** Is this user a staff member (admin or staff role)? */
  isStaff: boolean;
  /** Is this user either owner or staff? */
  isMember: boolean;
  /** The user's role at this store (null if not a member) */
  role: StoreRole;
  /** Has this user placed orders at this store? */
  isCustomer: boolean;
  /** Store-specific customer metadata (if exists) */
  storeCustomer: {
    id: string;
    marketingConsent: boolean;
    totalOrders: number;
    totalSpent: string;
  } | null;
}

/**
 * Get a user's relationship to a specific store
 * Returns information about whether they're an owner, staff, or customer
 */
export const getUserStoreContext = cache(
  async (tenantId: string): Promise<UserStoreContext | null> => {
    const user = await getUser();
    if (!user) return null;

    // Fetch all relevant data in parallel
    const [tenant, membership, customerRecord, orderCount] = await Promise.all([
      // Check if user owns this store
      db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { ownerId: true },
      }),
      // Check if user is staff at this store
      db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, user.id)
        ),
        columns: { role: true },
      }),
      // Get store-specific customer record (if exists)
      db.query.storeCustomers.findFirst({
        where: and(
          eq(storeCustomers.tenantId, tenantId),
          eq(storeCustomers.userId, user.id)
        ),
        columns: {
          id: true,
          marketingConsent: true,
          totalOrders: true,
          totalSpent: true,
        },
      }),
      // Check if user has placed orders (even without storeCustomer record)
      db
        .select({ count: orders.id })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.userId, user.id)))
        .limit(1),
    ]);

    const isOwner = tenant?.ownerId === user.id;
    const staffRole = membership?.role ?? null;
    const isStaff = staffRole !== null;
    const hasOrders =
      orderCount.length > 0 || (customerRecord?.totalOrders ?? 0) > 0;

    // Determine the role
    let role: StoreRole = null;
    if (isOwner) {
      role = "owner";
    } else if (staffRole) {
      role = staffRole;
    }

    return {
      isOwner,
      isStaff,
      isMember: isOwner || isStaff,
      role,
      isCustomer: hasOrders,
      storeCustomer: customerRecord
        ? {
            id: customerRecord.id,
            marketingConsent: customerRecord.marketingConsent,
            totalOrders: customerRecord.totalOrders,
            totalSpent: customerRecord.totalSpent,
          }
        : null,
    };
  }
);

/**
 * Check if the current user can manage a store (owner, admin, or staff)
 */
export async function canManageStore(tenantId: string): Promise<boolean> {
  const context = await getUserStoreContext(tenantId);
  return context?.isMember ?? false;
}

/**
 * Check if the current user has a specific minimum role at a store
 * Role hierarchy: owner > admin > staff
 */
export async function hasMinimumRole(
  tenantId: string,
  minRole: "owner" | "admin" | "staff"
): Promise<boolean> {
  const context = await getUserStoreContext(tenantId);
  if (!context) return false;

  const roleHierarchy = { owner: 3, admin: 2, staff: 1 };
  const userRoleLevel = context.role ? roleHierarchy[context.role] : 0;
  const requiredLevel = roleHierarchy[minRole];

  return userRoleLevel >= requiredLevel;
}

/**
 * Get the user's default shipping address for checkout
 */
export const getUserDefaultAddress = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const address = await db.query.userAddresses.findFirst({
    where: and(
      eq(userAddresses.userId, user.id),
      eq(userAddresses.isDefault, true)
    ),
  });

  return address ?? null;
});

/**
 * Get all saved addresses for the current user
 */
export const getUserAddresses = cache(async () => {
  const user = await getUser();
  if (!user) return [];

  const addresses = await db.query.userAddresses.findMany({
    where: eq(userAddresses.userId, user.id),
    orderBy: (addresses, { desc }) => [
      desc(addresses.isDefault),
      desc(addresses.createdAt),
    ],
  });

  return addresses;
});

// =============================================================================
// AUTH REDIRECT HELPERS
// =============================================================================

/**
 * Build the redirect URL for store auth pages
 * Encodes the store context for use after authentication
 */
export function buildStoreAuthRedirect(
  storeSlug: string,
  redirectPath?: string
): string {
  const basePath = `/store/${storeSlug}`;
  return redirectPath || basePath;
}

/**
 * Parse the redirect parameter from URL search params
 * Returns a safe redirect URL (prevents open redirect attacks)
 */
export function parseRedirectParam(
  searchParams: URLSearchParams,
  defaultPath: string
): string {
  const redirect = searchParams.get("redirect");

  // If no redirect param, use default
  if (!redirect) return defaultPath;

  // Security: Only allow relative paths (prevent open redirect)
  if (redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }

  return defaultPath;
}
