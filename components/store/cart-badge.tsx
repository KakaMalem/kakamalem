"use client";

import { useSyncExternalStore } from "react";
import { useCartItemCount } from "@/lib/stores/use-cart-store";

// Helper for hydration-safe mounting detection
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}

interface CartBadgeProps {
  initialCount?: number;
}

/**
 * Client component that shows cart item count from Zustand store
 * Handles hydration mismatch by showing server count initially
 */
export function CartBadge({ initialCount = 0 }: CartBadgeProps) {
  const isHydrated = useHydrated();
  const storeCount = useCartItemCount();

  // Use server count until hydrated to prevent mismatch
  const count = isHydrated ? storeCount : initialCount;

  if (count === 0) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Hook to get cart count that's safe for SSR
 */
export function useHydratedCartCount(serverCount: number) {
  const isHydrated = useHydrated();
  const storeCount = useCartItemCount();

  return isHydrated ? storeCount : serverCount;
}
