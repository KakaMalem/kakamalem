import { z } from "zod";

// =============================================================================
// UNIFIED ZONE TYPE ENUM
// =============================================================================

export const unifiedZoneTypeSchema = z.enum([
  "polygon",
  "radius",
  "postal",
  "city",
  "region",
  "country",
  "worldwide",
]);

export type UnifiedZoneType = z.infer<typeof unifiedZoneTypeSchema>;

// =============================================================================
// DELIVERY METHOD TYPE ENUM
// =============================================================================

export const deliveryMethodTypeSchema = z.enum([
  "local_delivery",
  "standard",
  "express",
  "pickup",
  "custom",
]);

export type DeliveryMethodType = z.infer<typeof deliveryMethodTypeSchema>;

// =============================================================================
// RATE CALCULATION TYPE ENUM
// =============================================================================

export const rateCalculationTypeSchema = z.enum([
  "flat",
  "per_item",
  "weight_based",
  "weight_tiered",
  "price_based",
  "free",
]);

export type RateCalculationType = z.infer<typeof rateCalculationTypeSchema>;

// =============================================================================
// SPECIFICITY SCORES FOR ZONE TYPES
// =============================================================================

export const ZONE_SPECIFICITY_SCORES: Record<UnifiedZoneType, number> = {
  polygon: 600,
  radius: 500,
  postal: 400,
  city: 300,
  region: 200,
  country: 100,
  worldwide: 10,
};

// =============================================================================
// GeoJSON Polygon Schema
// =============================================================================

const coordinateSchema = z.tuple([z.number(), z.number()]); // [lng, lat]
const linearRingSchema = z.array(coordinateSchema).min(4); // At least 4 points (closed ring)

export const polygonGeojsonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(linearRingSchema).min(1), // At least one ring (outer)
});

export type PolygonGeojson = z.infer<typeof polygonGeojsonSchema>;

// =============================================================================
// BASE UNIFIED DELIVERY ZONE SCHEMA (without refinements)
// =============================================================================

// Base schema without refinements - used for .partial() and extensions
const unifiedZoneBaseSchema = z.object({
  name: z.string().min(1, "Zone name is required").max(100),
  zoneType: unifiedZoneTypeSchema,

  // Polygon zone data
  polygonGeojson: polygonGeojsonSchema.optional(),

  // Radius zone data
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().min(100).max(500000).optional(), // 100m to 500km

  // Location-based zone data
  countries: z.array(z.string().length(2)).default([]), // ISO 3166-1 alpha-2
  regions: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  postalPatterns: z.array(z.string()).default([]),

  // Display settings
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .default("#3b82f6"),
  displayOrder: z.number().int().min(0).default(0),

  // Status
  isActive: z.boolean().default(true),
});

// =============================================================================
// ZONE TYPE REFINEMENT FUNCTION
// =============================================================================

function validateZoneTypeRequirements(
  data: z.infer<typeof unifiedZoneBaseSchema>,
  ctx: z.RefinementCtx
) {
  // Validate based on zone type
  switch (data.zoneType) {
    case "polygon":
      if (!data.polygonGeojson) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Polygon GeoJSON is required for polygon zones",
          path: ["polygonGeojson"],
        });
      }
      break;

    case "radius":
      if (data.centerLat === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Center latitude is required for radius zones",
          path: ["centerLat"],
        });
      }
      if (data.centerLng === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Center longitude is required for radius zones",
          path: ["centerLng"],
        });
      }
      if (data.radiusMeters === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Radius is required for radius zones",
          path: ["radiusMeters"],
        });
      }
      break;

    case "postal":
      if (data.postalPatterns.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one postal pattern is required",
          path: ["postalPatterns"],
        });
      }
      if (data.countries.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one country is required for postal zones",
          path: ["countries"],
        });
      }
      break;

    case "city":
      if (data.cities.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one city is required",
          path: ["cities"],
        });
      }
      if (data.countries.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one country is required for city zones",
          path: ["countries"],
        });
      }
      break;

    case "region":
      if (data.regions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one region is required",
          path: ["regions"],
        });
      }
      if (data.countries.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one country is required for region zones",
          path: ["countries"],
        });
      }
      break;

    case "country":
      if (data.countries.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one country is required",
          path: ["countries"],
        });
      }
      break;

    case "worldwide":
      // No additional validation needed for worldwide
      break;
  }
}

// =============================================================================
// CREATE UNIFIED DELIVERY ZONE (with refinements)
// =============================================================================

export const createUnifiedZoneSchema = unifiedZoneBaseSchema.superRefine(
  validateZoneTypeRequirements
);

export type CreateUnifiedZoneInput = z.infer<typeof createUnifiedZoneSchema>;

// =============================================================================
// UPDATE UNIFIED DELIVERY ZONE (partial, without create-time refinements)
// =============================================================================

// For updates, we use the base schema with partial - refinements are applied
// only when the full zone data is being validated (e.g., on save with complete data)
export const updateUnifiedZoneSchema = unifiedZoneBaseSchema.partial();

export type UpdateUnifiedZoneInput = z.infer<typeof updateUnifiedZoneSchema>;

// =============================================================================
// CREATE UNIFIED DELIVERY METHOD
// =============================================================================

export const createUnifiedMethodSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().min(1, "Method name is required").max(255),
  description: z.string().max(1000).optional(),

  // Method type
  methodType: deliveryMethodTypeSchema,

  // Delivery time estimates
  minDeliveryDays: z.number().int().min(0).optional(),
  maxDeliveryDays: z.number().int().min(0).optional(),
  estimatedTime: z.string().max(50).optional(), // "30-45 minutes"

  // Rate calculation
  rateType: rateCalculationTypeSchema.default("flat"),
  baseRate: z.number().min(0).default(0),
  perItemRate: z.number().min(0).optional(),
  perKgRate: z.number().min(0).optional(),

  // Thresholds
  freeShippingThreshold: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),

  // Weight limits
  minWeight: z.number().min(0).optional(),
  maxWeight: z.number().min(0).optional(),

  // Handling and insurance
  handlingFee: z.number().min(0).default(0),
  includesInsurance: z.boolean().default(false),
  insuranceRate: z.number().min(0).max(100).optional(), // Percentage
  includesTracking: z.boolean().default(true),

  // Pickup location (for pickup type)
  pickupLocationName: z.string().max(255).optional(),
  pickupLocationAddress: z.string().max(1000).optional(),
  pickupLocationLat: z.number().min(-90).max(90).optional(),
  pickupLocationLng: z.number().min(-180).max(180).optional(),

  // Display settings
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type CreateUnifiedMethodInput = z.infer<
  typeof createUnifiedMethodSchema
>;

// =============================================================================
// UPDATE UNIFIED DELIVERY METHOD
// =============================================================================

export const updateUnifiedMethodSchema = createUnifiedMethodSchema
  .partial()
  .omit({ zoneId: true });

export type UpdateUnifiedMethodInput = z.infer<
  typeof updateUnifiedMethodSchema
>;

// =============================================================================
// WEIGHT TIER SCHEMA
// =============================================================================

export const weightTierSchema = z.object({
  minWeight: z.number().min(0),
  maxWeight: z.number().min(0).nullable(), // null = unlimited
  rate: z.number().min(0),
  perKgRateInTier: z.number().min(0).optional(),
});

export type WeightTierInput = z.infer<typeof weightTierSchema>;

// =============================================================================
// CREATE METHOD WITH WEIGHT TIERS
// =============================================================================

export const createMethodWithTiersSchema = createUnifiedMethodSchema.extend({
  weightTiers: z.array(weightTierSchema).optional(),
});

export type CreateMethodWithTiersInput = z.infer<
  typeof createMethodWithTiersSchema
>;

// =============================================================================
// BULK UPDATE ZONE ORDER
// =============================================================================

export const bulkUpdateZoneOrderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    displayOrder: z.number().int().min(0),
  })
);

export type BulkUpdateZoneOrderInput = z.infer<
  typeof bulkUpdateZoneOrderSchema
>;

// =============================================================================
// ZONE MATCH INPUT (for checkout)
// =============================================================================

export const zoneMatchInputSchema = z.object({
  // GPS coordinates
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  // Optional location data (for faster matching)
  country: z.string().length(2).optional(), // ISO alpha-2
  region: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export type ZoneMatchInput = z.infer<typeof zoneMatchInputSchema>;
