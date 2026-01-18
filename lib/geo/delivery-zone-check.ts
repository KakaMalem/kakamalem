import * as turf from "@turf/turf";
import type { DeliveryZone } from "@/lib/db/schema";

export type DeliveryZoneCheckResult = {
  isWithinZone: boolean;
  matchingZone: DeliveryZone | null;
  deliveryFee: number;
  minOrderAmount: number | null;
  freeShippingThreshold: number | null;
  estimatedDeliveryTime: string | null;
  allZones: DeliveryZone[];
};

/**
 * Check if a coordinate point is within any of the delivery zones.
 * Returns the smallest matching zone (by radius for circles) for best pricing.
 *
 * @param lat - Customer's latitude
 * @param lng - Customer's longitude
 * @param zones - Array of delivery zones to check against
 * @returns DeliveryZoneCheckResult with matching zone info or null if outside all zones
 */
export function checkDeliveryZone(
  lat: number,
  lng: number,
  zones: DeliveryZone[]
): DeliveryZoneCheckResult {
  const point = turf.point([lng, lat]); // GeoJSON uses [lng, lat] order

  // Filter to only active zones
  const activeZones = zones.filter((zone) => zone.isActive);

  // Sort by displayOrder (smaller zones should have lower displayOrder)
  // This ensures we check smaller/cheaper zones first
  const sortedZones = [...activeZones].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Find all matching zones
  const matchingZones: DeliveryZone[] = [];

  for (const zone of sortedZones) {
    if (isPointInZone(point, zone)) {
      matchingZones.push(zone);
    }
  }

  if (matchingZones.length === 0) {
    return {
      isWithinZone: false,
      matchingZone: null,
      deliveryFee: 0,
      minOrderAmount: null,
      freeShippingThreshold: null,
      estimatedDeliveryTime: null,
      allZones: activeZones,
    };
  }

  // For circles, sort matching zones by radius (smallest first) to get best rate
  // For polygons, we rely on displayOrder
  const bestMatch = matchingZones.reduce((best, current) => {
    if (current.zoneType === "circle" && best.zoneType === "circle") {
      const currentRadius = current.radiusMeters ?? Infinity;
      const bestRadius = best.radiusMeters ?? Infinity;
      return currentRadius < bestRadius ? current : best;
    }
    // Fall back to displayOrder
    return current.displayOrder < best.displayOrder ? current : best;
  }, matchingZones[0]);

  return {
    isWithinZone: true,
    matchingZone: bestMatch,
    deliveryFee: parseFloat(bestMatch.deliveryFee),
    minOrderAmount: bestMatch.minOrderAmount
      ? parseFloat(bestMatch.minOrderAmount)
      : null,
    freeShippingThreshold: bestMatch.freeShippingThreshold
      ? parseFloat(bestMatch.freeShippingThreshold)
      : null,
    estimatedDeliveryTime: bestMatch.estimatedDeliveryTime,
    allZones: activeZones,
  };
}

/**
 * Check if a point is within a specific delivery zone
 */
function isPointInZone(
  point: ReturnType<typeof turf.point>,
  zone: DeliveryZone
): boolean {
  if (zone.zoneType === "circle") {
    return isPointInCircle(point, zone);
  } else if (zone.zoneType === "polygon") {
    return isPointInPolygon(point, zone);
  }
  return false;
}

/**
 * Check if a point is within a circular zone
 */
function isPointInCircle(
  point: ReturnType<typeof turf.point>,
  zone: DeliveryZone
): boolean {
  if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) {
    return false;
  }

  const centerLat = parseFloat(zone.centerLat);
  const centerLng = parseFloat(zone.centerLng);
  const radiusKm = zone.radiusMeters / 1000; // Convert meters to km

  // Create a circle polygon using Turf
  const center = turf.point([centerLng, centerLat]);
  const circle = turf.circle(center, radiusKm, { units: "kilometers" });

  // Check if point is inside the circle
  return turf.booleanPointInPolygon(point, circle);
}

/**
 * Check if a point is within a polygon zone
 */
function isPointInPolygon(
  point: ReturnType<typeof turf.point>,
  zone: DeliveryZone
): boolean {
  if (!zone.polygonCoordinates || zone.polygonCoordinates.length < 3) {
    return false;
  }

  // Create polygon from coordinates
  // Ensure the polygon is closed (first point = last point)
  const coords = zone.polygonCoordinates;
  const closedCoords =
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];

  const polygon = turf.polygon([closedCoords]);

  return turf.booleanPointInPolygon(point, polygon);
}

/**
 * Calculate distance from a point to the center of a zone (in meters)
 */
export function distanceToZoneCenter(
  lat: number,
  lng: number,
  zone: DeliveryZone
): number | null {
  if (zone.zoneType !== "circle" || !zone.centerLat || !zone.centerLng) {
    return null;
  }

  const from = turf.point([lng, lat]);
  const to = turf.point([
    parseFloat(zone.centerLng),
    parseFloat(zone.centerLat),
  ]);

  // Distance in kilometers
  const distanceKm = turf.distance(from, to, { units: "kilometers" });

  // Return in meters
  return distanceKm * 1000;
}

/**
 * Get all zones that contain a point, sorted by delivery fee (cheapest first)
 */
export function getMatchingZonesByFee(
  lat: number,
  lng: number,
  zones: DeliveryZone[]
): DeliveryZone[] {
  const point = turf.point([lng, lat]);
  const activeZones = zones.filter((zone) => zone.isActive);

  const matchingZones = activeZones.filter((zone) =>
    isPointInZone(point, zone)
  );

  // Sort by delivery fee (cheapest first)
  return matchingZones.sort(
    (a, b) => parseFloat(a.deliveryFee) - parseFloat(b.deliveryFee)
  );
}

/**
 * Format radius for display (converts to km if >= 1000m)
 */
export function formatRadius(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Convert radius display string back to meters
 */
export function parseRadiusToMeters(radiusStr: string): number {
  const match = radiusStr.match(/^([\d.]+)\s*(km|m)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || "m").toLowerCase();

  return unit === "km" ? value * 1000 : value;
}
