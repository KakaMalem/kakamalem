import { z } from "zod";
import { slugify } from "@/lib/utils/slug";

// Product validation schema
export const productSchema = z.object({
  // Basic info
  name: z
    .string()
    .min(1, "Product name is required")
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name must be less than 255 characters"),
  // Note: slug is auto-generated on the backend from the name field
  // It's kept optional here for backward compatibility but will be ignored
  slug: z.string().optional(),
  description: z.string().optional().or(z.literal("")),

  // Pricing
  price: z
    .string()
    .min(1, "Price is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      "Price must be a valid positive number"
    ),
  compareAtPrice: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Compare-at price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  costPrice: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Cost price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  minOrderQuantity: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 1),
      "Minimum order quantity must be at least 1"
    )
    .optional()
    .or(z.literal("")),
  maxOrderQuantity: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 1),
      "Maximum order quantity must be at least 1"
    )
    .optional()
    .or(z.literal("")),

  // Categories (for backward compatibility, keep categoryId but also add categoryIds)
  categoryId: z.string().uuid().optional().or(z.literal("")),
  categoryIds: z.array(z.string().uuid()).default([]),

  // Barcode for POS scanning (SKU is auto-generated on backend from product name)
  barcode: z
    .string()
    .max(50, "Barcode must be less than 50 characters")
    .optional()
    .or(z.literal("")),

  // Inventory
  trackInventory: z.boolean().default(true),
  stock: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Stock must be a valid positive number"
    )
    .default("0"),
  allowBackorder: z.boolean().default(false),
  lowStockThreshold: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Low stock threshold must be a valid positive number"
    )
    .default("0"),
  showStock: z.boolean().default(false),

  // Shipping
  weight: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Weight must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),

  // Dimensions (in cm)
  length: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Length must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  width: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Width must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  height: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Height must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),

  // Status
  status: z.enum(["draft", "active", "archived"]).default("draft"),

  // Channel visibility
  showOnStorefront: z.boolean().default(true),
  showOnPos: z.boolean().default(true),

  // Display
  displayOrder: z
    .string()
    .refine(
      (val) => val === "" || !isNaN(parseInt(val)),
      "Display order must be a valid number"
    )
    .default("0"),

  // Images (array of media IDs)
  imageIds: z.array(z.string().uuid()).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

// Helper function to generate slug from name (supports Unicode)
export function generateProductSlug(name: string): string {
  return slugify(name);
}

// Bulk action schemas
export const bulkActivateSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, "Select at least one product"),
});

export const bulkDeactivateSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, "Select at least one product"),
});

export const bulkDeleteSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, "Select at least one product"),
});

export type BulkActionInput = z.infer<typeof bulkActivateSchema>;
