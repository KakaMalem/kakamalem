import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import { MAX_AFN_EXCHANGE_RATE } from "@/lib/payments/currency";

// Slug validation pattern: Unicode letters (lowercase + caseless scripts), numbers, and hyphens
// \p{Ll} = lowercase letters (Latin, etc.)
// \p{Lo} = letters without case (Persian, Arabic, CJK, etc.)
// \p{N} = numbers (any script)
const slugRegex = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u;

// URL validation regex (allows @ for TikTok/YouTube style URLs)
const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .@-]*)*\/?$/i;

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

// What the storefront homepage leads with
export const homepageLayoutOptions = ["products", "categories"] as const;

export type HomepageLayout = (typeof homepageLayoutOptions)[number];

export const homepageLayoutLabels: Record<HomepageLayout, string> = {
  products: "Products first",
  categories: "Categories first",
};

export const homepageLayoutDescriptions: Record<HomepageLayout, string> = {
  products: "Shoppers land straight on your product grid.",
  categories: "Shoppers see your collections first, products below.",
};

// Currency options (all supported currencies for store pricing)
export const currencyOptions = [
  "AFN",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SAR",
  "PKR",
  "INR",
  "TRY",
  "CAD",
  "AUD",
] as const;

// Create store validation schema (for wizard)
export const createStoreSchema = z.object({
  // Step 0: Store Type
  storeMode: z
    .enum(["full", "online_only", "offline_only", "catalog"] as const)
    .default("full"),

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
      "Store URL can only contain lowercase letters (including Persian), numbers, and hyphens"
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

  // Step 4: Location (optional)
  storeLocationLat: z.number().min(-90).max(90).optional().nullable(),
  storeLocationLng: z.number().min(-180).max(180).optional().nullable(),
  storeLocationCity: z.string().max(100).optional().or(z.literal("")),
  storeLocationAccuracy: z.number().int().positive().optional().nullable(),
  storeLocationSource: z.enum(["gps", "manual"]).optional().nullable(),
  storeLocationPlusCode: z.string().max(20).optional().or(z.literal("")),
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
  // HesabPay charges customers in AFN only. Stores priced in another currency
  // need a rate ("1 unit of the store currency = X AFN") before card payment
  // can be offered. Empty means "HesabPay unavailable", which is allowed.
  afnExchangeRate: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (!value) return true;
        const parsed = Number(value);
        return (
          Number.isFinite(parsed) &&
          parsed > 0 &&
          parsed <= MAX_AFN_EXCHANGE_RATE
        );
      },
      { message: "Enter a rate greater than 0" }
    )
    .optional()
    .or(z.literal("")),
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
  homepageLayout: z.enum(homepageLayoutOptions).default("products"),
});

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>;

// Preferred contact method options
export const preferredContactMethodOptions = [
  "phone",
  "whatsapp",
  "both",
] as const;
export type PreferredContactMethod =
  (typeof preferredContactMethodOptions)[number];

// Preferred contact method labels for UI
export const preferredContactMethodLabels: Record<
  PreferredContactMethod,
  string
> = {
  phone: "Phone Call",
  whatsapp: "WhatsApp",
  both: "Show Both",
};

// Preferred contact method descriptions for UI
export const preferredContactMethodDescriptions: Record<
  PreferredContactMethod,
  string
> = {
  phone: "Phone number links open the phone dialer",
  whatsapp: "Phone number links open WhatsApp chat",
  both: "Show both phone and WhatsApp icons",
};

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
  // WhatsApp settings
  preferredContactMethod: z
    .enum(preferredContactMethodOptions)
    .default("whatsapp"),
  showWhatsAppButton: z.boolean().default(true),
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
    .regex(imageUrlRegex, "Please enter a valid image URL")
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

// POS Scanner mode options
export const posScannerModeOptions = ["camera", "usb"] as const;
export type PosScannerMode = (typeof posScannerModeOptions)[number];

// POS Scanner mode labels for UI
export const posScannerModeLabels: Record<PosScannerMode, string> = {
  camera: "Camera Scanner",
  usb: "USB/Bluetooth Scanner",
};

// POS Scanner mode descriptions for UI
export const posScannerModeDescriptions: Record<PosScannerMode, string> = {
  camera:
    "Use your phone or tablet camera to scan barcodes. Best for mobile devices.",
  usb: "Use an external USB or Bluetooth barcode scanner. Best for dedicated POS setups.",
};

// Receipt print mode options
export const receiptPrintModeOptions = [
  "disabled",
  "prompt",
  "silent",
] as const;
export type ReceiptPrintMode = (typeof receiptPrintModeOptions)[number];

// Receipt print mode labels for UI
export const receiptPrintModeLabels: Record<ReceiptPrintMode, string> = {
  disabled: "No Auto-Print",
  prompt: "Print Dialog",
  silent: "Direct Print (Thermal)",
};

// Receipt print mode descriptions for UI
export const receiptPrintModeDescriptions: Record<ReceiptPrintMode, string> = {
  disabled: "Show success toast only, no printing after checkout.",
  prompt: "Open browser print dialog automatically after each sale.",
  silent:
    "Print directly to connected thermal printer without dialog (Chrome/Edge only).",
};

// Store mode settings validation schema
export const storeModeSettingsSchema = z.object({
  storeMode: z.enum(storeModeOptions),
  onlineCheckoutEnabled: z.boolean(),
  posEnabled: z.boolean(),
  // POS settings
  posScannerMode: z.enum(posScannerModeOptions),
  // Receipt settings
  receiptPaperWidth: z.enum(receiptPaperWidthOptions),
  receiptShowLogo: z.boolean(),
  receiptShowContact: z.boolean(),
  receiptFooterText: z.string().max(200).optional(),
  receiptPrintMode: z.enum(receiptPrintModeOptions),
});

export type StoreModeSettingsInput = z.infer<typeof storeModeSettingsSchema>;

// Store location validation schema (for multi-location feature)
export const storeLocationSchema = z
  .object({
    name: z
      .string()
      .min(1, "Location name is required")
      .max(100, "Location name must be less than 100 characters"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    city: z.string().max(100).optional().or(z.literal("")),
    plusCode: z.string().max(20).optional().or(z.literal("")),
    accuracy: z.number().int().positive().optional().nullable(),
    source: z.enum(["gps", "manual"]).optional().nullable(),
    phone: optionalPhoneSchema,
    email: z
      .string()
      .regex(emailRegex, "Please enter a valid email address")
      .optional()
      .or(z.literal("")),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
  })
  .refine((data) => data.latitude !== 0 || data.longitude !== 0, {
    message: "Please select a location on the map",
    path: ["latitude"],
  });

export type StoreLocationInput = z.infer<typeof storeLocationSchema>;

/**
 * Generate slug from store name (supports Unicode including Persian)
 * Modern browsers display Unicode URLs nicely in the address bar
 */
export function generateSlug(name: string): string {
  return slugify(name);
}
