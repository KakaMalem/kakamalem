"use client";

import { useState, useEffect, useCallback } from "react";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";

/**
 * Shipping availability result
 */
export interface ShippingAvailability {
  available: boolean;
  canDeliver: boolean;
  canShip: boolean;
  deliveryZoneName: string | null;
  shippingZoneName: string | null;
  message: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check shipping availability for the current user's location
 *
 * Uses the user's saved address from checkout store, or can be triggered
 * with specific coordinates.
 *
 * @example
 * ```tsx
 * function ProductPage({ storeSlug }) {
 *   const { availability, checkAvailability } = useShippingAvailability(storeSlug);
 *
 *   return (
 *     <div>
 *       {availability.isLoading && <Spinner />}
 *       {!availability.isLoading && (
 *         <p className={availability.available ? "text-green-600" : "text-red-600"}>
 *           {availability.message}
 *         </p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useShippingAvailability(storeSlug: string) {
  const { shippingAddress } = useCheckoutStore();

  const [availability, setAvailability] = useState<ShippingAvailability>({
    available: true, // Optimistic default
    canDeliver: false,
    canShip: true,
    deliveryZoneName: null,
    shippingZoneName: null,
    message: "",
    isLoading: false,
    error: null,
  });

  /**
   * Check availability for specific coordinates
   */
  const checkAvailability = useCallback(
    async (lat: number, lng: number, city?: string) => {
      setAvailability((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const params = new URLSearchParams({
          slug: storeSlug,
          lat: lat.toString(),
          lng: lng.toString(),
        });
        if (city) {
          params.set("city", city);
        }

        const response = await fetch(`/api/shipping/availability?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to check availability");
        }

        setAvailability({
          available: data.available,
          canDeliver: data.canDeliver,
          canShip: data.canShip,
          deliveryZoneName: data.deliveryZoneName,
          shippingZoneName: data.shippingZoneName,
          message: data.message,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setAvailability((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Check failed",
        }));
      }
    },
    [storeSlug]
  );

  // Auto-check when shipping address changes
  useEffect(() => {
    if (shippingAddress?.latitude && shippingAddress?.longitude) {
      checkAvailability(
        shippingAddress.latitude,
        shippingAddress.longitude,
        shippingAddress.city
      );
    }
  }, [shippingAddress, checkAvailability]);

  return {
    availability,
    checkAvailability,
    hasAddress: !!shippingAddress,
  };
}

/**
 * Simple component to display shipping availability
 */
export function ShippingAvailabilityBadge({
  storeSlug,
  className,
}: {
  storeSlug: string;
  className?: string;
}) {
  const { availability, hasAddress } = useShippingAvailability(storeSlug);

  if (!hasAddress) {
    return null; // Don't show anything until we have an address
  }

  if (availability.isLoading) {
    return (
      <span className={`text-sm text-muted-foreground ${className}`}>
        Checking delivery...
      </span>
    );
  }

  if (availability.error) {
    return null; // Silently fail - don't block the user
  }

  return (
    <span
      className={`text-sm ${
        availability.available ? "text-green-600" : "text-red-600"
      } ${className}`}
    >
      {availability.message}
    </span>
  );
}
