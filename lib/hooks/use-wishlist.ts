"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { toggleWishlistAction } from "@/lib/actions/wishlists";

/**
 * Hook for managing wishlist state for a specific product.
 * Provides optimistic updates with rollback on error.
 *
 * @example
 * ```tsx
 * function ProductCard({ product, tenantId }) {
 *   const { isInWishlist, toggleWishlist, isPending } = useWishlist({
 *     tenantId,
 *     productId: product.id,
 *     initialState: false,
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
  initialState = false,
}: {
  tenantId: string;
  productId: string;
  variantId?: string;
  initialState?: boolean;
}) {
  const [isInWishlist, setIsInWishlist] = useState(initialState);
  const [isPending, startTransition] = useTransition();

  const toggleWishlist = useCallback(() => {
    // Optimistic update
    const previousState = isInWishlist;
    setIsInWishlist(!isInWishlist);

    startTransition(async () => {
      const result = await toggleWishlistAction(tenantId, productId, variantId);

      if (result.error) {
        // Rollback on error
        setIsInWishlist(previousState);
        toast.error(result.error.message);
        return;
      }

      // Show success message
      if (result.data?.action === "added") {
        toast.success("Added to wishlist");
      } else {
        toast.success("Removed from wishlist");
      }
    });
  }, [tenantId, productId, variantId, isInWishlist]);

  return {
    isInWishlist,
    toggleWishlist,
    isPending,
  };
}
