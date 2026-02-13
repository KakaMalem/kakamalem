import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";

// =============================================================================
// CHECKOUT VALIDATION SCHEMAS
// =============================================================================

/**
 * Guest checkout contact info schema
 * Phone-first approach for Afghanistan market where phone is the primary contact method
 * Name is collected in the delivery address section
 */
export const guestCheckoutSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((value) => isValidPhoneNumber(value), {
      message: "Please enter a valid phone number",
    }),
});

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

/**
 * Shipping address schema (GPS-based, matches Address type from schema.ts)
 * Name fields are optional - guests don't need to provide name
 * Name is collected when user creates an account
 */
export const shippingAddressSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((value) => isValidPhoneNumber(value), {
      message: "Please enter a valid phone number",
    }),
  // GPS location (mandatory)
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // Geospatial indexing (computed on save)
  h3Index: z.string().max(20).optional(),
  plusCode: z.string().max(20).optional(),
  // Reverse geocoded city name
  city: z.string().max(100).optional(),
  // Location quality metadata
  accuracy: z.number().min(0).optional(),
  source: z.enum(["gps", "manual"]).optional(),
  // Optional notes for delivery
  notes: z.string().max(500).optional(),
});

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

/**
 * Payment gateway options
 */
export const paymentGatewaySchema = z.enum([
  "hesabpay",
  "stripe",
  "cod",
  "bank_transfer",
  "mobile_money",
  "crypto_usdt",
]);

export type PaymentGateway = z.infer<typeof paymentGatewaySchema>;

/**
 * Full checkout submission schema
 */
export const checkoutSubmitSchema = z.object({
  // Contact info (required for guests, null if logged in)
  customerInfo: guestCheckoutSchema.nullable(),

  // Addresses
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema.nullable(),

  // Shipping selection (accepts UUID, zone-prefixed UUID, unified system IDs, or special values)
  shippingMethodId: z.string().refine(
    (val) => {
      // Accept special/synthetic shipping method IDs
      const specialIds = [
        "free-shipping",
        "free-delivery",
        "free-local-delivery",
        "unified-free-shipping",
      ];
      if (specialIds.includes(val)) return true;

      // Accept regular UUID (shipping method from database)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(val)) return true;

      // Accept zone-prefixed UUID (legacy GPS delivery zones: "zone-{uuid}")
      if (val.startsWith("zone-")) {
        return uuidRegex.test(val.slice(5));
      }

      // Accept unified delivery system format: "unified-{zoneId}-{methodId}"
      // Both zoneId and methodId should be UUIDs
      if (val.startsWith("unified-")) {
        const rest = val.slice(8); // Remove "unified-"
        const parts = rest.split("-");
        // UUID has 5 parts separated by dashes, so we expect 10 parts total (2 UUIDs)
        if (parts.length >= 10) {
          const firstUuid = parts.slice(0, 5).join("-");
          const secondUuid = parts.slice(5, 10).join("-");
          return uuidRegex.test(firstUuid) && uuidRegex.test(secondUuid);
        }
      }

      return false;
    },
    { message: "Invalid shipping method" }
  ),

  // Payment method (optional, defaults to COD)
  paymentMethod: paymentGatewaySchema.optional().default("cod"),

  // Optional notes
  customerNotes: z.string().max(1000).optional().nullable(),

  // Applied promo code (optional)
  appliedCouponCode: z.string().max(50).optional().nullable(),

  // Multi-currency (populated when customer uses a non-store currency)
  customerCurrency: z.string().length(3).optional().nullable(),
  exchangeRateUsed: z.number().positive().optional().nullable(),
  exchangeRateLockedAt: z.string().optional().nullable(),
});

export type CheckoutSubmitInput = z.infer<typeof checkoutSubmitSchema>;

/**
 * Customer snapshot for order record (immutable)
 */
export const customerSnapshotSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(), // Optional - phone is primary in Afghanistan
  phone: z.string().optional(), // Optional here, but checkout ensures it's provided
});

export type CustomerSnapshotInput = z.infer<typeof customerSnapshotSchema>;
