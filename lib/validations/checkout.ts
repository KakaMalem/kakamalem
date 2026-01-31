import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";

// =============================================================================
// CHECKOUT VALIDATION SCHEMAS
// =============================================================================

/**
 * Guest checkout contact info schema
 */
export const guestCheckoutSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
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
 * Name fields are optional when user is logged in (taken from account)
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

  // Shipping selection (accepts UUID, zone-prefixed UUID, or special values)
  shippingMethodId: z.string().refine(
    (val) => {
      // Accept "free-shipping" for stores with no shipping rates configured
      if (val === "free-shipping") return true;
      // Accept regular UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(val)) return true;
      // Accept zone-prefixed UUID (for GPS delivery zones)
      if (val.startsWith("zone-")) {
        return uuidRegex.test(val.slice(5));
      }
      return false;
    },
    { message: "Invalid shipping method" }
  ),

  // Payment method (optional, defaults to COD)
  paymentMethod: paymentGatewaySchema.optional().default("cod"),

  // Optional notes
  customerNotes: z.string().max(1000).optional().nullable(),
});

export type CheckoutSubmitInput = z.infer<typeof checkoutSubmitSchema>;

/**
 * Customer snapshot for order record (immutable)
 */
export const customerSnapshotSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
});

export type CustomerSnapshotInput = z.infer<typeof customerSnapshotSchema>;
