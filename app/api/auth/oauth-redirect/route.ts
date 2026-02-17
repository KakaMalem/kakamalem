import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// =============================================================================
// OAUTH REDIRECT FOR CUSTOM DOMAINS (Server-Side)
// =============================================================================
// When a user on a custom domain (e.g., tuhfaa.com) clicks "Sign in with Google",
// they are redirected to this endpoint on the main domain (kakamalem.com).
//
// This route calls Better Auth's sign-in handler SERVER-SIDE to get the OAuth
// authorization URL, then redirects the browser directly. No client-side
// JavaScript or fetch() is needed — this eliminates CORS, service worker,
// and browser compatibility issues entirely.
//
// Flow:
// 1. Custom domain → redirect to kakamalem.com/api/auth/oauth-redirect
// 2. This route calls auth.handler() to get Google/Facebook OAuth URL
// 3. Browser is redirected to the OAuth provider (with state cookie set)
// 4. After OAuth, callback → cross-domain-callback → token exchange
// =============================================================================

const VALID_PROVIDERS = ["google", "facebook"];

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  const returnDomain = request.nextUrl.searchParams.get("returnDomain");
  const returnPath = request.nextUrl.searchParams.get("returnPath") || "/";

  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return new Response("Invalid provider", { status: 400 });
  }

  if (
    !returnDomain ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(returnDomain)
  ) {
    return new Response("Invalid return domain", { status: 400 });
  }

  // After OAuth completes, Better Auth will redirect to this callback URL,
  // which transfers the session to the custom domain.
  const callbackURL = `/api/auth/cross-domain-callback?returnDomain=${encodeURIComponent(returnDomain)}&returnPath=${encodeURIComponent(returnPath)}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  try {
    // Call Better Auth's social sign-in handler SERVER-SIDE.
    // This creates the OAuth state, sets the state cookie, and returns the
    // authorization URL — all without client-side JavaScript.
    const signInRequest = new Request(`${appUrl}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appUrl,
      },
      body: JSON.stringify({
        provider,
        callbackURL,
      }),
    });

    const response = await auth.handler(signInRequest);

    // Better Auth always returns JSON for POST sign-in/social:
    // { url: "https://accounts.google.com/...", redirect: true }
    const data = await response.json();

    if (data.url) {
      const redirectResponse = NextResponse.redirect(data.url);

      // Forward Set-Cookie headers from Better Auth (OAuth state cookie).
      // This cookie is needed when Google redirects back to kakamalem.com
      // for Better Auth to validate the OAuth state parameter.
      const setCookies = response.headers.getSetCookie?.();
      if (setCookies) {
        for (const cookie of setCookies) {
          redirectResponse.headers.append("Set-Cookie", cookie);
        }
      }

      return redirectResponse;
    }

    // Better Auth didn't return a URL — provider might be misconfigured
    console.error("[oauth-redirect] No URL in Better Auth response:", data);
    return NextResponse.redirect(
      `https://${returnDomain}/auth/login?error=oauth_failed`
    );
  } catch (error) {
    console.error("[oauth-redirect] Failed to initiate OAuth:", error);
    return NextResponse.redirect(
      `https://${returnDomain}/auth/login?error=oauth_failed`
    );
  }
}
