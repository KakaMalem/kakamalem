"use client";

import { useState, useEffect, useCallback } from "react";
import type { CountriesGeoJSON } from "@/lib/delivery/types";
import { GEOJSON_PATHS } from "@/lib/delivery/geojson-config";

interface UseGeoJSONOptions {
  enabled?: boolean;
}

interface UseGeoJSONResult {
  data: CountriesGeoJSON | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Session storage key for caching
const CACHE_KEY = "geojson-countries-cache";
const CACHE_TIMESTAMP_KEY = "geojson-countries-timestamp";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Check if running in browser
const isBrowser = typeof window !== "undefined";

// Get cached data from session storage
function getCachedData(): CountriesGeoJSON | null {
  if (!isBrowser) return null;

  try {
    const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return null;

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > CACHE_TTL) {
      // Cache expired
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    return JSON.parse(cached) as CountriesGeoJSON;
  } catch {
    return null;
  }
}

// Save data to session storage
function setCachedData(data: CountriesGeoJSON): void {
  if (!isBrowser) return;

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    // Session storage might be full or disabled
    console.warn("Failed to cache GeoJSON data:", error);
  }
}

/**
 * Hook for loading and caching GeoJSON country data
 */
export function useCountriesGeoJSON(
  options: UseGeoJSONOptions = {}
): UseGeoJSONResult {
  const { enabled = true } = options;

  const [data, setData] = useState<CountriesGeoJSON | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Check cache first
    const cached = getCachedData();
    if (cached) {
      setData(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(GEOJSON_PATHS.countries);

      if (!response.ok) {
        throw new Error(`Failed to load GeoJSON: ${response.status}`);
      }

      const json = (await response.json()) as CountriesGeoJSON;

      // Cache the data
      setCachedData(json);
      setData(json);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to load GeoJSON");
      setError(error);
      console.error("GeoJSON load error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Get ISO code from feature properties (handles different property naming conventions)
 */
export function getCountryCode(properties: Record<string, unknown>): string {
  return (
    (properties["ISO3166-1-Alpha-2"] as string) ||
    (properties["ISO_A2"] as string) ||
    (properties["iso_a2"] as string) ||
    ""
  ).toUpperCase();
}

/**
 * Get country name from feature properties
 */
export function getCountryNameFromFeature(
  properties: Record<string, unknown>
): string {
  return (
    (properties["name"] as string) ||
    (properties["ADMIN"] as string) ||
    (properties["NAME"] as string) ||
    "Unknown"
  );
}
