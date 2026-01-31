"use client";

import { useEffect, useRef } from "react";
import { clearCartSessionAction } from "@/lib/actions/checkout";

/**
 * Client component that clears the cart session on mount.
 * Used on the order success page to ensure cart is cleared after checkout.
 * Renders nothing - just performs the side effect.
 */
export function ClearCartSession() {
  const hasCleared = useRef(false);

  useEffect(() => {
    // Only clear once per mount
    if (hasCleared.current) return;
    hasCleared.current = true;

    clearCartSessionAction().catch((error) => {
      console.error("Failed to clear cart session:", error);
    });
  }, []);

  return null;
}
