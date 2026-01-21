"use client";

import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  Cart,
  CartItem,
  CartPriceTier,
  CartSnapshot,
} from "@/lib/types/cart";

// Re-export types for convenience
export type { Cart, CartItem, CartPriceTier, CartSnapshot };

// No-op storage for SSR
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// ============================================================================
// HELPERS
// ============================================================================

function calculateItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Get the applicable tier price for a given quantity
 */
export function getApplicableTierPrice(
  basePrice: number,
  quantity: number,
  priceTiers: CartPriceTier[]
): number {
  if (!priceTiers || priceTiers.length === 0) return basePrice;

  // Sort by minQuantity descending to find the highest applicable tier
  const sortedTiers = [...priceTiers].sort(
    (a, b) => b.minQuantity - a.minQuantity
  );

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        return parseFloat(tier.price);
      }
    }
  }

  return basePrice;
}

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);
    const effectivePrice = getApplicableTierPrice(
      basePrice,
      item.quantity,
      item.product.priceTiers || []
    );
    return sum + effectivePrice * item.quantity;
  }, 0);
}

function calculateSavings(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);
    const effectivePrice = getApplicableTierPrice(
      basePrice,
      item.quantity,
      item.product.priceTiers || []
    );
    const savings = (basePrice - effectivePrice) * item.quantity;
    return sum + Math.max(0, savings);
  }, 0);
}

// ============================================================================
// STORE TYPES
// ============================================================================

type CartStoreState = {
  // State
  items: CartItem[];
  tenantId: string | null;
  storeSlug: string | null;
  isHydrated: boolean;
  lastSyncedAt: number | null;

  // UI State
  isOpen: boolean;

  // Computed (cached for performance)
  itemCount: number;
  subtotal: number;
  savings: number;

  // Hydration
  hydrate: (cart: Cart, storeSlug: string) => void;
  reset: () => void;

  // UI Actions
  setIsOpen: (open: boolean) => void;
  toggleCart: () => void;

  // Optimistic update methods (return previous state for rollback)
  addItem: (item: CartItem) => CartSnapshot;
  updateItemQuantity: (itemId: string, quantity: number) => CartSnapshot;
  removeItem: (itemId: string) => CartSnapshot;
  clearItems: () => CartSnapshot;
  setItems: (items: CartItem[]) => CartSnapshot;

  // Rollback
  rollback: (snapshot: CartSnapshot) => void;

  // Sync state after successful mutation
  syncFromServer: (cart: Cart) => void;
};

// ============================================================================
// STORE
// ============================================================================

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      tenantId: null,
      storeSlug: null,
      isHydrated: false,
      lastSyncedAt: null,
      isOpen: false,
      itemCount: 0,
      subtotal: 0,
      savings: 0,

      // Hydrate from server data (called by CartProvider)
      hydrate: (cart, storeSlug) => {
        const state = get();

        // Clear cart if switching to a different store
        if (state.tenantId && state.tenantId !== cart.tenantId) {
          set({
            items: [],
            tenantId: cart.tenantId,
            storeSlug,
            isHydrated: true,
            lastSyncedAt: Date.now(),
            itemCount: 0,
            subtotal: 0,
            savings: 0,
          });
          return;
        }

        const items = cart.items;
        set({
          items,
          tenantId: cart.tenantId,
          storeSlug,
          isHydrated: true,
          lastSyncedAt: Date.now(),
          itemCount: calculateItemCount(items),
          subtotal: calculateSubtotal(items),
          savings: calculateSavings(items),
        });
      },

      // Reset store (on logout or tenant switch)
      reset: () => {
        set({
          items: [],
          tenantId: null,
          storeSlug: null,
          isHydrated: false,
          lastSyncedAt: null,
          itemCount: 0,
          subtotal: 0,
          savings: 0,
        });
      },

      // UI Actions
      setIsOpen: (isOpen) => set({ isOpen }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      // ========================================================================
      // OPTIMISTIC UPDATE METHODS
      // All return a snapshot for rollback
      // ========================================================================

      addItem: (item) => {
        const state = get();
        const snapshot: CartSnapshot = {
          items: state.items,
          tenantId: state.tenantId,
          storeSlug: state.storeSlug,
          timestamp: Date.now(),
        };

        const existingIndex = state.items.findIndex(
          (i) =>
            i.productId === item.productId && i.variantId === item.variantId
        );

        let newItems: CartItem[];
        if (existingIndex > -1) {
          // Update existing item quantity
          newItems = state.items.map((i, index) =>
            index === existingIndex
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          );
        } else {
          // Add new item
          newItems = [...state.items, item];
        }

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
          savings: calculateSavings(newItems),
        });

        return snapshot;
      },

      updateItemQuantity: (itemId, quantity) => {
        const state = get();
        const snapshot: CartSnapshot = {
          items: state.items,
          tenantId: state.tenantId,
          storeSlug: state.storeSlug,
          timestamp: Date.now(),
        };

        const newItems = state.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        );

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
          savings: calculateSavings(newItems),
        });

        return snapshot;
      },

      removeItem: (itemId) => {
        const state = get();
        const snapshot: CartSnapshot = {
          items: state.items,
          tenantId: state.tenantId,
          storeSlug: state.storeSlug,
          timestamp: Date.now(),
        };

        const newItems = state.items.filter((item) => item.id !== itemId);

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
          savings: calculateSavings(newItems),
        });

        return snapshot;
      },

      clearItems: () => {
        const state = get();
        const snapshot: CartSnapshot = {
          items: state.items,
          tenantId: state.tenantId,
          storeSlug: state.storeSlug,
          timestamp: Date.now(),
        };

        set({
          items: [],
          itemCount: 0,
          subtotal: 0,
          savings: 0,
        });

        return snapshot;
      },

      setItems: (items) => {
        const state = get();
        const snapshot: CartSnapshot = {
          items: state.items,
          tenantId: state.tenantId,
          storeSlug: state.storeSlug,
          timestamp: Date.now(),
        };

        set({
          items,
          itemCount: calculateItemCount(items),
          subtotal: calculateSubtotal(items),
          savings: calculateSavings(items),
        });

        return snapshot;
      },

      // Rollback to previous state (on mutation failure)
      rollback: (snapshot) => {
        set({
          items: snapshot.items,
          tenantId: snapshot.tenantId,
          storeSlug: snapshot.storeSlug,
          itemCount: calculateItemCount(snapshot.items),
          subtotal: calculateSubtotal(snapshot.items),
          savings: calculateSavings(snapshot.items),
        });
      },

      // Sync from server after successful mutation
      syncFromServer: (cart) => {
        set({
          items: cart.items,
          tenantId: cart.tenantId,
          lastSyncedAt: Date.now(),
          itemCount: calculateItemCount(cart.items),
          subtotal: calculateSubtotal(cart.items),
          savings: calculateSavings(cart.items),
        });
      },
    }),
    {
      name: "kaka-malem-cart",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        // Only persist these fields
        items: state.items,
        tenantId: state.tenantId,
        storeSlug: state.storeSlug,
        itemCount: state.itemCount,
        subtotal: state.subtotal,
        savings: state.savings,
        lastSyncedAt: state.lastSyncedAt,
      }),
      // Skip hydration on server to prevent hydration mismatch
      skipHydration: true,
    }
  )
);

// ============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// ============================================================================

export function useCartItems() {
  return useCartStore((state) => state.items);
}

export function useCartItemCount() {
  return useCartStore((state) => state.itemCount);
}

export function useCartSubtotal() {
  return useCartStore((state) => state.subtotal);
}

export function useCartSavings() {
  return useCartStore((state) => state.savings);
}

export function useCartIsOpen() {
  return useCartStore((state) => state.isOpen);
}

export function useCartIsHydrated() {
  return useCartStore((state) => state.isHydrated);
}

export function useCartTenant() {
  return useCartStore(
    useShallow((state) => ({
      tenantId: state.tenantId,
      storeSlug: state.storeSlug,
    }))
  );
}

export function useCartTotals() {
  return useCartStore(
    useShallow((state) => ({
      itemCount: state.itemCount,
      subtotal: state.subtotal,
      savings: state.savings,
    }))
  );
}

// ============================================================================
// ACTIONS (stable references, no re-renders)
// ============================================================================

export const cartActions = {
  hydrate: (cart: Cart, storeSlug: string) =>
    useCartStore.getState().hydrate(cart, storeSlug),
  reset: () => useCartStore.getState().reset(),
  setIsOpen: (open: boolean) => useCartStore.getState().setIsOpen(open),
  toggleCart: () => useCartStore.getState().toggleCart(),
  addItem: (item: CartItem) => useCartStore.getState().addItem(item),
  updateItemQuantity: (itemId: string, quantity: number) =>
    useCartStore.getState().updateItemQuantity(itemId, quantity),
  removeItem: (itemId: string) => useCartStore.getState().removeItem(itemId),
  clearItems: () => useCartStore.getState().clearItems(),
  clearCart: () => useCartStore.getState().clearItems(), // Alias for clearItems
  setItems: (items: CartItem[]) => useCartStore.getState().setItems(items),
  rollback: (snapshot: CartSnapshot) =>
    useCartStore.getState().rollback(snapshot),
  syncFromServer: (cart: Cart) => useCartStore.getState().syncFromServer(cart),
};

// Hook version for components that need reactive updates
export function useCartActions() {
  return cartActions;
}
