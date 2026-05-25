import type { StoreRole } from "@/lib/auth/context";

/**
 * Minimal shape needed by access checks — accepts the full `UserStoreContext`
 * or the lighter client-side role store. Platform admins always pass.
 */
export interface AccessCheckContext {
  role: StoreRole;
  isPlatformAdminOverride?: boolean;
}

// =============================================================================
// SETTINGS PAGE PERMISSIONS
// =============================================================================
// Defines which roles can access which settings pages
// Role hierarchy: owner (3) > admin (2) > staff (1)
// =============================================================================

export type SettingsGroup =
  | "store-profile"
  | "operations"
  | "growth"
  | "advanced";

export interface SettingsGroupConfig {
  key: SettingsGroup;
  title: string;
}

export const SETTINGS_GROUPS: SettingsGroupConfig[] = [
  { key: "store-profile", title: "Store Profile" },
  { key: "operations", title: "Operations" },
  { key: "growth", title: "Growth" },
  { key: "advanced", title: "Advanced" },
];

export type SettingsPageKey =
  | "general"
  | "location"
  | "branding"
  | "social"
  | "seo"
  | "domains"
  | "team"
  | "delivery"
  | "payments"
  | "store-mode"
  | "integrations"
  | "danger";

export interface SettingsPageConfig {
  key: SettingsPageKey;
  title: string;
  description: string;
  /** Path relative to /dashboard/[slug]/settings (empty string for root) */
  href: string;
  /** Minimum role required to access this page */
  minRole: "owner" | "admin";
  /** Nav group this page belongs to */
  group: SettingsGroup;
}

/** Role hierarchy for permission checks */
const ROLE_HIERARCHY: Record<"owner" | "admin" | "staff", number> = {
  owner: 3,
  admin: 2,
  staff: 1,
};

/**
 * All settings pages with their access requirements, ordered by group
 */
export const SETTINGS_PAGES: SettingsPageConfig[] = [
  // --- Store Profile ---
  {
    key: "general",
    title: "General",
    description: "Store name, description, and contact info",
    href: "",
    minRole: "admin",
    group: "store-profile",
  },
  {
    key: "branding",
    title: "Branding",
    description: "Logo, colors, and visual identity",
    href: "/branding",
    minRole: "admin",
    group: "store-profile",
  },
  {
    key: "social",
    title: "Social Links",
    description: "Connect your social media accounts",
    href: "/social",
    minRole: "admin",
    group: "store-profile",
  },
  {
    key: "seo",
    title: "SEO",
    description: "Search engine optimization settings",
    href: "/seo",
    minRole: "admin",
    group: "store-profile",
  },
  // --- Operations ---
  {
    key: "store-mode",
    title: "Store Mode",
    description: "Configure how your store operates",
    href: "/store-mode",
    minRole: "owner",
    group: "operations",
  },
  {
    key: "payments",
    title: "Payments",
    description: "Choose which payment methods customers can use at checkout",
    href: "/payments",
    minRole: "owner",
    group: "operations",
  },
  {
    key: "delivery",
    title: "Delivery & Shipping",
    description: "Delivery zones, rates, and shipping options",
    href: "/delivery",
    minRole: "admin",
    group: "operations",
  },
  {
    key: "location",
    title: "Location",
    description: "Physical store location on map",
    href: "/location",
    minRole: "admin",
    group: "operations",
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "Connect to AutoDS and other platforms",
    href: "/integrations",
    minRole: "owner",
    group: "operations",
  },
  // --- Growth ---
  {
    key: "team",
    title: "Team",
    description: "Manage staff and collaborators",
    href: "/team",
    minRole: "owner",
    group: "growth",
  },
  {
    key: "domains",
    title: "Domains",
    description: "Custom domain configuration",
    href: "/domains",
    minRole: "owner",
    group: "growth",
  },
  // --- Advanced ---
  {
    key: "danger",
    title: "Danger Zone",
    description: "Delete or transfer store",
    href: "/danger",
    minRole: "owner",
    group: "advanced",
  },
];

/**
 * Check if a role has access to a specific settings page.
 * Platform admins (via `isPlatformAdminOverride`) always pass.
 */
export function canAccessSettingsPage(
  context: AccessCheckContext | StoreRole | null,
  pageKey: SettingsPageKey
): boolean {
  const { role, isPlatformAdminOverride } = normalizeContext(context);
  if (isPlatformAdminOverride) return true;
  if (!role) return false;

  const page = SETTINGS_PAGES.find((p) => p.key === pageKey);
  if (!page) return false;

  const userLevel = ROLE_HIERARCHY[role];
  const requiredLevel = ROLE_HIERARCHY[page.minRole];

  return userLevel >= requiredLevel;
}

/**
 * Get all settings pages accessible to a role.
 * Platform admins see everything.
 */
export function getAccessibleSettingsPages(
  context: AccessCheckContext | StoreRole | null
): SettingsPageConfig[] {
  const { role, isPlatformAdminOverride } = normalizeContext(context);
  if (isPlatformAdminOverride) return SETTINGS_PAGES;
  if (!role) return [];

  const userLevel = ROLE_HIERARCHY[role];
  return SETTINGS_PAGES.filter(
    (page) => userLevel >= ROLE_HIERARCHY[page.minRole]
  );
}

/**
 * Get settings pages grouped by section, filtered by role
 */
export function getGroupedSettingsPages(
  context: AccessCheckContext | StoreRole | null
): { group: SettingsGroupConfig; pages: SettingsPageConfig[] }[] {
  const accessible = getAccessibleSettingsPages(context);

  return SETTINGS_GROUPS.map((group) => ({
    group,
    pages: accessible.filter((p) => p.group === group.key),
  })).filter((entry) => entry.pages.length > 0);
}

/**
 * Check if role can access any settings (for sidebar visibility).
 * Staff cannot access any settings pages. Platform admins always can.
 */
export function canAccessAnySettings(
  context: AccessCheckContext | StoreRole | null
): boolean {
  const { role, isPlatformAdminOverride } = normalizeContext(context);
  if (isPlatformAdminOverride) return true;
  return role === "owner" || role === "admin";
}

function normalizeContext(
  input: AccessCheckContext | StoreRole | null
): AccessCheckContext {
  if (input === null) return { role: null };
  if (typeof input === "string") return { role: input };
  return input;
}

/**
 * Get a human-readable description of the required role for a settings page
 */
export function getRequiredRoleLabel(pageKey: SettingsPageKey): string {
  const page = SETTINGS_PAGES.find((p) => p.key === pageKey);
  if (!page) return "store owner";

  return page.minRole === "owner" ? "store owner" : "store admin or owner";
}
