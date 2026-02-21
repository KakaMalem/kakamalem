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
 * 3. Custom domain routing through existing [slug] route tree
 *
 * When a request comes from a custom domain (not kakamalem.com),
 * we rewrite it through the existing [slug] route tree using "custom-domain"
 * as a reserved placeholder slug. Layouts detect the x-custom-domain header
 * and resolve the tenant by domain instead of slug.
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
  // Custom domain internal slug
  "custom-domain",
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

    // Not an affiliate slug — set km_vid cookie for analytics on storefront pages
    if (pathname.startsWith("/store/")) {
      const response = NextResponse.next();
      if (!request.cookies.get("km_vid")) {
        response.cookies.set("km_vid", crypto.randomUUID(), {
          maxAge: 365 * 24 * 60 * 60,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }
      return response;
    }

    return NextResponse.next();
  }

  // Skip excluded paths (API routes, static files, etc.)
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // ==========================================================================
  // Custom Domain Routing
  // Rewrites custom domain requests through the existing [slug] route tree
  // using "custom-domain" as a reserved placeholder slug. The layouts/pages
  // detect the x-custom-domain header and resolve the tenant by domain.
  // ==========================================================================

  // If the custom domain path starts with /store/{anything}/, strip it and redirect.
  // This handles links generated with the old slug prefix (e.g., tuhfaa.com/store/tuhfaa/auth/login)
  const storePathMatch = pathname.match(/^\/store\/[^/]+(\/.*)?$/);
  if (storePathMatch) {
    const cleanPath = storePathMatch[1] || "/";
    const url = request.nextUrl.clone();
    url.pathname = cleanPath;
    return NextResponse.redirect(url, { status: 301 });
  }

  // Rewrite clean paths through the [slug] route tree with "custom-domain" as the slug
  // e.g., tuhfaa.com/auth/login → /store/custom-domain/auth/login
  const url = request.nextUrl.clone();
  url.pathname = `/store/custom-domain${pathname}`;

  // Pass the original host as a REQUEST header so server components can read it
  // via headers(). Using the request.headers option ensures the header is available
  // to downstream server components, layouts, and route handlers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-custom-domain", hostnameWithoutPort);

  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });

  // Set km_vid cookie for analytics tracking on custom domain storefronts
  if (!request.cookies.get("km_vid")) {
    response.cookies.set("km_vid", crypto.randomUUID(), {
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

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
