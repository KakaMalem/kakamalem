"use client";

import { useEffect, useRef } from "react";
import { wishlistActions } from "@/lib/stores/use-wishlist-store";

type WishlistHydrationProps = {
  tenantId: string;
  initialProductIds: string[];
};

/**
 * Wishlist hydration component that:
 * 1. Always initializes the wishlist store with server data (source of truth)
 * 2. Clears stale localStorage data when switching stores
 * 3. Server data always wins to prevent stale wishlist bugs
 *
 * Place this component in the store layout to hydrate wishlist state.
 */
export function WishlistHydration({
  tenantId,
  initialProductIds,
}: WishlistHydrationProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once per mount
    if (initialized.current) return;
    initialized.current = true;

    // Always use server data as the source of truth
    wishlistActions.hydrate(tenantId, initialProductIds);
  }, [tenantId, initialProductIds]);

  return null;
}
