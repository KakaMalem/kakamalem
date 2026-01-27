"use client";

import { useRef, useLayoutEffect } from "react";
import { useSubscriptionStore } from "@/lib/stores/use-subscription-store";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";

interface SubscriptionHydrationProps {
  tenantId: string;
  subscription: SubscriptionOverview;
}

/**
 * Hydrates the Zustand subscription store from server-fetched data.
 *
 * This component should be rendered in the store-specific layout that has
 * already fetched the subscription data. It bridges the server → client gap
 * by hydrating the client-side Zustand store with the server data.
 *
 * Uses useLayoutEffect to hydrate synchronously after render but before paint,
 * preventing UI jitter while following React's rules about state updates.
 *
 * @example
 * ```tsx
 * // In the store-specific layout (app/dashboard/[slug]/layout.tsx)
 * const subscription = await getSubscriptionOverview(store.id);
 *
 * return (
 *   <>
 *     <SubscriptionHydration tenantId={store.id} subscription={subscription} />
 *     {children}
 *   </>
 * );
 * ```
 */
export function SubscriptionHydration({
  tenantId,
  subscription,
}: SubscriptionHydrationProps) {
  const lastTenantIdRef = useRef<string | null>(null);

  // Hydrate synchronously after render but before paint
  // useLayoutEffect runs before the browser paints, preventing visual jitter
  useLayoutEffect(() => {
    if (lastTenantIdRef.current !== tenantId) {
      useSubscriptionStore.getState().hydrate(tenantId, subscription);
      lastTenantIdRef.current = tenantId;
    }
  }, [tenantId, subscription]);

  // This component doesn't render anything
  return null;
}
