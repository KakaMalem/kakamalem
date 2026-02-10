import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  couldBeAffiliateSlug,
  generateVisitorId,
  extractUtmParams,
  VISITOR_ID_COOKIE_NAME,
} from "@/lib/affiliate/tracking";

/**
 * Proxy for handling:
 * 1. SEO: www → non-www redirect (canonical consolidation)
 * 2. Platform affiliate vanity URLs (e.g., kakamalem.com/matee)
 * 3. Custom domain routing to internal _custom route
 *
 * When a request comes from a custom domain (not kakamalem.com),
 * we rewrite it to the internal _custom route handler which will
 * look up the tenant by domain and render the appropriate storefront.
 */

// Main domain and its variations that should NOT be treated as custom domains
const MAIN_DOMAINS = [
  "kakamalem.com",
  "www.kakamalem.com",
  "localhost",
  "127.0.0.1",
];

// Paths that should never be rewritten (API routes, assets, etc.)
const EXCLUDED_PATHS = [
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/uploads/",
  "/manifest.json",
  "/sw.js",
];

// Reserved paths that are NOT affiliate slugs
const RESERVED_PATHS = new Set([
  // Legal pages
  "terms",
  "privacy",
  "data-deletion",
  // Auth routes
  "auth",
  "login",
  "signup",
  "logout",
  "confirm",
  "error",
  "complete-profile",
  "forgot-password",
  "reset-password",
  // App routes
  "dashboard",
  "store",
  "admin",
  "invoice",
  "marketplace",
  // API/System routes
  "api",
  "uploads",
  // Affiliate routes
  "affiliate",
  "affiliates",
  "become-affiliate",
  // Error pages
  "404",
  "500",
  // Other Next.js routes
  "_next",
]);

export default function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Extract hostname without port for comparison
  const hostnameWithoutPort = hostname.split(":")[0];

  // ==========================================================================
  // SEO: Redirect www.kakamalem.com → kakamalem.com (301 permanent)
  // This consolidates SEO authority to the canonical non-www domain
  // ==========================================================================
  if (hostnameWithoutPort === "www.kakamalem.com") {
    const url = request.nextUrl.clone();
    url.host = "kakamalem.com";
    return NextResponse.redirect(url, { status: 301 });
  }

  // Check if this is the main domain
  const isMainDomain = MAIN_DOMAINS.some(
    (d) => hostnameWithoutPort === d || hostnameWithoutPort.endsWith(`.${d}`)
  );

  // ==========================================================================
  // Platform Affiliate Vanity URLs (e.g., kakamalem.com/matee)
  // Only for main domain, root-level paths that could be affiliate slugs
  // ==========================================================================
  if (isMainDomain) {
    const pathSegments = pathname.split("/").filter(Boolean);

    // Only handle root-level paths (e.g., /matee, NOT /store/xyz)
    if (pathSegments.length === 1) {
      const potentialSlug = pathSegments[0].toLowerCase();

      // Check if this could be an affiliate slug (not reserved, valid format)
      if (
        !RESERVED_PATHS.has(potentialSlug) &&
        couldBeAffiliateSlug(potentialSlug)
      ) {
        // Rewrite to affiliate verification page
        // The page will verify the affiliate and handle tracking/redirect
        const url = request.nextUrl.clone();
        url.pathname = `/affiliate/redirect/${potentialSlug}`;

        // Preserve UTM params
        const utmParams = extractUtmParams(request.nextUrl);
        if (utmParams.utmSource)
          url.searchParams.set("utm_source", utmParams.utmSource);
        if (utmParams.utmMedium)
          url.searchParams.set("utm_medium", utmParams.utmMedium);
        if (utmParams.utmCampaign)
          url.searchParams.set("utm_campaign", utmParams.utmCampaign);
        if (utmParams.utmContent)
          url.searchParams.set("utm_content", utmParams.utmContent);

        // Pass visitor ID if exists, or generate new one
        const existingVisitorId = request.cookies.get(
          VISITOR_ID_COOKIE_NAME
        )?.value;
        const visitorId = existingVisitorId || generateVisitorId();
        url.searchParams.set("vid", visitorId);

        // Pass referrer info
        const referrer = request.headers.get("referer");
        if (referrer) {
          url.searchParams.set("referrer", referrer);
        }

        return NextResponse.rewrite(url);
      }
    }

    // Not an affiliate slug, continue normally
    return NextResponse.next();
  }

  // Skip excluded paths (API routes, static files, etc.)
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // This is a custom domain request - rewrite to the _custom route
  // The _custom route will look up the tenant by domain and render the storefront
  const url = request.nextUrl.clone();
  url.pathname = `/store/_custom${pathname}`;

  // Pass the original host in a header for the route handler to use
  const response = NextResponse.rewrite(url);
  response.headers.set("x-custom-domain", hostnameWithoutPort);

  return response;
}

export const config = {
  // Match all paths except static files and images
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
