import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// =============================================================================
// PROXY (Next.js 16)
// =============================================================================
// Handles route protection and redirects
// Replaces middleware.ts - runs on Node.js runtime
// Uses full session validation with database checks
// =============================================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // -------------------------------------------------------------------------
  // ROUTE PATTERNS
  // -------------------------------------------------------------------------
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isApiRoute = pathname.startsWith("/api");
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/store/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  // Helper to create response with pathname header (for layouts to access current path)
  const nextWithPathname = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  };

  // Skip proxy for API routes (Better Auth handles its own routes)
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Skip for public routes
  if (isPublicRoute && !isProtectedRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // SESSION CHECK (Full validation with database)
  // -------------------------------------------------------------------------
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const hasSession = !!session;

  // -------------------------------------------------------------------------
  // PROTECTED ROUTES
  // -------------------------------------------------------------------------
  if (isProtectedRoute && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // -------------------------------------------------------------------------
  // AUTH ROUTES (login/signup)
  // -------------------------------------------------------------------------
  // Redirect authenticated users away from auth pages
  if (isAuthRoute && hasSession) {
    const redirectTo =
      request.nextUrl.searchParams.get("redirect") || "/dashboard";
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  // Use nextWithPathname for dashboard routes so layouts can determine current store
  return nextWithPathname();
}

// -------------------------------------------------------------------------
// MATCHER CONFIG
// -------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
