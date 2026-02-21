"use client";

import { StoreHeader } from "@/components/store/store-header";

import type { Tenant } from "@/lib/db/schema";
import type { StoreRole } from "@/lib/auth/context";
import type { HeaderConfig } from "@/lib/theme/layout-types";

interface StoreHeaderWrapperProps {
  store: Tenant;
  cartItemCount: number;
  user: { name?: string; email?: string; avatarUrl?: string } | null;
  userContext?: {
    isOwner: boolean;
    isStaff: boolean;
    isMember: boolean;
    role: StoreRole;
  } | null;
  /** Initial search query from server - passed to avoid hydration issues */
  initialSearchQuery?: string;
  /** Full header configuration from layout config */
  headerConfig?: HeaderConfig;
}

/**
 * Client component wrapper for StoreHeader.
 * Passes server-provided initialSearchQuery to avoid useSearchParams() hydration issues.
 */
export function StoreHeaderWrapper({
  store,
  cartItemCount,
  user,
  userContext,
  initialSearchQuery,
  headerConfig,
}: StoreHeaderWrapperProps) {
  return (
    <StoreHeader
      store={store}
      cartItemCount={cartItemCount}
      user={user}
      userContext={userContext}
      initialSearchQuery={initialSearchQuery}
      headerConfig={headerConfig}
    />
  );
}
