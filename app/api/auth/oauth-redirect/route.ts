import { NextRequest } from "next/server";

// =============================================================================
// OAUTH REDIRECT FOR CUSTOM DOMAINS
// =============================================================================
// When a user on a custom domain (e.g., tuhfaa.com) clicks "Sign in with Google",
// we redirect them to this endpoint on the main domain (kakamalem.com).
// This page triggers the OAuth flow from the main domain so that:
// 1. The OAuth state cookie is set on kakamalem.com (where Google will redirect back)
// 2. The registered redirect_uri matches (kakamalem.com/api/auth/callback/google)
//
// After OAuth completes, the cross-domain-callback transfers the session back
// to the custom domain via a signed exchange token.
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

  // After OAuth, Better Auth will redirect to this callback URL
  const callbackURL = `/api/auth/cross-domain-callback?returnDomain=${encodeURIComponent(returnDomain)}&returnPath=${encodeURIComponent(returnPath)}`;

  // Serve a minimal HTML page that triggers the OAuth flow via fetch.
  // The fetch to /api/auth/sign-in/social is same-origin (on kakamalem.com),
  // so the OAuth state cookie is correctly set on kakamalem.com.
  // Values are safely embedded using JSON.stringify to prevent XSS.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signing in...</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#555}</style>
</head><body>
<p>Redirecting to sign-in provider...</p>
<script>
(async function() {
  try {
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: ${JSON.stringify(provider)}, callbackURL: ${JSON.stringify(callbackURL)} }),
      credentials: "include"
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      document.body.innerHTML = '<p>Failed to initiate sign-in. <a href="https://' + ${JSON.stringify(returnDomain)} + '/auth/login">Go back</a></p>';
    }
  } catch(e) {
    document.body.innerHTML = '<p>Failed to initiate sign-in. <a href="https://' + ${JSON.stringify(returnDomain)} + '/auth/login">Go back</a></p>';
  }
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
