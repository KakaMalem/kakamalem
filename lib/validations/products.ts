import { z } from "zod";

// Slug validation pattern: lowercase letters, numbers, and hyphens only

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

  // Categories (for backward compatibility, keep categoryId but also add categoryIds)
  categoryId: z.string().uuid().optional().or(z.literal("")),
  categoryIds: z.array(z.string().uuid()).default([]),

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
  isActive: z.boolean().default(true),

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

// Helper function to generate slug from name
export function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
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
