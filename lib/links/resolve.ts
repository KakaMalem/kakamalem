/**
 * Resolve a store marketing link to its final destination URL.
 *
 * Links are issued on the platform domain (kakamalem.com/s/{code}) but should
 * land on the store's canonical home — its active custom domain if it has one,
 * otherwise kakamalem.com/store/{slug}. UTM params on the link are appended.
 */

import type { StoreLink } from "@/lib/db/schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

interface TenantForLink {
  slug: string;
  customDomain: string | null;
  customDomainStatus: string | null;
}

/** Canonical storefront base URL for a tenant (no trailing slash). */
export function storeBaseUrl(tenant: TenantForLink): string {
  if (tenant.customDomain && tenant.customDomainStatus === "active") {
    return `https://${tenant.customDomain}`;
  }
  return `${APP_URL}/store/${tenant.slug}`;
}

/** Append the link's UTM params to a URL. */
function withUtm(
  url: URL,
  link: Pick<
    StoreLink,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm"
  >
): URL {
  if (link.utmSource) url.searchParams.set("utm_source", link.utmSource);
  if (link.utmMedium) url.searchParams.set("utm_medium", link.utmMedium);
  if (link.utmCampaign) url.searchParams.set("utm_campaign", link.utmCampaign);
  if (link.utmContent) url.searchParams.set("utm_content", link.utmContent);
  if (link.utmTerm) url.searchParams.set("utm_term", link.utmTerm);
  return url;
}

/**
 * Build the absolute destination for a link. `productSlug`/`categorySlug` are
 * required for product/category targets (resolved by the caller from the FK).
 */
export function buildLinkTargetUrl(
  link: Pick<
    StoreLink,
    | "targetType"
    | "targetUrl"
    | "utmSource"
    | "utmMedium"
    | "utmCampaign"
    | "utmContent"
    | "utmTerm"
  >,
  tenant: TenantForLink,
  opts: { productSlug?: string | null; categorySlug?: string | null } = {}
): string {
  const base = storeBaseUrl(tenant);

  let absolute: string;
  switch (link.targetType) {
    case "product":
      absolute = opts.productSlug
        ? `${base}/product/${opts.productSlug}`
        : base;
      break;
    case "category":
      absolute = opts.categorySlug
        ? `${base}/category/${opts.categorySlug}`
        : base;
      break;
    case "url": {
      const raw = link.targetUrl?.trim() || "";
      if (/^https?:\/\//i.test(raw)) {
        absolute = raw; // absolute external URL
      } else if (raw) {
        absolute = `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
      } else {
        absolute = base;
      }
      break;
    }
    case "store":
    default:
      absolute = base;
      break;
  }

  try {
    return withUtm(new URL(absolute), link).toString();
  } catch {
    // Malformed targetUrl — fall back to the store home.
    return withUtm(new URL(base), link).toString();
  }
}
