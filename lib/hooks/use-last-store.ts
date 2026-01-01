"use client";

import { useEffect } from "react";

const LAST_STORE_KEY = "kaka-malem-last-store";

export function getLastStoreSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_STORE_KEY);
}

export function setLastStoreSlug(slug: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_STORE_KEY, slug);
}

/**
 * Hook that automatically saves the current store slug to localStorage
 * when it changes. Call this in components that need to track the current store.
 */
export function useLastStore(currentSlug: string | null | undefined): void {
  useEffect(() => {
    if (currentSlug) {
      setLastStoreSlug(currentSlug);
    }
  }, [currentSlug]);
}
