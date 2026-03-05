import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

// =============================================================================
// CROSS-DOMAIN CALLBACK
// =============================================================================
// After OAuth completes on the main domain, Better Auth redirects here.
// This endpoint reads the session cookie (set on kakamalem.com by Better Auth),
// creates a short-lived signed exchange token containing the cookie value,
// and redirects to the custom domain's token-exchange endpoint.
// =============================================================================

// Match the cookie name Better Auth uses
const SESSION_COOKIE_NAME = process.env.NEXT_PUBLIC_APP_URL?.startsWith(
  "https://"
)
  ? "__Secure-kaka_malem.session_token"
  : "kaka_malem.session_token";

/**
 * Create a short-lived HMAC-signed token containing the session cookie value.
 * The token is bound to a specific target domain and expires in 60 seconds.
 */
function createExchangeToken(
  cookieValue: string,
  targetDomain: string
): string {
  const secret = process.env.BETTER_AUTH_SECRET!;
  const payload = JSON.stringify({
    c: cookieValue, // session cookie value (includes Better Auth's HMAC signature)
    d: targetDomain, // target domain (prevents token reuse on other domains)
    e: Date.now() + 60000, // expires in 60 seconds
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const hmac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${hmac}`;
}

export async function GET(request: NextRequest) {
  const returnDomain = request.nextUrl.searchParams.get("returnDomain");
  const returnPath = request.nextUrl.searchParams.get("returnPath") || "/";

  if (!returnDomain) {
    return NextResponse.json(
      { error: "Missing returnDomain" },
      { status: 400 }
    );
  }

  // Validate returnPath to prevent open redirect
  const safePath =
    returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? returnPath
      : "/";

  // Explicitly reconstruct the origin from headers to avoid Docker internal hostname
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const protocol = request.nextUrl.protocol || "https:";
  const currentOrigin = `${protocol}//${hostname}`;

  // Read the session cookie that Better Auth set during the OAuth callback.
  // This cookie is on kakamalem.com (the main domain where OAuth happened).
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    // OAuth failed or session cookie wasn't set — redirect to login with error
    return NextResponse.redirect(
      `https://${returnDomain}/auth/login?error=oauth_failed`
    );
  }

  // Create a signed exchange token with the session cookie value
  const exchangeToken = createExchangeToken(sessionCookie.value, returnDomain);

  // Redirect to the custom domain's token exchange endpoint
  return NextResponse.redirect(
    `https://${returnDomain}/api/auth/token-exchange?token=${encodeURIComponent(exchangeToken)}&returnPath=${encodeURIComponent(safePath)}`
  );
}
