"use client";

import { useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  updateCartItemQuantityAction,
  removeFromCartAction,
} from "@/lib/cart/actions";
import { useCartStore } from "@/lib/stores/use-cart-store";

type PendingUpdate = {
  itemId: string;
  quantity: number;
  previousQuantity: number;
};

type UseDebouncedCartSyncOptions = {
  tenantId: string;
  storeSlug: string;
  debounceMs?: number;
};

/**
 * Hook for debounced cart sync operations.
 *
 * When users rapidly click +/- or type quantities, this batches
 * updates and only syncs the final value after a delay.
 *
 * Features:
 * - Debounces rapid quantity changes (default 400ms)
 * - Tracks pending changes per item
 * - Rolls back to server state on failure
 * - Shows toast on sync failure
 */
export function useDebouncedCartSync({
  tenantId,
  storeSlug,
  debounceMs = 400,
}: UseDebouncedCartSyncOptions) {
  // Track pending updates per item
  const pendingUpdates = useRef<Map<string, PendingUpdate>>(new Map());
  // Track debounce timers per item
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track which items are currently syncing
  const syncing = useRef<Set<string>>(new Set());

  const { updateItemOptimistic, removeItemOptimistic, setItems } =
    useCartStore.getState();

  /**
   * Refetch cart from server (used for rollback on failure)
   */
  const refetchCart = useCallback(async () => {
    // Import dynamically to avoid circular deps
    const { getCartAction } = await import("@/lib/cart/actions");
    const result = await getCartAction(tenantId);
    if (result.success && result.cart) {
      setItems(result.cart.items);
    }
  }, [tenantId, setItems]);

  /**
   * Sync a single item's quantity to the server
   */
  const syncItem = useCallback(
    async (itemId: string) => {
      const pending = pendingUpdates.current.get(itemId);
      if (!pending) return;

      // Mark as syncing
      syncing.current.add(itemId);
      pendingUpdates.current.delete(itemId);

      try {
        if (pending.quantity <= 0) {
          // Remove item
          const result = await removeFromCartAction(
            tenantId,
            storeSlug,
            itemId
          );
          if (!result.success) {
            throw new Error(result.error);
          }
        } else {
          // Update quantity
          const result = await updateCartItemQuantityAction(
            tenantId,
            storeSlug,
            itemId,
            pending.quantity
          );
          if (!result.success) {
            throw new Error(result.error);
          }
        }
      } catch (error) {
        // Rollback: refetch entire cart from server
        toast.error(
          error instanceof Error ? error.message : "Failed to update cart"
        );
        await refetchCart();
      } finally {
        syncing.current.delete(itemId);
      }
    },
    [tenantId, storeSlug, refetchCart]
  );

  /**
   * Update quantity with debouncing
   *
   * @param itemId - Cart item ID
   * @param quantity - New quantity (0 or negative will remove)
   * @param previousQuantity - Quantity before this change (for rollback)
   */
  const updateQuantity = useCallback(
    (itemId: string, quantity: number, previousQuantity: number) => {
      // Apply optimistic update immediately
      if (quantity <= 0) {
        removeItemOptimistic(itemId);
      } else {
        updateItemOptimistic(itemId, quantity);
      }

      // Store the pending update (keep original previousQuantity for rollback)
      const existing = pendingUpdates.current.get(itemId);
      pendingUpdates.current.set(itemId, {
        itemId,
        quantity,
        // Keep the first previousQuantity for proper rollback
        previousQuantity: existing?.previousQuantity ?? previousQuantity,
      });

      // Clear existing timer for this item
      const existingTimer = timers.current.get(itemId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounce timer
      const timer = setTimeout(() => {
        timers.current.delete(itemId);
        syncItem(itemId);
      }, debounceMs);

      timers.current.set(itemId, timer);
    },
    [debounceMs, syncItem, updateItemOptimistic, removeItemOptimistic]
  );

  /**
   * Force sync all pending updates immediately
   * Useful before checkout or navigation
   */
  const flushPendingUpdates = useCallback(async () => {
    // Clear all timers
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();

    // Sync all pending items
    const itemIds = Array.from(pendingUpdates.current.keys());
    await Promise.all(itemIds.map(syncItem));
  }, [syncItem]);

  /**
   * Check if there are pending updates
   */
  const hasPendingUpdates = useCallback(() => {
    return pendingUpdates.current.size > 0 || syncing.current.size > 0;
  }, []);

  /**
   * Check if a specific item is actively syncing to server
   * (Does NOT include pending debounced updates - those should not block UI)
   */
  const isItemSyncing = useCallback((itemId: string) => {
    return syncing.current.has(itemId);
  }, []);

  /**
   * Check if a specific item has pending changes (debouncing)
   */
  const isItemPending = useCallback((itemId: string) => {
    return pendingUpdates.current.has(itemId);
  }, []);

  return {
    updateQuantity,
    flushPendingUpdates,
    hasPendingUpdates,
    isItemSyncing,
    isItemPending,
  };
}
