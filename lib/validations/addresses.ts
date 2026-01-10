import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";

// =============================================================================
// ADDRESS VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for creating/updating user addresses
 * Used by both client-side forms and server actions
 */
export const addressSchema = z.object({
  // Name fields are optional when authenticated (filled from user profile)
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
  // Location quality metadata (passed from LocationPicker)
  accuracy: z.number().min(0).optional(),
  source: z.enum(["gps", "manual"]).optional(),
  // Optional notes for delivery (landmarks, directions, building details)
  notes: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
