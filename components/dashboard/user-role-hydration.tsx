"use client";

import { useLayoutEffect, useRef } from "react";
import { useUserRoleStore } from "@/lib/stores/use-user-role-store";
import type { StoreRole } from "@/lib/auth/context";

interface UserRoleHydrationProps {
  tenantId: string;
  role: StoreRole;
  isPlatformAdminOverride?: boolean;
}

/**
 * Hydrates the Zustand user role store from server-fetched data.
 *
 * This component should be rendered in a server component layout that has
 * already fetched the user's role at the current store. It bridges the
 * server → client gap by hydrating the client-side Zustand store.
 *
 * Uses useLayoutEffect to hydrate synchronously before paint, preventing
 * UI jitter while avoiding React's "setState during render" warning.
 *
 * @example
 * ```tsx
 * // In a server component layout
 * import { getUserStoreContext } from "@/lib/auth/context";
 *
 * const userContext = await getUserStoreContext(store.id);
 * const userRole = userContext?.role ?? null;
 *
 * return (
 *   <>
 *     <TenantSettingsHydration settings={settings} />
 *     <UserRoleHydration tenantId={store.id} role={userRole} />
 *     {children}
 *   </>
 * );
 * ```
 */
export function UserRoleHydration({
  tenantId,
  role,
  isPlatformAdminOverride = false,
}: UserRoleHydrationProps) {
  const lastTenantIdRef = useRef<string | null>(null);
  const lastRoleRef = useRef<StoreRole>(null);
  const lastOverrideRef = useRef<boolean>(false);

  // useLayoutEffect runs synchronously after DOM mutations but before paint
  // This prevents jitter while avoiding React's setState-during-render warning
  useLayoutEffect(() => {
    if (
      lastTenantIdRef.current !== tenantId ||
      lastRoleRef.current !== role ||
      lastOverrideRef.current !== isPlatformAdminOverride
    ) {
      useUserRoleStore
        .getState()
        .hydrate(tenantId, role, isPlatformAdminOverride);
      lastTenantIdRef.current = tenantId;
      lastRoleRef.current = role;
      lastOverrideRef.current = isPlatformAdminOverride;
    }
  }, [tenantId, role, isPlatformAdminOverride]);

  // This component doesn't render anything
  return null;
}
