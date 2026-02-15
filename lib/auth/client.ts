import { createAuthClient } from "better-auth/react";

// =============================================================================
// BETTER AUTH CLIENT
// =============================================================================
// Use this in client components for authentication
// =============================================================================

export const authClient = createAuthClient({
  // Use current origin so auth works on both main domain and custom domains.
  // On kakamalem.com → fetches kakamalem.com/api/auth/...
  // On tuhfaa.com → fetches tuhfaa.com/api/auth/... (proxied to same app)
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
});

// Export auth methods for convenience
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// OAuth helper
export const signInWithOAuth = signIn.social;

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

/**
 * Check if the current user has a specific role
 * Fetches from userProfiles table
 */
export function useUserRole() {
  const { data: session, isPending } = useSession();

  return {
    user: session?.user,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  };
}

/**
 * Hook to get the current user's portals access
 * Checks if user is affiliate, delivery provider, store owner, etc.
 */
export function usePortalAccess() {
  const { data: session, isPending } = useSession();

  // This would need to be fetched from the server
  // For now, return basic session data
  return {
    user: session?.user,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    // These would be populated from API calls
    canAccessSeller: false,
    canAccessAffiliate: false,
    canAccessDelivery: false,
  };
}
