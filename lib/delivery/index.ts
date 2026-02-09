// Unified Delivery System - Main Exports

// Types (from types.ts - the original type definitions)
export type {
  UnifiedZoneType,
  DeliveryMethodType,
  RateCalculationType,
  UnifiedDeliveryZone,
  UnifiedDeliveryMethod,
  ZoneWithMethods,
  CountryFeatureProperties,
  CountryFeature,
  CountriesGeoJSON,
} from "./types";

// Configuration
export * from "./geojson-config";

// Zone matching (core functionality)
export {
  findMatchingZones,
  getBestMatchingZone,
  calculateRates,
  haversineDistance,
  pointInPolygon,
  matchPostalPattern,
  type MatchLocationInput,
  type MatchedZone,
  type MatchedMethod,
  type ZoneMatchResult,
  type CalculatedRate,
} from "./zone-matcher";
