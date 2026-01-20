"use client";

import {
  useCartStore,
  useCartItems,
  useCartItemCount,
  useCartSubtotal,
  useCartSavings,
  useCartIsOpen,
  useCartIsHydrated,
  useCartTenant,
  useCartTotals,
  cartActions,
  getApplicableTierPrice,
} from "@/lib/stores/use-cart-store";
import {
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
  useRefetchCartMutation,
  useDebouncedUpdateMutation,
  cartKeys,
} from "@/lib/hooks/use-cart-mutations";
import type { CartItemProduct, CartItemVariant } from "@/lib/types/cart";

// ============================================================================
// MAIN HOOK: useCart
// ============================================================================

type UseCartOptions = {
  /**
   * Enable debounced quantity updates (default: true)
   * Useful for quantity inputs where users might type/click rapidly
   */
  debounce?: boolean;
  /**
   * Debounce delay in milliseconds (default: 400)
   */
  debounceMs?: number;
};

/**
 * Primary hook for cart operations.
 *
 * Combines Zustand state (for instant reads) with TanStack Query mutations
 * (for optimistic updates with rollback).
 *
 * @example
 * ```tsx
 * function ProductCard({ product }) {
 *   const { addToCart, isAdding } = useCart();
 *
 *   return (
 *     <Button
 *       onClick={() => addToCart(product.id, 1, null, product)}
 *       disabled={isAdding}
 *     >
 *       {isAdding ? "Adding..." : "Add to Cart"}
 *     </Button>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * function CartItem({ item }) {
 *   const { updateQuantity, removeItem, isUpdating } = useCart();
 *
 *   return (
 *     <div>
 *       <QuantitySelector
 *         value={item.quantity}
 *         onChange={(qty) => updateQuantity(item.id, qty)}
 *         disabled={isUpdating}
 *       />
 *       <Button onClick={() => removeItem(item.id)}>Remove</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCart(options: UseCartOptions = {}) {
  const { debounce = true, debounceMs = 400 } = options;

  // Zustand state (instant access)
  const items = useCartItems();
  const itemCount = useCartItemCount();
  const subtotal = useCartSubtotal();
  const savings = useCartSavings();
  const isOpen = useCartIsOpen();
  const isHydrated = useCartIsHydrated();
  const { tenantId, storeSlug } = useCartTenant();

  // TanStack Query mutations
  const addMutation = useAddToCartMutation();
  const updateMutation = useUpdateCartItemMutation();
  const removeMutation = useRemoveCartItemMutation();
  const clearMutation = useClearCartMutation();
  const refetchMutation = useRefetchCartMutation();
  const debouncedUpdate = useDebouncedUpdateMutation(debounceMs);

  // Combined mutation states
  const isAdding = addMutation.isPending;
  const isUpdating = updateMutation.isPending || debouncedUpdate.isPending;
  const isRemoving = removeMutation.isPending;
  const isClearing = clearMutation.isPending;
  const isMutating = isAdding || isUpdating || isRemoving || isClearing;

  // Per-product loading state (check which specific product is being added)
  const addingProductId = addMutation.isPending
    ? (addMutation.variables?.productId ?? null)
    : null;
  const addingVariantId = addMutation.isPending
    ? (addMutation.variables?.variantId ?? null)
    : null;

  /**
   * Check if a specific product (and optionally variant) is being added
   */
  const isAddingProduct = (productId: string, variantId?: string | null) => {
    if (!addMutation.isPending) return false;
    if (addMutation.variables?.productId !== productId) return false;
    if (
      variantId !== undefined &&
      addMutation.variables?.variantId !== variantId
    )
      return false;
    return true;
  };

  // Per-item update state (for non-debounced updates)
  const updatingItemId = updateMutation.isPending
    ? (updateMutation.variables?.itemId ?? null)
    : null;

  /**
   * Check if a specific cart item is being updated (non-debounced only)
   */
  const isUpdatingItem = (itemId: string) => {
    if (!updateMutation.isPending) return false;
    return updateMutation.variables?.itemId === itemId;
  };

  // Per-item remove state
  const removingItemId = removeMutation.isPending
    ? (removeMutation.variables?.itemId ?? null)
    : null;

  /**
   * Check if a specific cart item is being removed
   */
  const isRemovingItem = (itemId: string) => {
    if (!removeMutation.isPending) return false;
    return removeMutation.variables?.itemId === itemId;
  };

  // ========================================================================
  // CONVENIENCE MUTATION FUNCTIONS
  // ========================================================================

  /**
   * Add item to cart
   *
   * @param productId - Product ID
   * @param quantity - Quantity to add
   * @param variantId - Optional variant ID
   * @param product - Optional product data for optimistic UI
   * @param variant - Optional variant data for optimistic UI
   */
  const addToCart = (
    productId: string,
    quantity: number,
    variantId?: string | null,
    product?: CartItemProduct,
    variant?: CartItemVariant
  ) => {
    if (!tenantId || !storeSlug) {
      console.error("Cart not initialized: missing tenantId or storeSlug");
      return;
    }

    addMutation.mutate({
      tenantId,
      storeSlug,
      productId,
      quantity,
      variantId,
      optimisticProduct: product,
      optimisticVariant: variant,
    });
  };

  /**
   * Update item quantity (with optional debouncing)
   *
   * @param itemId - Cart item ID
   * @param quantity - New quantity (0 or negative will be blocked)
   */
  const updateQuantity = (itemId: string, quantity: number) => {
    if (!tenantId || !storeSlug) {
      console.error("Cart not initialized: missing tenantId or storeSlug");
      return;
    }

    if (quantity < 1) {
      console.error("Quantity must be at least 1. Use removeItem to delete.");
      return;
    }

    if (debounce) {
      debouncedUpdate.debouncedUpdate({
        tenantId,
        storeSlug,
        itemId,
        quantity,
      });
    } else {
      updateMutation.mutate({
        tenantId,
        storeSlug,
        itemId,
        quantity,
      });
    }
  };

  /**
   * Remove item from cart
   *
   * @param itemId - Cart item ID
   */
  const removeItem = (itemId: string) => {
    if (!tenantId || !storeSlug) {
      console.error("Cart not initialized: missing tenantId or storeSlug");
      return;
    }

    removeMutation.mutate({
      tenantId,
      storeSlug,
      itemId,
    });
  };

  /**
   * Clear all items from cart
   */
  const clearCart = () => {
    if (!tenantId || !storeSlug) {
      console.error("Cart not initialized: missing tenantId or storeSlug");
      return;
    }

    clearMutation.mutate({
      tenantId,
      storeSlug,
    });
  };

  /**
   * Refetch cart from server (useful for recovery)
   */
  const refetch = () => {
    if (!tenantId) {
      console.error("Cart not initialized: missing tenantId");
      return;
    }

    refetchMutation.mutate(tenantId);
  };

  /**
   * Flush any pending debounced updates
   * Call this before navigation or checkout
   */
  const flushUpdates = () => {
    debouncedUpdate.flush();
  };

  /**
   * Check if there are pending debounced updates
   */
  const hasPendingUpdates = () => {
    return debouncedUpdate.hasPending();
  };

  // UI actions
  const openCart = () => cartActions.setIsOpen(true);
  const closeCart = () => cartActions.setIsOpen(false);
  const toggleCart = () => cartActions.toggleCart();

  return {
    // State (from Zustand - instant access)
    items,
    itemCount,
    subtotal,
    savings,
    isOpen,
    isHydrated,
    tenantId,
    storeSlug,

    // Computed
    isEmpty: items.length === 0,
    hasItems: items.length > 0,

    // Mutation functions (with optimistic updates)
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    refetch,
    flushUpdates,
    hasPendingUpdates,

    // UI actions
    openCart,
    closeCart,
    toggleCart,

    // Loading states
    isAdding,
    isUpdating,
    isRemoving,
    isClearing,
    isMutating,

    // Per-product loading state
    addingProductId,
    addingVariantId,
    isAddingProduct,

    // Per-item loading state
    updatingItemId,
    isUpdatingItem,
    removingItemId,
    isRemovingItem,

    // Error states
    addError: addMutation.error,
    updateError: updateMutation.error,
    removeError: removeMutation.error,
    clearError: clearMutation.error,

    // Direct access to mutations (for advanced use cases)
    mutations: {
      add: addMutation,
      update: updateMutation,
      remove: removeMutation,
      clear: clearMutation,
      refetch: refetchMutation,
    },

    // Actions for direct state manipulation (use sparingly)
    actions: cartActions,
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for just reading cart state (no mutations)
 * Use this for components that only display cart info
 */
export function useCartState() {
  const items = useCartItems();
  const itemCount = useCartItemCount();
  const subtotal = useCartSubtotal();
  const savings = useCartSavings();
  const isOpen = useCartIsOpen();
  const isHydrated = useCartIsHydrated();
  const { tenantId, storeSlug } = useCartTenant();

  return {
    items,
    itemCount,
    subtotal,
    savings,
    isOpen,
    isHydrated,
    tenantId,
    storeSlug,
    isEmpty: items.length === 0,
    hasItems: items.length > 0,
  };
}

/**
 * Hook for cart drawer/sidebar state
 */
export function useCartDrawer() {
  const isOpen = useCartIsOpen();

  return {
    isOpen,
    open: () => cartActions.setIsOpen(true),
    close: () => cartActions.setIsOpen(false),
    toggle: () => cartActions.toggleCart(),
  };
}

/**
 * Hook for getting cart item by ID
 */
export function useCartItem(itemId: string) {
  return useCartStore((state) =>
    state.items.find((item) => item.id === itemId)
  );
}

/**
 * Hook for checking if a product is in cart
 */
export function useIsInCart(productId: string, variantId?: string | null) {
  return useCartStore((state) =>
    state.items.some(
      (item) =>
        item.productId === productId &&
        (variantId === undefined || item.variantId === variantId)
    )
  );
}

/**
 * Hook for getting cart item quantity for a product
 */
export function useCartItemQuantity(
  productId: string,
  variantId?: string | null
) {
  return useCartStore((state) => {
    const item = state.items.find(
      (item) =>
        item.productId === productId &&
        (variantId === undefined || item.variantId === variantId)
    );
    return item?.quantity ?? 0;
  });
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export {
  // Store hooks
  useCartItems,
  useCartItemCount,
  useCartSubtotal,
  useCartSavings,
  useCartIsOpen,
  useCartIsHydrated,
  useCartTenant,
  useCartTotals,
  // Actions
  cartActions,
  // Helpers
  getApplicableTierPrice,
  // Query keys
  cartKeys,
};
