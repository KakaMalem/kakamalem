import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// =============================================================================
// TOKEN EXCHANGE FOR CUSTOM DOMAINS
// =============================================================================
// Validates a signed exchange token from the cross-domain-callback,
// sets the session cookie on the custom domain, and redirects to the store.
//
// The session cookie value is the same one Better Auth set on the main domain.
// Since both domains share the same database and BETTER_AUTH_SECRET, the session
// is valid on both domains.
// =============================================================================

// Match the cookie name Better Auth uses
const SESSION_COOKIE_NAME = process.env.NEXT_PUBLIC_APP_URL?.startsWith(
  "https://"
)
  ? "__Secure-kaka_malem.session_token"
  : "kaka_malem.session_token";

/**
 * Validate the HMAC-signed exchange token and extract the session cookie value.
 * Returns null if the token is invalid, expired, or for the wrong domain.
 */
function validateExchangeToken(
  token: string,
  expectedDomain: string
): string | null {
  const secret = process.env.BETTER_AUTH_SECRET!;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const hmac = token.slice(dotIndex + 1);

  const expectedHmac = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  // Timing-safe comparison to prevent timing attacks
  const hmacBuf = Buffer.from(hmac);
  const expectedBuf = Buffer.from(expectedHmac);
  if (hmacBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(hmacBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    );
    if (typeof payload.e !== "number" || payload.e < Date.now()) return null;
    if (payload.d !== expectedDomain) return null;
    if (typeof payload.c !== "string" || !payload.c) return null;
    return payload.c;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const returnPath = request.nextUrl.searchParams.get("returnPath") || "/";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Validate returnPath to prevent open redirect
  const safePath =
    returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? returnPath
      : "/";

  // Get the current domain from the Host header
  const host = request.headers.get("host")?.split(":")[0] || "";

  // Validate the exchange token (checks HMAC, expiry, and target domain)
  const sessionCookieValue = validateExchangeToken(token, host);
  if (!sessionCookieValue) {
    return NextResponse.redirect(
      new URL("/auth/login?error=token_invalid", request.url)
    );
  }

  // Set the session cookie on this custom domain and redirect
  const response = NextResponse.redirect(new URL(safePath, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days (matches auth session config)
  });

  return response;
}
