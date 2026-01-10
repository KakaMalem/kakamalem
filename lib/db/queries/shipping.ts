import { cache } from "react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { shippingZones, shippingMethods } from "@/lib/db/schema";
import type { Address } from "@/lib/db/schema";

// =============================================================================
// TYPES
// =============================================================================

export type ShippingZone = typeof shippingZones.$inferSelect;
export type ShippingMethod = typeof shippingMethods.$inferSelect;

export type ShippingMethodWithRate = ShippingMethod & {
  calculatedRate: number;
};

export type CartItemForShipping = {
  quantity: number;
  product: {
    weight: string | null;
  };
};

// =============================================================================
// SHIPPING ZONE QUERIES
// =============================================================================

/**
 * Get all active shipping zones for a tenant
 */
export const getShippingZones = cache(async (tenantId: string) => {
  const zones = await db.query.shippingZones.findMany({
    where: and(
      eq(shippingZones.tenantId, tenantId),
      eq(shippingZones.isActive, true)
    ),
    orderBy: [desc(shippingZones.priority)],
  });

  return zones;
});

/**
 * Get shipping methods for a specific zone
 */
export const getShippingMethodsForZone = cache(async (zoneId: string) => {
  const methods = await db.query.shippingMethods.findMany({
    where: and(
      eq(shippingMethods.zoneId, zoneId),
      eq(shippingMethods.isActive, true)
    ),
    orderBy: [shippingMethods.displayOrder],
  });

  return methods;
});

// =============================================================================
// ZONE MATCHING
// =============================================================================

/**
 * Match a GPS-based address to a shipping zone
 *
 * Since we use GPS coordinates instead of traditional address fields,
 * zone matching is simplified:
 * 1. First, look for zones with no geographic restrictions (catch-all zones)
 * 2. In the future, can add geofencing support using lat/lng bounds
 *
 * For now, with GPS-based addresses, we return the highest priority active zone
 * that doesn't have specific geographic filters.
 */
export function matchAddressToZone(
  _address: Address, // GPS coordinates available but not used for matching yet
  zones: ShippingZone[]
): ShippingZone | null {
  // Zones should already be sorted by priority DESC from query
  for (const zone of zones) {
    // Check if zone has no geographic restrictions (catch-all zone)
    const hasPostalCodes = zone.postalCodes && zone.postalCodes.length > 0;
    const hasCities = zone.cities && zone.cities.length > 0;
    const hasStates = zone.states && zone.states.length > 0;
    const hasCountries = zone.countries && zone.countries.length > 0;

    // If zone has no geographic filters, it's a catch-all zone
    if (!hasPostalCodes && !hasCities && !hasStates && !hasCountries) {
      return zone;
    }

    // TODO: In the future, implement geofencing support here
    // Check if GPS coordinates fall within zone's lat/lng bounds
  }

  // If no catch-all zone found, return the first zone with countries set
  // (assuming "Afghanistan" is the default target market)
  for (const zone of zones) {
    if (zone.countries && zone.countries.length > 0) {
      return zone;
    }
  }

  return null; // No matching zone
}

// =============================================================================
// SHIPPING RATE CALCULATION
// =============================================================================

/**
 * Calculate total weight of cart items in kg
 */
export function calculateCartWeight(items: CartItemForShipping[]): number {
  return items.reduce((total, item) => {
    const weight = item.product.weight ? parseFloat(item.product.weight) : 0;
    return total + weight * item.quantity;
  }, 0);
}

/**
 * Calculate total item count in cart
 */
export function calculateCartItemCount(items: CartItemForShipping[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Calculate shipping rate for a method
 * Returns the calculated rate, or -1 if method is not available (weight limits)
 */
export function calculateShippingRate(
  method: ShippingMethod,
  items: CartItemForShipping[],
  orderSubtotal: number
): number {
  const totalWeight = calculateCartWeight(items);
  const itemCount = calculateCartItemCount(items);

  // Check weight limits
  if (method.minWeight && totalWeight < parseFloat(method.minWeight)) {
    return -1; // Weight too low for this method
  }
  if (method.maxWeight && totalWeight > parseFloat(method.maxWeight)) {
    return -1; // Weight too high for this method
  }

  // Check free shipping threshold first (applies to all rate types)
  if (method.freeShippingThreshold) {
    const threshold = parseFloat(method.freeShippingThreshold);
    if (orderSubtotal >= threshold) {
      return 0; // Free shipping!
    }
  }

  let rate = 0;
  const baseRate = parseFloat(method.baseRate);

  switch (method.rateType) {
    case "flat":
      rate = baseRate;
      break;

    case "per_item":
      const perItemRate = method.perItemRate
        ? parseFloat(method.perItemRate)
        : 0;
      rate = baseRate + perItemRate * itemCount;
      break;

    case "weight_based":
      const perKgRate = method.perKgRate ? parseFloat(method.perKgRate) : 0;
      rate = baseRate + perKgRate * totalWeight;
      break;

    case "weight_tiered":
      // For weight_tiered, we'd need to fetch tiers from shippingWeightTiers table
      // For now, fall back to base rate
      // TODO: Implement weight tier lookup
      rate = baseRate;
      break;

    case "price_based":
      // Already handled by freeShippingThreshold check above
      rate = baseRate;
      break;

    default:
      rate = baseRate;
  }

  // Add handling fee
  if (method.handlingFee) {
    rate += parseFloat(method.handlingFee);
  }

  return rate;
}

/**
 * Get available shipping methods for an address with calculated rates
 */
export async function getAvailableShippingMethods(
  tenantId: string,
  address: Address,
  items: CartItemForShipping[],
  orderSubtotal: number
): Promise<{
  zone: ShippingZone | null;
  methods: ShippingMethodWithRate[];
}> {
  // Get all zones for tenant
  const zones = await getShippingZones(tenantId);

  // Match address to zone
  const zone = matchAddressToZone(address, zones);

  if (!zone) {
    return { zone: null, methods: [] };
  }

  // Get methods for zone
  const methods = await getShippingMethodsForZone(zone.id);

  // Calculate rates and filter out unavailable methods
  const methodsWithRates: ShippingMethodWithRate[] = [];

  for (const method of methods) {
    const rate = calculateShippingRate(method, items, orderSubtotal);

    // Only include methods that are available (rate >= 0)
    if (rate >= 0) {
      methodsWithRates.push({
        ...method,
        calculatedRate: rate,
      });
    }
  }

  return { zone, methods: methodsWithRates };
}
