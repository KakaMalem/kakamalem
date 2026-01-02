import { z } from "zod";

// Slug validation pattern: lowercase letters, numbers, and hyphens only
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Phone validation: allows international formats
// Examples: +93 700 123456, 0700123456, +1-555-123-4567
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

// URL validation regex
const urlRegex =
  /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Header display options
export const headerDisplayOptions = [
  "logo_only",
  "name_only",
  "logo_and_name",
] as const;

// Currency options
export const currencyOptions = ["AFN", "USD"] as const;

// Create store validation schema (for wizard)
export const createStoreSchema = z.object({
  // Step 1: Basic Info
  name: z
    .string()
    .min(1, "Store name is required")
    .min(2, "Store name must be at least 2 characters")
    .max(255, "Store name must be less than 255 characters"),
  slug: z
    .string()
    .min(1, "Store URL is required")
    .min(3, "Store URL must be at least 3 characters")
    .max(63, "Store URL must be less than 63 characters")
    .regex(
      slugRegex,
      "Store URL can only contain lowercase letters, numbers, and hyphens"
    ),
  tagline: z
    .string()
    .max(255, "Tagline must be less than 255 characters")
    .optional()
    .or(z.literal("")),

  // Step 2: Branding
  logoUrl: z
    .string()
    .regex(urlRegex, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  headerDisplay: z.enum(headerDisplayOptions).default("name_only"),

  // Step 3: Contact & Currency
  contactEmail: z
    .string()
    .regex(emailRegex, "Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .regex(phoneRegex, "Please enter a valid phone number (e.g., +93 700 123456)")
    .min(7, "Phone number must be at least 7 digits")
    .max(20, "Phone number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  currency: z.enum(currencyOptions).default("AFN"),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

// General settings validation schema
export const generalSettingsSchema = z.object({
  name: z
    .string()
    .min(1, "Store name is required")
    .min(2, "Store name must be at least 2 characters")
    .max(255, "Store name must be less than 255 characters"),
  tagline: z
    .string()
    .max(255, "Tagline must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .or(z.literal("")),
  contactEmail: z
    .string()
    .regex(emailRegex, "Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .regex(phoneRegex, "Please enter a valid phone number (e.g., +93 700 123456)")
    .min(7, "Phone number must be at least 7 digits")
    .max(20, "Phone number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  currency: z.enum(currencyOptions).default("AFN"),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

// Branding settings validation schema
export const brandingSettingsSchema = z.object({
  logoUrl: z
    .string()
    .regex(urlRegex, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  faviconUrl: z
    .string()
    .regex(urlRegex, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  headerDisplay: z.enum(headerDisplayOptions).default("logo_and_name"),
});

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>;

// Social links validation schema
export const socialLinksSchema = z.object({
  facebook: z
    .string()
    .regex(urlRegex, "Please enter a valid Facebook URL")
    .optional()
    .or(z.literal("")),
  instagram: z
    .string()
    .regex(urlRegex, "Please enter a valid Instagram URL")
    .optional()
    .or(z.literal("")),
  twitter: z
    .string()
    .regex(urlRegex, "Please enter a valid Twitter/X URL")
    .optional()
    .or(z.literal("")),
  whatsapp: z
    .string()
    .regex(phoneRegex, "Please enter a valid WhatsApp number (e.g., +93 700 123456)")
    .min(7, "WhatsApp number must be at least 7 digits")
    .max(20, "WhatsApp number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  telegram: z
    .string()
    .regex(urlRegex, "Please enter a valid Telegram URL")
    .optional()
    .or(z.literal("")),
  tiktok: z
    .string()
    .regex(urlRegex, "Please enter a valid TikTok URL")
    .optional()
    .or(z.literal("")),
  youtube: z
    .string()
    .regex(urlRegex, "Please enter a valid YouTube URL")
    .optional()
    .or(z.literal("")),
});

export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

// SEO settings validation schema
export const seoSettingsSchema = z.object({
  metaTitle: z
    .string()
    .max(60, "Meta title should be 60 characters or less for best SEO")
    .optional()
    .or(z.literal("")),
  metaDescription: z
    .string()
    .max(160, "Meta description should be 160 characters or less for best SEO")
    .optional()
    .or(z.literal("")),
  ogImageUrl: z
    .string()
    .regex(urlRegex, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type SeoSettingsInput = z.infer<typeof seoSettingsSchema>;

// Helper function to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}
