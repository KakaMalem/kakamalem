import { latLngToCell, cellToLatLng, gridDisk } from "h3-js";
import { OpenLocationCode } from "open-location-code";

// Instantiate the OpenLocationCode class
const olc = new OpenLocationCode();

// H3 resolution 9 = ~175m hexagons (good for city-level delivery zones)
// See: https://h3geo.org/docs/core-library/restable
const H3_RESOLUTION = 9;

// Plus Code precision 10 = ~14m x 14m area
const PLUS_CODE_PRECISION = 10;

/**
 * Compute H3 index from latitude/longitude
 * Used for efficient zone matching and proximity searches
 */
export function computeH3Index(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Get center coordinates of an H3 cell
 */
export function h3ToLatLng(h3Index: string): {
  latitude: number;
  longitude: number;
} {
  const [lat, lng] = cellToLatLng(h3Index);
  return { latitude: lat, longitude: lng };
}

/**
 * Get neighboring H3 cells (for proximity searches)
 * @param h3Index - The center cell
 * @param ringSize - Number of rings (1 = immediate neighbors, 2 = neighbors of neighbors, etc.)
 */
export function getNeighborCells(
  h3Index: string,
  ringSize: number = 1
): string[] {
  return gridDisk(h3Index, ringSize);
}

/**
 * Compute Plus Code from latitude/longitude
 * Plus Codes are human-readable location codes that can be shared easily
 * e.g., "8J7XMJRV+97" for a location in Kabul
 */
export function computePlusCode(lat: number, lng: number): string {
  return olc.encode(lat, lng, PLUS_CODE_PRECISION);
}

/**
 * Decode a Plus Code to latitude/longitude
 * Returns null if the code is invalid
 */
export function decodePlusCode(
  code: string
): { latitude: number; longitude: number } | null {
  try {
    if (!olc.isValid(code)) {
      return null;
    }
    const decoded = olc.decode(code);
    return {
      latitude: decoded.latitudeCenter,
      longitude: decoded.longitudeCenter,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a Plus Code is valid
 */
export function isValidPlusCode(code: string): boolean {
  return olc.isValid(code);
}

/**
 * Shorten a Plus Code using a reference location (city name)
 * e.g., "8J7XMJRV+97" -> "MJRV+97 Kabul"
 */
export function shortenPlusCode(
  fullCode: string,
  referenceLatitude: number,
  referenceLongitude: number
): string {
  try {
    return olc.shorten(fullCode, referenceLatitude, referenceLongitude);
  } catch {
    return fullCode;
  }
}

/**
 * Recover a shortened Plus Code to full code
 * e.g., "MJRV+97" with Kabul reference -> "8J7XMJRV+97"
 */
export function recoverPlusCode(
  shortCode: string,
  referenceLatitude: number,
  referenceLongitude: number
): string {
  try {
    return olc.recoverNearest(shortCode, referenceLatitude, referenceLongitude);
  } catch {
    return shortCode;
  }
}

/**
 * Reverse geocode coordinates to get city name using Nominatim (OpenStreetMap)
 * Free API, no key required, works globally
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns City name in English or null if not found
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`,
      {
        headers: {
          // Required by Nominatim usage policy
          "User-Agent": "KakaMalem/1.0 (delivery-platform)",
          "Accept-Language": "en",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Nominatim returns address components in different fields
    // Priority: city > town > village > municipality > county
    const address = data.address;
    if (!address) {
      return null;
    }

    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      address.state ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Format Plus Code for display with city name
 * Shows the full Plus Code followed by the city name.
 * Note: We don't shorten Plus Codes because proper shortening requires
 * knowing the city center coordinates, and shortened codes are less
 * portable (they only work near the reference location).
 * @param plusCode - Full Plus Code (e.g., "8J6FG5RC+J6")
 * @param city - City name from reverse geocoding (e.g., "Kabul", "Dubai")
 */
export function formatPlusCodeForDisplay(
  plusCode: string,
  city?: string | null
): string {
  if (!city) {
    return plusCode;
  }
  return `${plusCode} ${city}`;
}
