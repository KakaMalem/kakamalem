import { unstable_cache, revalidateTag as _revalidateTag } from "next/cache";

// ============================================================================
// CACHE TTLs (seconds)
// ============================================================================

export const CACHE_TTL = {
  /** Tenant data (store settings, branding, theme) — 5 minutes */
  tenant: 300,
  /** Published page layouts — 1 hour (change infrequently) */
  layout: 3600,
  /** Category lists with counts — 5 minutes */
  categories: 300,
  /** Active campaigns — 5 minutes */
  campaigns: 300,
} as const;

// ============================================================================
// CACHE TAG HELPERS
// ============================================================================

export const cacheTags = {
  tenant: (slug: string) => `tenant:${slug}`,
  tenantDomain: (domain: string) => `tenant-domain:${domain}`,
  layout: (tenantId: string, pageType: string) =>
    `layout:${tenantId}:${pageType}`,
  categories: (tenantId: string) => `categories:${tenantId}`,
  campaigns: (tenantId: string) => `campaigns:${tenantId}`,
};

/**
 * Wrapper for Next.js 16 revalidateTag which requires a cache profile.
 * Uses "default" profile for all tag invalidations.
 */
export function revalidateTag(tag: string) {
  return _revalidateTag(tag, "default");
}

// Re-export for single import
export { unstable_cache };
