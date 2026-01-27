"use client";

import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";

// No-op storage for SSR
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// ============================================================================
// STORE TYPES
// ============================================================================

type WishlistSnapshot = {
  productIds: Set<string>;
  tenantId: string | null;
  timestamp: number;
};

type WishlistStoreState = {
  // State - Set of product IDs that are in wishlist
  productIds: Set<string>;
  tenantId: string | null;
  isHydrated: boolean;
  lastSyncedAt: number | null;

  // Computed
  count: number;

  // Hydration
  hydrate: (tenantId: string, productIds: string[]) => void;
  reset: () => void;

  // Check if product is in wishlist
  isInWishlist: (productId: string) => boolean;

  // Optimistic update methods (return previous state for rollback)
  addProduct: (productId: string) => WishlistSnapshot;
  removeProduct: (productId: string) => WishlistSnapshot;
  toggleProduct: (productId: string) => {
    snapshot: WishlistSnapshot;
    action: "added" | "removed";
  };

  // Rollback
  rollback: (snapshot: WishlistSnapshot) => void;

  // Sync state after successful mutation
  syncFromServer: (productIds: string[]) => void;
};

// ============================================================================
// STORE
// ============================================================================

export const useWishlistStore = create<WishlistStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      productIds: new Set<string>(),
      tenantId: null,
      isHydrated: false,
      lastSyncedAt: null,
      count: 0,

      // Hydrate from server data
      hydrate: (tenantId, productIds) => {
        const state = get();

        // Clear wishlist if switching to a different store
        if (state.tenantId && state.tenantId !== tenantId) {
          const newSet = new Set(productIds);
          set({
            productIds: newSet,
            tenantId,
            isHydrated: true,
            lastSyncedAt: Date.now(),
            count: newSet.size,
          });
          return;
        }

        const newSet = new Set(productIds);
        set({
          productIds: newSet,
          tenantId,
          isHydrated: true,
          lastSyncedAt: Date.now(),
          count: newSet.size,
        });
      },

      // Reset store
      reset: () => {
        set({
          productIds: new Set(),
          tenantId: null,
          isHydrated: false,
          lastSyncedAt: null,
          count: 0,
        });
      },

      // Check if product is in wishlist
      isInWishlist: (productId) => {
        return get().productIds.has(productId);
      },

      // Add product optimistically
      addProduct: (productId) => {
        const state = get();
        const snapshot: WishlistSnapshot = {
          productIds: new Set(state.productIds),
          tenantId: state.tenantId,
          timestamp: Date.now(),
        };

        const newSet = new Set(state.productIds);
        newSet.add(productId);

        set({
          productIds: newSet,
          count: newSet.size,
        });

        return snapshot;
      },

      // Remove product optimistically
      removeProduct: (productId) => {
        const state = get();
        const snapshot: WishlistSnapshot = {
          productIds: new Set(state.productIds),
          tenantId: state.tenantId,
          timestamp: Date.now(),
        };

        const newSet = new Set(state.productIds);
        newSet.delete(productId);

        set({
          productIds: newSet,
          count: newSet.size,
        });

        return snapshot;
      },

      // Toggle product (add if not exists, remove if exists)
      toggleProduct: (productId) => {
        const state = get();
        const snapshot: WishlistSnapshot = {
          productIds: new Set(state.productIds),
          tenantId: state.tenantId,
          timestamp: Date.now(),
        };

        const newSet = new Set(state.productIds);
        const wasInWishlist = newSet.has(productId);

        if (wasInWishlist) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);
        }

        set({
          productIds: newSet,
          count: newSet.size,
        });

        return {
          snapshot,
          action: wasInWishlist ? "removed" : "added",
        };
      },

      // Rollback to previous state
      rollback: (snapshot) => {
        set({
          productIds: snapshot.productIds,
          tenantId: snapshot.tenantId,
          count: snapshot.productIds.size,
        });
      },

      // Sync from server after successful mutation
      syncFromServer: (productIds) => {
        const newSet = new Set(productIds);
        set({
          productIds: newSet,
          lastSyncedAt: Date.now(),
          count: newSet.size,
        });
      },
    }),
    {
      name: "kaka-malem-wishlist",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        // Only persist these fields (convert Set to array for JSON)
        productIds: Array.from(state.productIds),
        tenantId: state.tenantId,
        count: state.count,
        lastSyncedAt: state.lastSyncedAt,
      }),
      // Custom merge to convert array back to Set
      merge: (persisted, current) => {
        const persistedState = persisted as {
          productIds?: string[];
          tenantId?: string | null;
          count?: number;
          lastSyncedAt?: number | null;
        };

        return {
          ...current,
          productIds: new Set(persistedState?.productIds || []),
          tenantId: persistedState?.tenantId ?? null,
          count: persistedState?.count ?? 0,
          lastSyncedAt: persistedState?.lastSyncedAt ?? null,
        };
      },
      // Skip hydration on server to prevent hydration mismatch
      skipHydration: true,
    }
  )
);

// ============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// ============================================================================

export function useWishlistCount() {
  return useWishlistStore((state) => state.count);
}

export function useWishlistIsHydrated() {
  return useWishlistStore((state) => state.isHydrated);
}

export function useWishlistTenantId() {
  return useWishlistStore((state) => state.tenantId);
}

export function useIsProductInWishlist(productId: string) {
  return useWishlistStore((state) => state.productIds.has(productId));
}

// ============================================================================
// ACTIONS (stable references, no re-renders)
// ============================================================================

export const wishlistActions = {
  hydrate: (tenantId: string, productIds: string[]) =>
    useWishlistStore.getState().hydrate(tenantId, productIds),
  reset: () => useWishlistStore.getState().reset(),
  isInWishlist: (productId: string) =>
    useWishlistStore.getState().isInWishlist(productId),
  addProduct: (productId: string) =>
    useWishlistStore.getState().addProduct(productId),
  removeProduct: (productId: string) =>
    useWishlistStore.getState().removeProduct(productId),
  toggleProduct: (productId: string) =>
    useWishlistStore.getState().toggleProduct(productId),
  rollback: (snapshot: WishlistSnapshot) =>
    useWishlistStore.getState().rollback(snapshot),
  syncFromServer: (productIds: string[]) =>
    useWishlistStore.getState().syncFromServer(productIds),
};

// Hook version for components that need reactive updates
export function useWishlistActions() {
  return wishlistActions;
}
