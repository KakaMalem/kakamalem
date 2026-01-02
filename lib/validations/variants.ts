import { z } from "zod";

// Variant option validation (Size, Color, etc.)
export const variantOptionSchema = z.object({
  name: z
    .string()
    .min(1, "Option name is required")
    .min(2, "Option name must be at least 2 characters")
    .max(100, "Option name must be less than 100 characters"),
  displayOrder: z.number().int().min(0).default(0),
});

export type VariantOptionInput = z.infer<typeof variantOptionSchema>;

// Variant option value validation (S, M, L, XL, etc.)
export const variantOptionValueSchema = z.object({
  value: z
    .string()
    .min(1, "Value is required")
    .max(100, "Value must be less than 100 characters"),
  displayOrder: z.number().int().min(0).default(0),
});

export type VariantOptionValueInput = z.infer<typeof variantOptionValueSchema>;

// Product variant validation
export const productVariantSchema = z.object({
  sku: z
    .string()
    .max(100, "SKU must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  price: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  weight: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Weight must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  stock: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Stock must be a valid positive number"
    )
    .default("0"),
  imageId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  // Option values: Map of optionId -> optionValueId
  optionValues: z.record(z.string().uuid(), z.string().uuid()),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

// Bulk variant creation schema
export const bulkVariantSchema = z.object({
  variants: z.array(productVariantSchema).min(1, "At least one variant is required"),
});

export type BulkVariantInput = z.infer<typeof bulkVariantSchema>;

// Schema for creating option with values at once
export const variantOptionWithValuesSchema = z.object({
  name: z
    .string()
    .min(1, "Option name is required")
    .min(2, "Option name must be at least 2 characters")
    .max(100, "Option name must be less than 100 characters"),
  displayOrder: z.number().int().min(0).default(0),
  values: z
    .array(
      z.object({
        value: z
          .string()
          .min(1, "Value is required")
          .max(100, "Value must be less than 100 characters"),
        displayOrder: z.number().int().min(0).default(0),
      })
    )
    .min(1, "At least one value is required"),
});

export type VariantOptionWithValuesInput = z.infer<typeof variantOptionWithValuesSchema>;
