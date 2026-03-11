/**
 * Zone Matcher Service
 *
 * Matches customer locations to delivery zones using specificity scoring.
 * More specific zones (polygon > radius > postal > city > region > country > worldwide)
 * are checked first to ensure the most accurate delivery options.
 */

import { db } from "@/lib/db";
import {
  unifiedDeliveryZones,
  unifiedDeliveryMethods,
  unifiedWeightTiers,
} from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { Polygon, Position } from "geojson";

// =============================================================================
// TYPES
// =============================================================================

export interface MatchLocationInput {
  /** Customer latitude */
  lat: number;
  /** Customer longitude */
  lng: number;
  /** Country code (ISO 3166-1 alpha-2) - speeds up matching */
  country?: string;
  /** Region/state name */
  region?: string;
  /** City name */
  city?: string;
  /** Postal code */
  postalCode?: string;
}

export interface MatchedZone {
  id: string;
  name: string;
  zoneType: string;
  specificityScore: number;
  color: string | null;
}

export interface MatchedMethod {
  id: string;
  name: string;
  description: string | null;
  methodType: string;
  rateType: string;
  baseRate: string;
  perItemRate: string | null;
  perKgRate: string | null;
  freeShippingThreshold: string | null;
  minOrderAmount: string | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  estimatedTime: string | null;
  handlingFee: string | null;
  includesTracking: boolean;
  includesInsurance: boolean;
  insuranceRate: string | null;
  pickupLocationName: string | null;
  pickupLocationAddress: string | null;
  pickupLocationLat: string | null;
  pickupLocationLng: string | null;
  displayOrder: number;
}

export interface ZoneMatchResult {
  zone: MatchedZone;
  methods: MatchedMethod[];
  matchReason: string;
}

export interface CalculatedRate {
  methodId: string;
  methodName: string;
  rate: number;
  isFree: boolean;
  freeReason?: string;
  deliveryEstimate?: string;
}

// =============================================================================
// ZONE MATCHER
// =============================================================================

/**
 * Find all matching zones for a location, ordered by specificity (highest first).
 * Returns zones with their available delivery methods.
 */
export async function findMatchingZones(
  tenantId: string,
  location: MatchLocationInput
): Promise<ZoneMatchResult[]> {
  // Fetch all active zones for this tenant, ordered by specificity
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: and(
      eq(unifiedDeliveryZones.tenantId, tenantId),
      eq(unifiedDeliveryZones.isActive, true)
    ),
    with: {
      methods: {
        where: eq(unifiedDeliveryMethods.isActive, true),
        orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
      },
    },
    orderBy: [
      desc(unifiedDeliveryZones.specificityScore),
      asc(unifiedDeliveryZones.displayOrder),
    ],
  });

  const results: ZoneMatchResult[] = [];

  for (const zone of zones) {
    const matchResult = matchLocationToZone(location, zone);

    if (matchResult.matches) {
      // Dynamic specificity boost: smaller radius zones get higher priority
      // Enables distance-based pricing by prioritizing the tightest matching radius
      let dynamicSpecificity = zone.specificityScore;
      if (zone.zoneType === "radius" && zone.radiusMeters) {
        const radiusKm = Math.max(zone.radiusMeters / 1000, 1);
        // Gives up to +99 points to smaller radii (e.g. 1km gets +98, 10km gets +89)
        dynamicSpecificity = zone.specificityScore + Math.max(0, 99 - radiusKm);
      }

      results.push({
        zone: {
          id: zone.id,
          name: zone.name,
          zoneType: zone.zoneType,
          specificityScore: dynamicSpecificity,
          color: zone.color,
        },
        methods: zone.methods.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          methodType: m.methodType,
          rateType: m.rateType,
          baseRate: m.baseRate,
          perItemRate: m.perItemRate,
          perKgRate: m.perKgRate,
          freeShippingThreshold: m.freeShippingThreshold,
          minOrderAmount: m.minOrderAmount,
          minDeliveryDays: m.minDeliveryDays,
          maxDeliveryDays: m.maxDeliveryDays,
          estimatedTime: m.estimatedTime,
          handlingFee: m.handlingFee,
          includesTracking: m.includesTracking,
          includesInsurance: m.includesInsurance,
          insuranceRate: m.insuranceRate,
          pickupLocationName: m.pickupLocationName,
          pickupLocationAddress: m.pickupLocationAddress,
          pickupLocationLat: m.pickupLocationLat,
          pickupLocationLng: m.pickupLocationLng,
          displayOrder: m.displayOrder,
        })),
        matchReason: matchResult.reason,
      } as ZoneMatchResult & { _displayOrder: number });
    }
  }

  // Sort by dynamic specificity (descending), then by display order (ascending)
  results.sort((a, b) => {
    if (b.zone.specificityScore !== a.zone.specificityScore) {
      return b.zone.specificityScore - a.zone.specificityScore; // Highest score first
    }
    const aOrder = (a as ZoneMatchResult & { _displayOrder: number })
      ._displayOrder;
    const bOrder = (b as ZoneMatchResult & { _displayOrder: number })
      ._displayOrder;
    return aOrder - bOrder; // Lowest display order first
  });

  // Clean up the temporary sorting field
  return results.map((r) => {
    const { _displayOrder, ...cleanResult } = r as ZoneMatchResult & {
      _displayOrder?: number;
    };
    return cleanResult as ZoneMatchResult;
  });
}

/**
 * Get the best matching zone (highest specificity) for a location.
 * This is the primary zone that will be used for checkout.
 */
export async function getBestMatchingZone(
  tenantId: string,
  location: MatchLocationInput
): Promise<ZoneMatchResult | null> {
  const results = await findMatchingZones(tenantId, location);
  return results[0] ?? null;
}

/**
 * Calculate shipping rates for a specific zone and order.
 */
export async function calculateRates(
  tenantId: string,
  zoneId: string,
  orderData: {
    subtotal: number;
    itemCount: number;
    totalWeightKg?: number;
  }
): Promise<CalculatedRate[]> {
  const methods = await db.query.unifiedDeliveryMethods.findMany({
    where: and(
      eq(unifiedDeliveryMethods.tenantId, tenantId),
      eq(unifiedDeliveryMethods.zoneId, zoneId),
      eq(unifiedDeliveryMethods.isActive, true)
    ),
    with: {
      weightTiers: {
        orderBy: [asc(unifiedWeightTiers.minWeight)],
      },
    },
    orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
  });

  const rates: CalculatedRate[] = [];

  for (const method of methods) {
    // Check minimum order amount
    if (method.minOrderAmount) {
      const minAmount = parseFloat(method.minOrderAmount);
      if (orderData.subtotal < minAmount) {
        continue; // Skip this method - order too small
      }
    }

    // Check weight limits
    if (orderData.totalWeightKg !== undefined) {
      if (method.minWeight) {
        const minWeight = parseFloat(method.minWeight);
        if (orderData.totalWeightKg < minWeight) continue;
      }
      if (method.maxWeight) {
        const maxWeight = parseFloat(method.maxWeight);
        if (orderData.totalWeightKg > maxWeight) continue;
      }
    }

    const calculated = calculateMethodRate(method, orderData);
    rates.push({
      methodId: method.id,
      methodName: method.name,
      rate: calculated.rate,
      isFree: calculated.isFree,
      freeReason: calculated.freeReason,
      deliveryEstimate: getDeliveryEstimate(method),
    });
  }

  return rates;
}

// =============================================================================
// MATCHING LOGIC
// =============================================================================

interface MatchResult {
  matches: boolean;
  reason: string;
}

type ZoneData = {
  zoneType: string;
  countries: unknown;
  regions: unknown;
  cities: unknown;
  postalPatterns: unknown;
  centerLat: string | null;
  centerLng: string | null;
  radiusMeters: number | null;
  polygonGeojson: unknown;
};

/**
 * Check if a location matches a zone based on zone type.
 */
function matchLocationToZone(
  location: MatchLocationInput,
  zone: ZoneData
): MatchResult {
  switch (zone.zoneType) {
    case "worldwide":
      return { matches: true, reason: "Worldwide zone" };

    case "country":
      return matchCountry(location, zone.countries as string[] | null);

    case "region":
      return matchRegion(
        location,
        zone.countries as string[] | null,
        zone.regions as string[] | null
      );

    case "city":
      return matchCity(
        location,
        zone.countries as string[] | null,
        zone.cities as string[] | null
      );

    case "postal":
      return matchPostal(
        location,
        zone.countries as string[] | null,
        zone.postalPatterns as string[] | null
      );

    case "radius":
      return matchRadius(
        location,
        zone.centerLat,
        zone.centerLng,
        zone.radiusMeters
      );

    case "polygon":
      return matchPolygon(location, zone.polygonGeojson as Polygon | null);

    default:
      return { matches: false, reason: "Unknown zone type" };
  }
}

/**
 * Match by country code (ISO 3166-1 alpha-2).
 */
function matchCountry(
  location: MatchLocationInput,
  countries: string[] | null
): MatchResult {
  if (!countries || countries.length === 0) {
    return { matches: false, reason: "No countries defined" };
  }

  if (!location.country) {
    return { matches: false, reason: "No country in location data" };
  }

  const upperCountry = location.country.toUpperCase();
  const matches = countries.some((c) => c.toUpperCase() === upperCountry);

  return {
    matches,
    reason: matches
      ? `Country match: ${location.country}`
      : `Country ${location.country} not in zone`,
  };
}

/**
 * Match by region/state within specified countries.
 */
function matchRegion(
  location: MatchLocationInput,
  countries: string[] | null,
  regions: string[] | null
): MatchResult {
  // First check country
  const countryMatch = matchCountry(location, countries);
  if (!countryMatch.matches) {
    return countryMatch;
  }

  if (!regions || regions.length === 0) {
    return { matches: false, reason: "No regions defined" };
  }

  if (!location.region) {
    return { matches: false, reason: "No region in location data" };
  }

  const lowerRegion = location.region.toLowerCase();
  const matches = regions.some((r) => r.toLowerCase() === lowerRegion);

  return {
    matches,
    reason: matches
      ? `Region match: ${location.region}`
      : `Region ${location.region} not in zone`,
  };
}

/**
 * Match by city name within specified countries.
 */
function matchCity(
  location: MatchLocationInput,
  countries: string[] | null,
  cities: string[] | null
): MatchResult {
  // First check country
  const countryMatch = matchCountry(location, countries);
  if (!countryMatch.matches) {
    return countryMatch;
  }

  if (!cities || cities.length === 0) {
    return { matches: false, reason: "No cities defined" };
  }

  if (!location.city) {
    return { matches: false, reason: "No city in location data" };
  }

  const lowerCity = location.city.toLowerCase();
  const matches = cities.some((c) => c.toLowerCase() === lowerCity);

  return {
    matches,
    reason: matches
      ? `City match: ${location.city}`
      : `City ${location.city} not in zone`,
  };
}

/**
 * Match by postal code pattern (supports wildcards).
 */
function matchPostal(
  location: MatchLocationInput,
  countries: string[] | null,
  patterns: string[] | null
): MatchResult {
  // First check country
  const countryMatch = matchCountry(location, countries);
  if (!countryMatch.matches) {
    return countryMatch;
  }

  if (!patterns || patterns.length === 0) {
    return { matches: false, reason: "No postal patterns defined" };
  }

  if (!location.postalCode) {
    return { matches: false, reason: "No postal code in location data" };
  }

  const postal = location.postalCode.toUpperCase().replace(/\s/g, "");

  for (const pattern of patterns) {
    if (matchPostalPattern(postal, pattern)) {
      return { matches: true, reason: `Postal match: ${location.postalCode}` };
    }
  }

  return {
    matches: false,
    reason: `Postal code ${location.postalCode} not in zone`,
  };
}

/**
 * Check if a postal code matches a pattern.
 * Supports:
 * - Exact match: "10001"
 * - Wildcard: "1001*" matches 10010-10019
 * - Range: "10001-10010"
 */
function matchPostalPattern(postal: string, pattern: string): boolean {
  const normalizedPattern = pattern.toUpperCase().replace(/\s/g, "");

  // Wildcard match (e.g., "1001*")
  if (normalizedPattern.includes("*")) {
    const prefix = normalizedPattern.replace("*", "");
    return postal.startsWith(prefix);
  }

  // Range match (e.g., "10001-10010")
  if (normalizedPattern.includes("-")) {
    const [start, end] = normalizedPattern.split("-");
    // For numeric postal codes, check if within range
    const postalNum = parseInt(postal, 10);
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (!isNaN(postalNum) && !isNaN(startNum) && !isNaN(endNum)) {
      return postalNum >= startNum && postalNum <= endNum;
    }

    // For alphanumeric, do string comparison
    return postal >= start && postal <= end;
  }

  // Exact match
  return postal === normalizedPattern;
}

/**
 * Match by GPS radius (Haversine distance).
 */
function matchRadius(
  location: MatchLocationInput,
  centerLat: string | null,
  centerLng: string | null,
  radiusMeters: number | null
): MatchResult {
  if (!centerLat || !centerLng || !radiusMeters) {
    return { matches: false, reason: "Radius zone not properly configured" };
  }

  const lat = parseFloat(centerLat);
  const lng = parseFloat(centerLng);

  const distance = haversineDistance(location.lat, location.lng, lat, lng);
  const matches = distance <= radiusMeters;

  return {
    matches,
    reason: matches
      ? `Within ${(radiusMeters / 1000).toFixed(1)}km radius (${(distance / 1000).toFixed(1)}km away)`
      : `Outside radius: ${(distance / 1000).toFixed(1)}km > ${(radiusMeters / 1000).toFixed(1)}km`,
  };
}

/**
 * Calculate Haversine distance between two points in meters.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Match by GeoJSON polygon (point-in-polygon test).
 */
function matchPolygon(
  location: MatchLocationInput,
  polygon: Polygon | null
): MatchResult {
  if (!polygon || !polygon.coordinates || polygon.coordinates.length === 0) {
    return { matches: false, reason: "Polygon not properly configured" };
  }

  const point: Position = [location.lng, location.lat]; // GeoJSON uses [lng, lat]
  const matches = pointInPolygon(point, polygon.coordinates[0]); // Use outer ring

  return {
    matches,
    reason: matches ? "Inside polygon zone" : "Outside polygon zone",
  };
}

/**
 * Ray casting algorithm for point-in-polygon test.
 */
function pointInPolygon(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// =============================================================================
// RATE CALCULATION
// =============================================================================

interface RateResult {
  rate: number;
  isFree: boolean;
  freeReason?: string;
}

type MethodData = {
  rateType: string;
  baseRate: string;
  perItemRate: string | null;
  perKgRate: string | null;
  freeShippingThreshold: string | null;
  handlingFee: string | null;
  weightTiers?: Array<{
    minWeight: string;
    maxWeight: string | null;
    rate: string;
    perKgRateInTier: string | null;
  }>;
};

/**
 * Calculate the shipping rate for a method based on order data.
 */
function calculateMethodRate(
  method: MethodData,
  orderData: { subtotal: number; itemCount: number; totalWeightKg?: number }
): RateResult {
  const baseRate = parseFloat(method.baseRate) || 0;
  const handlingFee = method.handlingFee ? parseFloat(method.handlingFee) : 0;

  // Check for free shipping threshold
  if (method.freeShippingThreshold) {
    const threshold = parseFloat(method.freeShippingThreshold);
    if (orderData.subtotal >= threshold) {
      return {
        rate: 0,
        isFree: true,
        freeReason: `Free shipping on orders over ${threshold} AFN`,
      };
    }
  }

  let rate = baseRate;

  switch (method.rateType) {
    case "free":
      return { rate: 0, isFree: true, freeReason: "Free shipping" };

    case "flat":
      rate = baseRate;
      break;

    case "per_item":
      const perItemRate = method.perItemRate
        ? parseFloat(method.perItemRate)
        : 0;
      rate = baseRate + perItemRate * orderData.itemCount;
      break;

    case "weight_based":
      const perKgRate = method.perKgRate ? parseFloat(method.perKgRate) : 0;
      const weight = orderData.totalWeightKg || 0;
      rate = baseRate + perKgRate * weight;
      break;

    case "weight_tiered":
      rate = calculateWeightTieredRate(method, orderData.totalWeightKg || 0);
      break;

    case "price_based":
      // For price_based, we already checked free threshold above
      // Otherwise use base rate
      rate = baseRate;
      break;
  }

  return { rate: rate + handlingFee, isFree: false };
}

/**
 * Calculate rate using weight tiers.
 */
function calculateWeightTieredRate(
  method: MethodData,
  weightKg: number
): number {
  const tiers = method.weightTiers || [];

  if (tiers.length === 0) {
    return parseFloat(method.baseRate) || 0;
  }

  // Find the matching tier
  for (const tier of tiers) {
    const minWeight = parseFloat(tier.minWeight);
    const maxWeight = tier.maxWeight ? parseFloat(tier.maxWeight) : Infinity;

    if (weightKg >= minWeight && weightKg < maxWeight) {
      const tierRate = parseFloat(tier.rate);
      const perKgInTier = tier.perKgRateInTier
        ? parseFloat(tier.perKgRateInTier)
        : 0;

      // Calculate rate: tier base + per-kg for weight above tier minimum
      const weightInTier = weightKg - minWeight;
      return tierRate + perKgInTier * weightInTier;
    }
  }

  // If no tier matches (weight higher than all tiers), use the last tier
  const lastTier = tiers[tiers.length - 1];
  return parseFloat(lastTier.rate);
}

/**
 * Get human-readable delivery estimate.
 */
function getDeliveryEstimate(method: {
  estimatedTime: string | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
}): string | undefined {
  if (method.estimatedTime) {
    return method.estimatedTime;
  }

  if (method.minDeliveryDays && method.maxDeliveryDays) {
    if (method.minDeliveryDays === method.maxDeliveryDays) {
      return `${method.minDeliveryDays} day${method.minDeliveryDays > 1 ? "s" : ""}`;
    }
    return `${method.minDeliveryDays}-${method.maxDeliveryDays} days`;
  }

  if (method.minDeliveryDays) {
    return `${method.minDeliveryDays}+ days`;
  }

  if (method.maxDeliveryDays) {
    return `Up to ${method.maxDeliveryDays} days`;
  }

  return undefined;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { haversineDistance, pointInPolygon, matchPostalPattern };
