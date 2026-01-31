import type { StoreRole } from "@/lib/auth/context";

// =============================================================================
// SETTINGS PAGE PERMISSIONS
// =============================================================================
// Defines which roles can access which settings pages
// Role hierarchy: owner (3) > admin (2) > staff (1)
// =============================================================================

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
  | "danger";

export interface SettingsPageConfig {
  key: SettingsPageKey;
  title: string;
  description: string;
  /** Path relative to /dashboard/[slug]/settings (empty string for root) */
  href: string;
  /** Minimum role required to access this page */
  minRole: "owner" | "admin";
}

/** Role hierarchy for permission checks */
const ROLE_HIERARCHY: Record<"owner" | "admin" | "staff", number> = {
  owner: 3,
  admin: 2,
  staff: 1,
};

/**
 * All settings pages with their access requirements
 */
export const SETTINGS_PAGES: SettingsPageConfig[] = [
  {
    key: "general",
    title: "General",
    description: "Store name, description, and contact info",
    href: "",
    minRole: "admin",
  },
  {
    key: "location",
    title: "Location",
    description: "Physical store location on map",
    href: "/location",
    minRole: "admin",
  },
  {
    key: "branding",
    title: "Branding",
    description: "Logo, colors, and visual identity",
    href: "/branding",
    minRole: "admin",
  },
  {
    key: "social",
    title: "Social Links",
    description: "Connect your social media accounts",
    href: "/social",
    minRole: "admin",
  },
  {
    key: "seo",
    title: "SEO",
    description: "Search engine optimization settings",
    href: "/seo",
    minRole: "admin",
  },
  {
    key: "domains",
    title: "Domains",
    description: "Custom domain configuration",
    href: "/domains",
    minRole: "owner",
  },
  {
    key: "team",
    title: "Team",
    description: "Manage staff and collaborators",
    href: "/team",
    minRole: "owner",
  },
  {
    key: "delivery",
    title: "Delivery & Shipping",
    description: "Delivery zones, rates, and shipping options",
    href: "/delivery",
    minRole: "admin",
  },
  {
    key: "payments",
    title: "Payments",
    description: "Configure payment methods for checkout",
    href: "/payments",
    minRole: "owner",
  },
  {
    key: "store-mode",
    title: "Store Mode",
    description: "Configure how your store operates",
    href: "/store-mode",
    minRole: "owner",
  },
  {
    key: "danger",
    title: "Danger Zone",
    description: "Delete or transfer store",
    href: "/danger",
    minRole: "owner",
  },
];

/**
 * Check if a role has access to a specific settings page
 */
export function canAccessSettingsPage(
  role: StoreRole,
  pageKey: SettingsPageKey
): boolean {
  if (!role) return false;

  const page = SETTINGS_PAGES.find((p) => p.key === pageKey);
  if (!page) return false;

  const userLevel = ROLE_HIERARCHY[role];
  const requiredLevel = ROLE_HIERARCHY[page.minRole];

  return userLevel >= requiredLevel;
}

/**
 * Get all settings pages accessible to a role
 */
export function getAccessibleSettingsPages(
  role: StoreRole
): SettingsPageConfig[] {
  if (!role) return [];

  const userLevel = ROLE_HIERARCHY[role];
  return SETTINGS_PAGES.filter(
    (page) => userLevel >= ROLE_HIERARCHY[page.minRole]
  );
}

/**
 * Check if role can access any settings (for sidebar visibility)
 * Staff cannot access any settings pages
 */
export function canAccessAnySettings(role: StoreRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Get a human-readable description of the required role for a settings page
 */
export function getRequiredRoleLabel(pageKey: SettingsPageKey): string {
  const page = SETTINGS_PAGES.find((p) => p.key === pageKey);
  if (!page) return "store owner";

  return page.minRole === "owner" ? "store owner" : "store admin or owner";
}
