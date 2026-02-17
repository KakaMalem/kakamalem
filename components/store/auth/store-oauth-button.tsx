"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStoreBasePath } from "@/components/store/store-path-provider";

type Provider = "google" | "facebook";

interface StoreOAuthButtonProps {
  provider: Provider;
  storeSlug: string;
  redirectTo?: string;
}

const providerConfig = {
  google: {
    label: "Continue with Google",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  facebook: {
    label: "Continue with Facebook",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        />
      </svg>
    ),
  },
};

export function StoreOAuthButton({
  provider,
  storeSlug: _storeSlug,
  redirectTo,
}: StoreOAuthButtonProps) {
  const basePath = useStoreBasePath();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = providerConfig[provider];

  // Build the callback URL that includes store context
  const callbackURL = redirectTo || basePath;

  async function handleOAuth() {
    setIsLoading(true);
    setError(null);

    // Detect custom domain by comparing hostname against the main app domain.
    // This is more reliable than checking basePath === "" because it directly
    // checks the browser's actual origin rather than relying on server-side
    // context propagation through React providers.
    const mainDomain =
      process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
    const mainHostname = new URL(mainDomain).hostname;
    const currentHostname = window.location.hostname;
    const isCustomDomain =
      currentHostname !== mainHostname &&
      currentHostname !== "localhost" &&
      currentHostname !== "127.0.0.1";

    // On custom domains, OAuth must go through the main domain because:
    // 1. Google's registered redirect_uri points to kakamalem.com
    // 2. OAuth state cookies must be on the same domain as the callback
    // The oauth-redirect endpoint handles everything server-side and redirects
    // the browser directly to the OAuth provider (no client-side fetch needed).
    if (isCustomDomain) {
      const returnDomain = currentHostname;
      const returnPath = redirectTo || "/";
      window.location.href = `${mainDomain}/api/auth/oauth-redirect?provider=${provider}&returnDomain=${encodeURIComponent(returnDomain)}&returnPath=${encodeURIComponent(returnPath)}`;
      return;
    }

    try {
      // On the main domain, use Better Auth's client directly.
      // The redirect plugin will navigate to the OAuth provider.
      await authClient.signIn.social({
        provider,
        callbackURL,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setIsLoading(false);
    }
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleOAuth}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            {config.icon}
            {config.label}
          </>
        )}
      </Button>
    </>
  );
}
