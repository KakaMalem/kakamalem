"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cartActions } from "@/lib/stores/use-cart-store";
import {
  addToCartAction,
  updateCartItemQuantityAction,
  removeFromCartAction,
  clearCartAction,
  getCartAction,
} from "@/lib/cart/actions";
import type {
  AddToCartVariables,
  UpdateCartItemVariables,
  RemoveCartItemVariables,
  ClearCartVariables,
  CartItem,
  CartSnapshot,
} from "@/lib/types/cart";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const cartKeys = {
  all: ["cart"] as const,
  byTenant: (tenantId: string) => [...cartKeys.all, tenantId] as const,
  items: (tenantId: string) =>
    [...cartKeys.byTenant(tenantId), "items"] as const,
  summary: (tenantId: string) =>
    [...cartKeys.byTenant(tenantId), "summary"] as const,
  validation: (tenantId: string) =>
    [...cartKeys.byTenant(tenantId), "validation"] as const,
};

// ============================================================================
// MUTATION: Add to Cart
// ============================================================================

export function useAddToCartMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      storeSlug,
      productId,
      quantity,
      variantId,
    }: AddToCartVariables) => {
      const result = await addToCartAction(
        tenantId,
        storeSlug,
        productId,
        quantity,
        variantId
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.cart;
    },

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });

      // Create optimistic cart item if product data provided
      if (variables.optimisticProduct) {
        const optimisticItem: CartItem = {
          id: `temp-${Date.now()}`, // Temporary ID until server responds
          productId: variables.productId,
          variantId: variables.variantId ?? null,
          quantity: variables.quantity,
          product: variables.optimisticProduct,
          variant: variables.optimisticVariant ?? null,
        };

        // Apply optimistic update and get snapshot for rollback
        const snapshot = cartActions.addItem(optimisticItem);
        return { snapshot };
      }

      return { snapshot: null };
    },

    onSuccess: (cart, variables) => {
      // Sync store with server response
      cartActions.syncFromServer(cart);

      // Open cart drawer to show added item
      cartActions.setIsOpen(true);

      toast.success("Added to cart", {
        description: `${variables.quantity} item${variables.quantity > 1 ? "s" : ""} added`,
      });
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.snapshot) {
        cartActions.rollback(context.snapshot);
      }

      toast.error("Couldn't add to cart", {
        description: error.message || "Please try again",
      });
    },

    onSettled: (_data, _error, variables) => {
      // Invalidate cart queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Update Cart Item Quantity
// ============================================================================

export function useUpdateCartItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      storeSlug,
      itemId,
      quantity,
    }: UpdateCartItemVariables) => {
      const result = await updateCartItemQuantityAction(
        tenantId,
        storeSlug,
        itemId,
        quantity
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.cart;
    },

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });

      // Apply optimistic update
      const snapshot = cartActions.updateItemQuantity(
        variables.itemId,
        variables.quantity
      );

      return { snapshot };
    },

    onSuccess: (cart) => {
      // Sync store with server response
      cartActions.syncFromServer(cart);
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.snapshot) {
        cartActions.rollback(context.snapshot);
      }

      toast.error("Couldn't update quantity", {
        description: error.message || "Please try again",
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Remove Cart Item
// ============================================================================

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      storeSlug,
      itemId,
    }: RemoveCartItemVariables) => {
      const result = await removeFromCartAction(tenantId, storeSlug, itemId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.cart;
    },

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });

      // Apply optimistic update
      const snapshot = cartActions.removeItem(variables.itemId);

      return { snapshot };
    },

    onSuccess: (cart) => {
      // Sync store with server response
      cartActions.syncFromServer(cart);

      toast.success("Item removed from cart");
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.snapshot) {
        cartActions.rollback(context.snapshot);
      }

      toast.error("Couldn't remove item", {
        description: error.message || "Please try again",
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Clear Cart
// ============================================================================

export function useClearCartMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, storeSlug }: ClearCartVariables) => {
      const result = await clearCartAction(tenantId, storeSlug);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });

      // Apply optimistic update
      const snapshot = cartActions.clearItems();

      return { snapshot };
    },

    onSuccess: () => {
      toast.success("Cart cleared");
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.snapshot) {
        cartActions.rollback(context.snapshot);
      }

      toast.error("Couldn't clear cart", {
        description: error.message || "Please try again",
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: cartKeys.byTenant(variables.tenantId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Refetch Cart (for recovery/sync)
// ============================================================================

export function useRefetchCartMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const result = await getCartAction(tenantId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.cart;
    },

    onSuccess: (cart) => {
      // Sync store with server response
      cartActions.syncFromServer(cart);
    },

    onError: (error) => {
      toast.error("Couldn't sync cart", {
        description: error.message || "Please refresh the page",
      });
    },

    onSettled: (_data, _error, tenantId) => {
      queryClient.invalidateQueries({
        queryKey: cartKeys.byTenant(tenantId),
      });
    },
  });
}

// ============================================================================
// DEBOUNCED UPDATE MUTATION
// ============================================================================

/**
 * Creates a debounced version of the update mutation.
 * Useful for quantity inputs where users might type rapidly.
 */
export function useDebouncedUpdateMutation(debounceMs = 400) {
  const updateMutation = useUpdateCartItemMutation();
  const pendingTimeouts = new Map<string, NodeJS.Timeout>();
  const pendingSnapshots = new Map<string, CartSnapshot>();

  const debouncedUpdate = (variables: UpdateCartItemVariables) => {
    const key = variables.itemId;

    // Clear existing timeout for this item
    const existingTimeout = pendingTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Apply optimistic update immediately (only capture first snapshot)
    if (!pendingSnapshots.has(key)) {
      const snapshot = cartActions.updateItemQuantity(
        variables.itemId,
        variables.quantity
      );
      pendingSnapshots.set(key, snapshot);
    } else {
      // Just update the quantity without capturing new snapshot
      cartActions.updateItemQuantity(variables.itemId, variables.quantity);
    }

    // Set new debounced mutation
    const timeout = setTimeout(() => {
      pendingTimeouts.delete(key);
      const snapshot = pendingSnapshots.get(key);
      pendingSnapshots.delete(key);

      // Mutate with the captured snapshot for rollback
      updateMutation.mutate(variables, {
        onError: () => {
          if (snapshot) {
            cartActions.rollback(snapshot);
          }
        },
      });
    }, debounceMs);

    pendingTimeouts.set(key, timeout);
  };

  const flush = () => {
    // Execute all pending updates immediately
    pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    pendingTimeouts.clear();
    pendingSnapshots.clear();
  };

  const hasPending = () => pendingTimeouts.size > 0;

  return {
    debouncedUpdate,
    flush,
    hasPending,
    isPending: updateMutation.isPending,
    isError: updateMutation.isError,
    error: updateMutation.error,
  };
}

// ============================================================================
// TYPES FOR EXTERNAL USE
// ============================================================================

export type AddToCartMutation = ReturnType<typeof useAddToCartMutation>;
export type UpdateCartItemMutation = ReturnType<
  typeof useUpdateCartItemMutation
>;
export type RemoveCartItemMutation = ReturnType<
  typeof useRemoveCartItemMutation
>;
export type ClearCartMutation = ReturnType<typeof useClearCartMutation>;
