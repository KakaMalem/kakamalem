import { z } from "zod";

// Delivery zone validation schema
export const deliveryZoneSchema = z.object({
  name: z
    .string()
    .min(1, "Zone name is required")
    .min(2, "Zone name must be at least 2 characters")
    .max(100, "Zone name must be less than 100 characters"),
  zoneType: z.enum(["circle", "polygon"]).default("circle"),
  // Circle parameters
  centerLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  centerLng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  radiusMeters: z
    .number()
    .int()
    .min(100, "Radius must be at least 100 meters")
    .max(100000, "Radius cannot exceed 100 km")
    .optional(),
  // Polygon coordinates (for future use)
  polygonCoordinates: z.array(z.array(z.number()).length(2)).optional(),
  // Delivery settings
  deliveryFee: z.number().min(0, "Delivery fee cannot be negative").default(0),
  minOrderAmount: z
    .number()
    .min(0, "Minimum order cannot be negative")
    .optional()
    .nullable(),
  freeShippingThreshold: z
    .number()
    .min(0, "Free shipping threshold cannot be negative")
    .optional()
    .nullable(),
  estimatedDeliveryTime: z
    .string()
    .max(50, "Estimated time must be less than 50 characters")
    .optional()
    .nullable(),
  // Display settings
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .default("#3b82f6"),
});

// Refine to require circle parameters when zoneType is "circle"
export const deliveryZoneCreateSchema = deliveryZoneSchema.refine(
  (data) => {
    if (data.zoneType === "circle") {
      return (
        data.centerLat !== undefined &&
        data.centerLng !== undefined &&
        data.radiusMeters !== undefined
      );
    }
    return true;
  },
  {
    message: "Circle zones require center coordinates and radius",
    path: ["centerLat"],
  }
);

export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;

// Reorder schema for drag-and-drop
export const reorderDeliveryZonesSchema = z.object({
  zoneIds: z.array(z.string().uuid()).min(1, "At least one zone is required"),
});

export type ReorderDeliveryZonesInput = z.infer<
  typeof reorderDeliveryZonesSchema
>;
