"use client";

import { useRef } from "react";
import {
  useTenantSettingsStore,
  type TenantSettings,
} from "@/lib/stores/use-tenant-settings-store";

interface TenantSettingsHydrationProps {
  settings: TenantSettings;
}

/**
 * Hydrates the Zustand tenant settings store from server-fetched data.
 *
 * This component should be rendered in a server component layout that has
 * already fetched the tenant data. It bridges the server → client gap by
 * hydrating the client-side Zustand store with the server data.
 *
 * The store persists to localStorage for offline support, but will always
 * be re-hydrated with fresh server data on page load.
 *
 * IMPORTANT: Hydration happens synchronously during render (not in useEffect)
 * to prevent UI jitter. This ensures child components see the correct values
 * on their first render.
 *
 * @example
 * ```tsx
 * // In a server component layout
 * import { transformTenantToSettings } from "@/lib/utils/tenant-settings";
 *
 * const tenant = await getTenantBySlug(slug);
 * const settings = transformTenantToSettings(tenant);
 *
 * return (
 *   <>
 *     <TenantSettingsHydration settings={settings} />
 *     {children}
 *   </>
 * );
 * ```
 */
export function TenantSettingsHydration({
  settings,
}: TenantSettingsHydrationProps) {
  const hydratedRef = useRef(false);
  const lastSettingsIdRef = useRef<string | null>(null);

  // Hydrate synchronously during render (before children mount)
  // This prevents jitter by ensuring store has correct values on first render
  if (!hydratedRef.current || lastSettingsIdRef.current !== settings.id) {
    // Hydrate with fresh server data
    useTenantSettingsStore.getState().hydrate(settings);
    hydratedRef.current = true;
    lastSettingsIdRef.current = settings.id;
  }

  // This component doesn't render anything
  return null;
}
