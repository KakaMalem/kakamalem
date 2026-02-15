"use client";

import { createContext, useContext } from "react";

const StorePathContext = createContext<string>("");

interface StorePathProviderProps {
  basePath: string;
  children: React.ReactNode;
}

/**
 * Provides the store base path to client components.
 * - Custom domain: basePath = "" (clean paths like /products)
 * - Main domain: basePath = "/store/{slug}" (prefixed paths)
 */
export function StorePathProvider({
  basePath,
  children,
}: StorePathProviderProps) {
  return (
    <StorePathContext.Provider value={basePath}>
      {children}
    </StorePathContext.Provider>
  );
}

/**
 * Get the store base path for building URLs in client components.
 * Usage: const basePath = useStoreBasePath();
 *        href={`${basePath}/products`}
 */
export function useStoreBasePath() {
  return useContext(StorePathContext);
}
