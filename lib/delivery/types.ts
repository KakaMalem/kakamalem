// Unified Delivery System Types

export type UnifiedZoneType =
  | "polygon"
  | "radius"
  | "postal"
  | "city"
  | "region"
  | "country"
  | "worldwide";

export type DeliveryMethodType =
  | "local_delivery"
  | "standard"
  | "express"
  | "pickup"
  | "custom";

export type RateCalculationType =
  | "flat"
  | "per_item"
  | "weight_based"
  | "weight_tiered"
  | "price_based"
  | "free";

export interface UnifiedDeliveryZone {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  zoneType: UnifiedZoneType;

  // Geographic fields
  countries: string[];
  regions: string[];
  cities: string[];
  postalCodes: string[];
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
  polygonGeojson?: GeoJSON.Polygon | null;

  // Display
  color: string;
  icon?: string | null;
  priority: number;
  displayOrder: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedDeliveryMethod {
  id: string;
  zoneId: string;
  tenantId: string;

  name: string;
  description?: string | null;
  methodType: DeliveryMethodType;

  // Time estimates
  minDeliveryMinutes?: number | null;
  maxDeliveryMinutes?: number | null;
  minDeliveryDays?: number | null;
  maxDeliveryDays?: number | null;
  estimatedDeliveryText?: string | null;

  // Rate calculation
  rateType: RateCalculationType;
  baseRate: number;
  perItemRate?: number | null;
  perKgRate?: number | null;

  // Thresholds
  freeShippingThreshold?: number | null;
  minOrderAmount?: number | null;

  // Weight limits
  minWeightKg?: number | null;
  maxWeightKg?: number | null;

  // Fees & features
  handlingFee: number;
  includesTracking: boolean;
  includesInsurance: boolean;
  insuranceRate?: number | null;

  // Display
  displayOrder: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface ZoneWithMethods extends UnifiedDeliveryZone {
  methods: UnifiedDeliveryMethod[];
}

export interface ZoneMatchResult {
  zone: ZoneWithMethods;
  methods: UnifiedDeliveryMethod[];
  specificity: number;
  matchReason: string;
}

export interface MatchLocationInput {
  lat: number;
  lng: number;
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
}

export interface CalculatedRate {
  methodId: string;
  rate: number;
  isFree: boolean;
  freeReason?: string;
}

// GeoJSON types for country data
export interface CountryFeatureProperties {
  name: string;
  "ISO3166-1-Alpha-2": string;
  "ISO3166-1-Alpha-3": string;
  ISO_A2?: string;
  ISO_A3?: string;
  ADMIN?: string;
}

export interface CountryFeature extends GeoJSON.Feature<
  GeoJSON.MultiPolygon | GeoJSON.Polygon
> {
  properties: CountryFeatureProperties;
}

export interface CountriesGeoJSON extends GeoJSON.FeatureCollection {
  features: CountryFeature[];
}
