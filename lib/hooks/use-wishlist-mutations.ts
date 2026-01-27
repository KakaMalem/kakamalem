"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  wishlistActions,
  useWishlistStore,
} from "@/lib/stores/use-wishlist-store";
import {
  toggleWishlistAction,
  getWishlistedProductIdsAction,
} from "@/lib/actions/wishlists";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const wishlistKeys = {
  all: ["wishlist"] as const,
  byTenant: (tenantId: string) => [...wishlistKeys.all, tenantId] as const,
  productIds: (tenantId: string) =>
    [...wishlistKeys.byTenant(tenantId), "productIds"] as const,
};

// ============================================================================
// QUERY: Get Wishlisted Product IDs
// ============================================================================

export function useWishlistProductIds(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: wishlistKeys.productIds(tenantId),
    queryFn: async () => {
      const result = await getWishlistedProductIdsAction(tenantId);
      return result.data?.productIds ?? [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================================================
// MUTATION: Toggle Wishlist
// ============================================================================

interface ToggleWishlistVariables {
  tenantId: string;
  productId: string;
  variantId?: string;
}

export function useToggleWishlistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      productId,
      variantId,
    }: ToggleWishlistVariables) => {
      const result = await toggleWishlistAction(tenantId, productId, variantId);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data!;
    },

    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: wishlistKeys.byTenant(variables.tenantId),
      });

      // Apply optimistic update to Zustand store
      const { snapshot, action } = wishlistActions.toggleProduct(
        variables.productId
      );

      return { snapshot, action };
    },

    onSuccess: (data, _variables, context) => {
      // Show success message (action from server confirms what happened)
      if (data.action === "added") {
        toast.success("Added to wishlist");
      } else {
        toast.success("Removed from wishlist");
      }

      // The optimistic update was correct, no need to change anything
      // unless the server says something different
      if (context?.action !== data.action) {
        // Server says different action happened, sync the store
        if (data.action === "added") {
          wishlistActions.addProduct(data.productId);
        } else {
          wishlistActions.removeProduct(data.productId);
        }
      }
    },

    onError: (error, _variables, context) => {
      // Rollback optimistic update
      if (context?.snapshot) {
        wishlistActions.rollback(context.snapshot);
      }

      toast.error("Couldn't update wishlist", {
        description: error.message || "Please try again",
      });
    },

    onSettled: (_data, _error, variables) => {
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: wishlistKeys.byTenant(variables.tenantId),
      });
    },
  });
}

// ============================================================================
// HOOK: Combined Wishlist Hook with Store Integration
// ============================================================================

/**
 * Hook for managing wishlist state for a specific product.
 * Uses Zustand for state and TanStack Query for mutations.
 *
 * @example
 * ```tsx
 * function ProductCard({ product, tenantId }) {
 *   const { isInWishlist, toggleWishlist, isPending } = useWishlistWithMutation({
 *     tenantId,
 *     productId: product.id,
 *   });
 *
 *   return (
 *     <button onClick={toggleWishlist} disabled={isPending}>
 *       <Heart className={isInWishlist ? "fill-red-500" : ""} />
 *     </button>
 *   );
 * }
 * ```
 */
export function useWishlistWithMutation({
  tenantId,
  productId,
  variantId,
}: {
  tenantId: string;
  productId: string;
  variantId?: string;
}) {
  // Get reactive state from Zustand store
  const isInWishlist = useWishlistStore((state) =>
    state.productIds.has(productId)
  );

  const mutation = useToggleWishlistMutation();

  const toggleWishlist = () => {
    mutation.mutate({ tenantId, productId, variantId });
  };

  return {
    isInWishlist,
    toggleWishlist,
    isPending: mutation.isPending,
  };
}

// ============================================================================
// TYPES FOR EXTERNAL USE
// ============================================================================

export type ToggleWishlistMutation = ReturnType<
  typeof useToggleWishlistMutation
>;
