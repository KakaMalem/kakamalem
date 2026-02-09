import { NextRequest, NextResponse } from "next/server";
import { AFFILIATE_CONFIG, RESERVED_SLUGS } from "./constants";

// Cookie names
export const AFFILIATE_COOKIE_NAME = "affiliate_ref";
export const VISITOR_ID_COOKIE_NAME = "affiliate_visitor_id";

// Types
export interface AffiliateTrackingData {
  affiliateSlug: string;
  visitorId: string;
  expiresAt: Date;
}

/**
 * Generate a unique visitor ID for tracking
 */
export function generateVisitorId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if a path segment could be an affiliate slug
 * Returns false for reserved paths
 */
export function couldBeAffiliateSlug(slug: string): boolean {
  // Empty or has multiple segments
  if (!slug || slug.includes("/")) {
    return false;
  }

  const normalizedSlug = slug.toLowerCase();

  // Check reserved slugs from constants
  if (RESERVED_SLUGS.has(normalizedSlug)) {
    return false;
  }

  // Check common reserved patterns
  const reservedPatterns = [
    /^_/, // Starts with underscore (Next.js convention)
    /^~/, // Starts with tilde (PWA convention)
    /^\./, // Starts with dot (hidden files)
    /\.(txt|xml|json|ico|png|jpg|svg|css|js|map)$/, // File extensions
  ];

  for (const pattern of reservedPatterns) {
    if (pattern.test(normalizedSlug)) {
      return false;
    }
  }

  return true;
}

/**
 * Get affiliate tracking data from cookies
 */
export function getAffiliateTrackingFromCookies(
  request: NextRequest
): AffiliateTrackingData | null {
  const affiliateSlug = request.cookies.get(AFFILIATE_COOKIE_NAME)?.value;
  const visitorId = request.cookies.get(VISITOR_ID_COOKIE_NAME)?.value;

  if (!affiliateSlug || !visitorId) {
    return null;
  }

  return {
    affiliateSlug,
    visitorId,
    expiresAt: new Date(
      Date.now() + AFFILIATE_CONFIG.cookieDurationDays * 24 * 60 * 60 * 1000
    ),
  };
}

/**
 * Set affiliate tracking cookies on a response
 */
export function setAffiliateTrackingCookies(
  response: NextResponse,
  affiliateSlug: string,
  visitorId?: string
): NextResponse {
  const vid = visitorId || generateVisitorId();
  const expiresAt = new Date(
    Date.now() + AFFILIATE_CONFIG.cookieDurationDays * 24 * 60 * 60 * 1000
  );

  // Set affiliate slug cookie
  response.cookies.set(AFFILIATE_COOKIE_NAME, affiliateSlug, {
    expires: expiresAt,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Set visitor ID cookie
  response.cookies.set(VISITOR_ID_COOKIE_NAME, vid, {
    expires: expiresAt,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return response;
}

/**
 * Clear affiliate tracking cookies
 */
export function clearAffiliateTrackingCookies(
  response: NextResponse
): NextResponse {
  response.cookies.delete(AFFILIATE_COOKIE_NAME);
  response.cookies.delete(VISITOR_ID_COOKIE_NAME);
  return response;
}

/**
 * Build tracking query params for the redirect URL
 */
export function buildTrackingQueryParams(
  affiliateSlug: string,
  utmParams?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  }
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("ref", affiliateSlug);

  if (utmParams?.utmSource) params.set("utm_source", utmParams.utmSource);
  if (utmParams?.utmMedium) params.set("utm_medium", utmParams.utmMedium);
  if (utmParams?.utmCampaign) params.set("utm_campaign", utmParams.utmCampaign);
  if (utmParams?.utmContent) params.set("utm_content", utmParams.utmContent);

  return params;
}

/**
 * Extract UTM parameters from request URL
 */
export function extractUtmParams(url: URL): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
} {
  return {
    utmSource: url.searchParams.get("utm_source") || undefined,
    utmMedium: url.searchParams.get("utm_medium") || undefined,
    utmCampaign: url.searchParams.get("utm_campaign") || undefined,
    utmContent: url.searchParams.get("utm_content") || undefined,
  };
}
