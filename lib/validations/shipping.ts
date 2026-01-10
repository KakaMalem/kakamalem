import { z } from "zod";

// =============================================================================
// SHIPPING VALIDATION SCHEMAS
// =============================================================================

/**
 * Shipping Zone schema
 */
export const shippingZoneSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional().nullable(),
  countries: z.array(z.string().max(10)).optional().nullable(),
  states: z.array(z.string().max(100)).optional().nullable(),
  cities: z.array(z.string().max(100)).optional().nullable(),
  postalCodes: z.array(z.string().max(20)).optional().nullable(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;

/**
 * Shipping Rate Type enum
 */
export const shippingRateTypes = [
  "flat",
  "per_item",
  "weight_based",
  "weight_tiered",
  "price_based",
] as const;

export type ShippingRateType = (typeof shippingRateTypes)[number];

/**
 * Shipping Method schema
 */
export const shippingMethodSchema = z.object({
  zoneId: z.string().uuid("Invalid zone ID"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional().nullable(),

  // Delivery time estimates
  minDeliveryDays: z.number().int().min(0).max(365).optional().nullable(),
  maxDeliveryDays: z.number().int().min(0).max(365).optional().nullable(),

  // Rate configuration
  rateType: z.enum(shippingRateTypes).default("flat"),

  // Base/flat rate
  baseRate: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format")
    .default("0"),

  // Per-item rate (for per_item type)
  perItemRate: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format")
    .optional()
    .nullable(),

  // Per-kg rate (for weight_based type)
  perKgRate: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format")
    .optional()
    .nullable(),

  // Free shipping threshold
  freeShippingThreshold: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid threshold format")
    .optional()
    .nullable(),

  // Weight limits
  minWeight: z
    .string()
    .regex(/^\d+(\.\d{0,3})?$/, "Invalid weight format")
    .optional()
    .nullable(),
  maxWeight: z
    .string()
    .regex(/^\d+(\.\d{0,3})?$/, "Invalid weight format")
    .optional()
    .nullable(),

  // Handling fee
  handlingFee: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid fee format")
    .optional()
    .nullable(),

  // Insurance
  includesInsurance: z.boolean().default(false),
  insuranceRate: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format")
    .optional()
    .nullable(),

  // Tracking
  includesTracking: z.boolean().default(true),

  // Display
  displayOrder: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;

/**
 * Weight tier schema (for weight_tiered methods)
 */
export const weightTierSchema = z.object({
  methodId: z.string().uuid("Invalid method ID"),
  minWeight: z
    .string()
    .regex(/^\d+(\.\d{0,3})?$/, "Invalid weight format")
    .transform((v) => v),
  maxWeight: z
    .string()
    .regex(/^\d+(\.\d{0,3})?$/, "Invalid weight format")
    .optional()
    .nullable(),
  rate: z.string().regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format"),
  perKgRateInTier: z
    .string()
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid rate format")
    .optional()
    .nullable(),
});

export type WeightTierInput = z.infer<typeof weightTierSchema>;
