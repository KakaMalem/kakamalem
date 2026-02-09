import { cache } from "react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { shippingZones, shippingMethods } from "@/lib/db/schema";
import type { Address } from "@/lib/db/schema";
import { findProvinceByCity } from "@/lib/geo/afghanistan";

// =============================================================================
// REVERSE GEOCODING (Server-side fallback)
// =============================================================================

/**
 * Reverse geocode result with full location data
 */
type ReverseGeocodeResult = {
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
};

/**
 * Reverse geocode coordinates to get location data
 * Works worldwide - not limited to any specific country
 * Used as fallback when client doesn't provide city
 */
async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`,
      {
        headers: { "User-Agent": "KakaMalem/1.0 (delivery-platform)" },
        // Cache for 1 hour to avoid rate limits
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return { city: null, state: null, country: null, countryCode: null };
    }

    const data = await response.json();
    const address = data.address;

    return {
      city:
        address?.city ||
        address?.town ||
        address?.village ||
        address?.municipality ||
        null,
      state: address?.state || address?.province || null,
      country: address?.country || null,
      countryCode: address?.country_code?.toUpperCase() || null,
    };
  } catch {
    return { city: null, state: null, country: null, countryCode: null };
  }
}

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
 * Normalize city/province name for comparison
 */
function normalizeLocationName(name: string): string {
  return name.toLowerCase().trim().replace(/[\-_]/g, " ").replace(/\s+/g, " ");
}

/**
 * Check if a value matches any item in an array (case-insensitive)
 */
function matchesAny(value: string | null | undefined, list: string[]): boolean {
  if (!value || list.length === 0) return false;
  const normalized = normalizeLocationName(value);
  return list.some((item) => normalizeLocationName(item) === normalized);
}

/**
 * Get all matching shipping zones for an address
 * Returns zones sorted by specificity (most specific first)
 *
 * Works WORLDWIDE - uses GPS reverse geocoding to determine location
 * Afghanistan data is only used as a fallback for city → province lookup
 */
export async function getMatchingZones(
  address: Address,
  zones: ShippingZone[]
): Promise<ShippingZone[]> {
  const matchedZones: { zone: ShippingZone; specificity: number }[] = [];

  // Location data from address or reverse geocoding
  let addressCity = address.city || null;
  let addressProvince: string | null = null;
  let addressCountry: string | null = null;
  let addressCountryCode: string | null = null;

  // Always try reverse geocoding if we have coordinates
  // This gives us accurate city, state, and country for ANY location worldwide
  if (address.latitude && address.longitude) {
    const geoResult = await reverseGeocode(address.latitude, address.longitude);

    // Use reverse geocoded data (more accurate than client-provided)
    if (geoResult.city && !addressCity) {
      addressCity = geoResult.city;
    }
    if (geoResult.state) {
      addressProvince = geoResult.state;
    }
    if (geoResult.country) {
      addressCountry = geoResult.country;
    }
    if (geoResult.countryCode) {
      addressCountryCode = geoResult.countryCode;
    }
  }

  // Fallback: Try Afghanistan data for city → province lookup
  // Only if we have city but no province (e.g., client provided city name)
  if (addressCity && !addressProvince) {
    const province = findProvinceByCity(addressCity);
    if (province) {
      addressProvince = province.name;
      // If we matched in Afghanistan data, set country
      if (!addressCountry) {
        addressCountry = "Afghanistan";
        addressCountryCode = "AF";
      }
    }
  }

  for (const zone of zones) {
    const hasCities = zone.cities && zone.cities.length > 0;
    const hasStates = zone.states && zone.states.length > 0; // provinces
    const hasCountries = zone.countries && zone.countries.length > 0;
    const hasPostalCodes = zone.postalCodes && zone.postalCodes.length > 0;

    // Calculate specificity score (higher = more specific)
    let specificity = 0;
    let matches = true;

    // CITY-level matching (most specific)
    if (hasCities) {
      if (addressCity && matchesAny(addressCity, zone.cities!)) {
        specificity += 100; // City match is very specific
      } else {
        matches = false; // Zone requires specific cities but address doesn't match
      }
    }

    // PROVINCE/STATE-level matching
    if (hasStates && matches) {
      if (addressProvince && matchesAny(addressProvince, zone.states!)) {
        specificity += 50; // Province match
      } else if (!hasCities) {
        // If zone only has province filter (no city filter), require province match
        matches = false;
      }
    }

    // COUNTRY-level matching (works worldwide)
    if (hasCountries && matches) {
      // Check if the customer's country matches any in the zone's country list
      // Supports country codes (AF, US, AE) and full names (Afghanistan, United States)
      const countryMatches = zone.countries!.some((zoneCountry) => {
        const c = zoneCountry.toLowerCase().trim();
        // Match by country code (e.g., "AF", "US")
        if (addressCountryCode && c === addressCountryCode.toLowerCase()) {
          return true;
        }
        // Match by full country name
        if (addressCountry && c === addressCountry.toLowerCase()) {
          return true;
        }
        // Special handling for common aliases
        if (
          addressCountryCode === "AF" ||
          addressCountry?.toLowerCase() === "afghanistan"
        ) {
          return c === "af" || c === "afghanistan" || c === "افغانستان";
        }
        if (
          addressCountryCode === "US" ||
          addressCountry?.toLowerCase() === "united states"
        ) {
          return (
            c === "us" ||
            c === "usa" ||
            c === "united states" ||
            c === "united states of america"
          );
        }
        return false;
      });

      if (countryMatches) {
        specificity += 10;
      } else {
        matches = false;
      }
    }

    // POSTAL CODE matching
    if (hasPostalCodes && matches) {
      // Postal code matching can be added later
      // Would need address.postalCode field
    }

    // CATCH-ALL zone (no geographic restrictions)
    if (!hasCities && !hasStates && !hasCountries && !hasPostalCodes) {
      specificity = 1; // Lowest specificity, but still matches
      matches = true;
    }

    if (matches) {
      matchedZones.push({ zone, specificity });
    }
  }

  // Sort by specificity (most specific first), then by priority
  return matchedZones
    .sort((a, b) => {
      if (b.specificity !== a.specificity) {
        return b.specificity - a.specificity;
      }
      return b.zone.priority - a.zone.priority;
    })
    .map((m) => m.zone);
}

/**
 * Match an address to the best shipping zone
 * Returns the most specific matching zone, or null if no match
 */
export async function matchAddressToZone(
  address: Address,
  zones: ShippingZone[]
): Promise<ShippingZone | null> {
  const matchingZones = await getMatchingZones(address, zones);
  return matchingZones[0] || null;
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

  // Match address to zone (uses reverse geocoding if city not provided)
  const zone = await matchAddressToZone(address, zones);

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
