"use client";

import { useEffect, useRef } from "react";
import { cartActions, type Cart } from "@/lib/stores/use-cart-store";

type CartProviderProps = {
  children: React.ReactNode;
  initialCart: Cart | null;
  storeSlug: string;
};

/**
 * Cart provider that:
 * 1. Always initializes the cart store with server data (source of truth)
 * 2. Clears stale localStorage data when switching stores
 * 3. Server data always wins to prevent stale cart bugs
 */
export function CartProvider({
  children,
  initialCart,
  storeSlug,
}: CartProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once per mount
    if (initialized.current) return;
    initialized.current = true;

    // Always use server data as the source of truth
    // This prevents stale localStorage data from causing cart bugs
    if (initialCart) {
      cartActions.hydrate(initialCart, storeSlug);
    } else {
      // Reset if no cart data
      cartActions.reset();
    }
  }, [initialCart, storeSlug]);

  return <>{children}</>;
}
