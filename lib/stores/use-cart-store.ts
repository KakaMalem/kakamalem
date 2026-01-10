"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ============================================================================
// TYPES
// ============================================================================

// Local type definitions to avoid issues with server action bundling
export type CartPriceTier = {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  price: string;
};

export type CartItemProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: "draft" | "active" | "archived";
  hasVariants: boolean;
  image: {
    url: string;
    altText: string | null;
  } | null;
  priceTiers: CartPriceTier[];
};

export type CartItemVariant = {
  id: string;
  displayName: string | null;
  price: string | null;
  stock: number;
  isActive: boolean;
} | null;

export type CartItem = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: CartItemProduct;
  variant: CartItemVariant;
};

export type Cart = {
  id: string;
  tenantId: string;
  sessionId: string | null;
  customerId: string | null;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

type CartStore = {
  // State
  items: CartItem[];
  tenantId: string | null;
  storeSlug: string | null;
  isLoading: boolean;
  isOpen: boolean; // For cart drawer/sidebar

  // Computed values
  itemCount: number;
  subtotal: number;

  // Actions
  setCart: (cart: Cart | null, storeSlug: string) => void;
  setItems: (items: CartItem[]) => void;
  setTenant: (tenantId: string, storeSlug: string) => void;
  clearCart: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsOpen: (open: boolean) => void;
  toggleCart: () => void;

  // Optimistic updates
  addItemOptimistic: (item: CartItem) => void;
  updateItemOptimistic: (itemId: string, quantity: number) => void;
  removeItemOptimistic: (itemId: string) => void;
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
function getApplicableTierPrice(
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
    // Apply tier pricing if available
    const effectivePrice = getApplicableTierPrice(
      basePrice,
      item.quantity,
      item.product.priceTiers || []
    );
    return sum + effectivePrice * item.quantity;
  }, 0);
}

/**
 * Export for use in components
 */
export { getApplicableTierPrice };

// ============================================================================
// STORE
// ============================================================================

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      tenantId: null,
      storeSlug: null,
      isLoading: false,
      isOpen: false,
      itemCount: 0,
      subtotal: 0,

      // Set entire cart from server
      setCart: (cart, storeSlug) => {
        if (!cart) {
          set({
            items: [],
            tenantId: null,
            storeSlug: null,
            itemCount: 0,
            subtotal: 0,
          });
          return;
        }

        const items = cart.items;
        set({
          items,
          tenantId: cart.tenantId,
          storeSlug,
          itemCount: calculateItemCount(items),
          subtotal: calculateSubtotal(items),
        });
      },

      // Update items only
      setItems: (items) => {
        set({
          items,
          itemCount: calculateItemCount(items),
          subtotal: calculateSubtotal(items),
        });
      },

      // Set tenant context
      setTenant: (tenantId, storeSlug) => {
        const state = get();
        // Clear cart if switching to a different store
        if (state.tenantId && state.tenantId !== tenantId) {
          set({
            items: [],
            tenantId,
            storeSlug,
            itemCount: 0,
            subtotal: 0,
          });
        } else {
          set({ tenantId, storeSlug });
        }
      },

      // Clear cart
      clearCart: () => {
        set({
          items: [],
          itemCount: 0,
          subtotal: 0,
        });
      },

      // Loading state
      setIsLoading: (isLoading) => set({ isLoading }),

      // Cart drawer state
      setIsOpen: (isOpen) => set({ isOpen }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      // Optimistic add
      addItemOptimistic: (item) => {
        const items = get().items;
        const existingIndex = items.findIndex(
          (i) =>
            i.productId === item.productId && i.variantId === item.variantId
        );

        let newItems: CartItem[];
        if (existingIndex > -1) {
          // Update existing item quantity
          newItems = items.map((i, index) =>
            index === existingIndex
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          );
        } else {
          // Add new item
          newItems = [...items, item];
        }

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
        });
      },

      // Optimistic update quantity
      updateItemOptimistic: (itemId, quantity) => {
        const items = get().items;
        const newItems = items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        );

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
        });
      },

      // Optimistic remove
      removeItemOptimistic: (itemId) => {
        const items = get().items;
        const newItems = items.filter((item) => item.id !== itemId);

        set({
          items: newItems,
          itemCount: calculateItemCount(newItems),
          subtotal: calculateSubtotal(newItems),
        });
      },
    }),
    {
      name: "kaka-malem-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        items: state.items,
        tenantId: state.tenantId,
        storeSlug: state.storeSlug,
        itemCount: state.itemCount,
        subtotal: state.subtotal,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
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

export function useCartIsOpen() {
  return useCartStore((state) => state.isOpen);
}

export function useCartIsLoading() {
  return useCartStore((state) => state.isLoading);
}

// Get actions directly from the store (stable references, no re-renders)
export const cartActions = {
  setCart: (cart: Cart | null, storeSlug: string) =>
    useCartStore.getState().setCart(cart, storeSlug),
  setItems: (items: CartItem[]) => useCartStore.getState().setItems(items),
  setTenant: (tenantId: string, storeSlug: string) =>
    useCartStore.getState().setTenant(tenantId, storeSlug),
  clearCart: () => useCartStore.getState().clearCart(),
  setIsLoading: (loading: boolean) =>
    useCartStore.getState().setIsLoading(loading),
  setIsOpen: (open: boolean) => useCartStore.getState().setIsOpen(open),
  toggleCart: () => useCartStore.getState().toggleCart(),
  addItemOptimistic: (item: CartItem) =>
    useCartStore.getState().addItemOptimistic(item),
  updateItemOptimistic: (itemId: string, quantity: number) =>
    useCartStore.getState().updateItemOptimistic(itemId, quantity),
  removeItemOptimistic: (itemId: string) =>
    useCartStore.getState().removeItemOptimistic(itemId),
};

// Hook version for components that need reactive updates
export function useCartActions() {
  return cartActions;
}
