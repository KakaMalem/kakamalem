import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy for handling custom domain routing
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

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Extract hostname without port for comparison
  const hostnameWithoutPort = hostname.split(":")[0];

  // Skip proxy for main domain
  if (
    MAIN_DOMAINS.some(
      (d) => hostnameWithoutPort === d || hostnameWithoutPort.endsWith(`.${d}`)
    )
  ) {
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
