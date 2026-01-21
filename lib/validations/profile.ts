import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Validates phone number using libphonenumber-js (E.164 format)
 * Defined here instead of importing from phone-input.tsx to avoid
 * importing React client components into server actions
 */
export const phoneSchemaServer = z
  .string()
  .min(1, "Phone number is required")
  .refine((value) => isValidPhoneNumber(value), {
    message: "Please enter a valid phone number",
  });

/**
 * Schema for updating user phone number
 */
export const updatePhoneSchema = z.object({
  phone: phoneSchemaServer,
});

export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
