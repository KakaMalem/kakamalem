import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { slugifyAscii } from "@/lib/utils/slug";

// Slug validation pattern: lowercase letters, numbers, and hyphens only
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// URL validation regex
const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

// Image URL regex - allows both full URLs and relative paths (like /uploads/...)
const imageUrlRegex =
  /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$|^\/[/\w .-]+$/i;

/**
 * Optional phone schema - validates if provided, allows empty string
 */
const optionalPhoneSchema = z
  .string()
  .refine((value) => !value || isValidPhoneNumber(value), {
    message: "Please enter a valid phone number",
  })
  .optional()
  .or(z.literal(""));

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
  contactPhone: optionalPhoneSchema,
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
  contactPhone: optionalPhoneSchema,
  currency: z.enum(currencyOptions).default("AFN"),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

// Branding settings validation schema
export const brandingSettingsSchema = z.object({
  logoUrl: z
    .string()
    .regex(imageUrlRegex, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  faviconUrl: z
    .string()
    .regex(imageUrlRegex, "Please enter a valid URL")
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
  whatsapp: optionalPhoneSchema,
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

// Store mode options
export const storeModeOptions = [
  "full",
  "online_only",
  "offline_only",
  "catalog",
] as const;

export type StoreMode = (typeof storeModeOptions)[number];

// Store mode labels for UI
export const storeModeLabels: Record<StoreMode, string> = {
  full: "Full Commerce",
  online_only: "Online Store Only",
  offline_only: "Point of Sale Only",
  catalog: "Catalog / Showcase",
};

// Store mode descriptions for UI
export const storeModeDescriptions: Record<StoreMode, string> = {
  full: "Accept orders from your website and record in-person sales. Best for omnichannel businesses.",
  online_only:
    "Customers can only purchase through your website. Offline sales features are hidden.",
  offline_only:
    "For physical stores only - no public website checkout. Perfect for retail shops.",
  catalog:
    "Display products without checkout. Perfect for real estate, portfolios, or businesses that take orders via WhatsApp/phone.",
};

// Receipt paper width options
export const receiptPaperWidthOptions = ["80mm", "58mm"] as const;
export type ReceiptPaperWidth = (typeof receiptPaperWidthOptions)[number];

// Receipt paper width labels for UI
export const receiptPaperWidthLabels: Record<ReceiptPaperWidth, string> = {
  "80mm": "80mm Standard",
  "58mm": "58mm Compact",
};

// Receipt paper width descriptions for UI
export const receiptPaperWidthDescriptions: Record<ReceiptPaperWidth, string> =
  {
    "80mm": "Standard thermal printer paper. Best for detailed receipts.",
    "58mm": "Compact mobile printer paper. Good for quick transactions.",
  };

// Store mode settings validation schema
export const storeModeSettingsSchema = z.object({
  storeMode: z.enum(storeModeOptions),
  onlineCheckoutEnabled: z.boolean(),
  posEnabled: z.boolean(),
  phoneOrdersEnabled: z.boolean(),
  // Receipt settings
  receiptPaperWidth: z.enum(receiptPaperWidthOptions),
  receiptShowLogo: z.boolean(),
  receiptShowContact: z.boolean(),
  receiptFooterText: z.string().max(200).optional(),
});

export type StoreModeSettingsInput = z.infer<typeof storeModeSettingsSchema>;

/**
 * Generate ASCII-only slug from store name
 * Store slugs must be ASCII for clean URLs (kakamalem.com/store/[slug])
 * Returns empty string if name has no ASCII characters - user must provide custom slug
 */
export function generateSlug(name: string): string {
  return slugifyAscii(name);
}
