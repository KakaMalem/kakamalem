"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useWishlistStore,
  wishlistActions,
} from "@/lib/stores/use-wishlist-store";
import { toggleWishlistAction } from "@/lib/actions/wishlists";
import { wishlistKeys } from "@/lib/hooks/use-wishlist-mutations";

/**
 * Hook for managing wishlist state for a specific product.
 * Uses Zustand store for reactive state and TanStack Query for mutations.
 *
 * The `initialState` parameter is kept for backwards compatibility but is
 * now ignored - the state comes from the global Zustand store which is
 * hydrated from the server.
 *
 * @example
 * ```tsx
 * function ProductCard({ product, tenantId }) {
 *   const { isInWishlist, toggleWishlist, isPending } = useWishlist({
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
export function useWishlist({
  tenantId,
  productId,
  variantId,
}: {
  tenantId: string;
  productId: string;
  variantId?: string;
}) {
  const queryClient = useQueryClient();

  // Get reactive state from Zustand store
  const isInWishlist = useWishlistStore((state) =>
    state.productIds.has(productId)
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await toggleWishlistAction(tenantId, productId, variantId);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data!;
    },

    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: wishlistKeys.byTenant(tenantId),
      });

      // Apply optimistic update to Zustand store
      const { snapshot, action } = wishlistActions.toggleProduct(productId);

      return { snapshot, action };
    },

    onSuccess: (data, _variables, context) => {
      // Show success message
      if (data.action === "added") {
        toast.success("Added to wishlist");
      } else {
        toast.success("Removed from wishlist");
      }

      // Verify the optimistic update was correct
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

      toast.error(error.message || "Couldn't update wishlist");
    },

    onSettled: () => {
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: wishlistKeys.byTenant(tenantId),
      });
    },
  });

  const toggleWishlist = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return {
    isInWishlist,
    toggleWishlist,
    isPending: mutation.isPending,
  };
}
