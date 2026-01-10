import { z } from "zod";

// ============================================================================
// INLINE OPTION TYPES
// ============================================================================
// These types represent options and values in the variant builder form,
// before they're saved to the database.

/**
 * Represents an option value in the inline builder.
 * Can be existing (from global options) or new (being created inline).
 */
export const inlineOptionValueSchema = z.object({
  /** Database ID if existing, undefined if new */
  id: z.string().uuid().optional(),
  /** The display value (e.g., "Red", "S", "Cotton") */
  value: z
    .string()
    .min(1, "Value is required")
    .max(100, "Value must be less than 100 characters"),
  /** True if this value is being created inline (not from global options) */
  isNew: z.boolean().default(false),
});

export type InlineOptionValue = z.infer<typeof inlineOptionValueSchema>;

/**
 * Represents an option type in the inline builder.
 * Can be existing (from global options) or new (being created inline).
 */
export const inlineOptionSchema = z.object({
  /** Database ID if existing, undefined if new */
  id: z.string().uuid().optional(),
  /** Temporary client-side ID for React keys when creating new options */
  tempId: z.string().optional(),
  /** The option name (e.g., "Size", "Color", "Material") */
  name: z
    .string()
    .min(1, "Option name is required")
    .min(2, "Option name must be at least 2 characters")
    .max(100, "Option name must be less than 100 characters"),
  /** The values for this option */
  values: z
    .array(inlineOptionValueSchema)
    .min(1, "At least one value is required"),
  /** True if this option is being created inline (not from global options) */
  isNew: z.boolean().default(false),
});

export type InlineOption = z.infer<typeof inlineOptionSchema>;

// ============================================================================
// GENERATED VARIANT TYPES
// ============================================================================
// These types represent variants generated from the Cartesian product,
// with editable fields for price, stock, etc.

/**
 * Reference to an option value in a generated variant
 */
export const variantOptionValueRefSchema = z.object({
  optionId: z.string(), // Can be UUID or tempId
  optionName: z.string(),
  valueId: z.string(), // Can be UUID or temp value reference
  value: z.string(),
});

export type VariantOptionValueRef = z.infer<typeof variantOptionValueRefSchema>;

/**
 * A generated variant with all editable fields.
 * This represents a row in the variant matrix table.
 */
export const generatedVariantSchema = z.object({
  /** Unique client-side ID for React keys */
  tempId: z.string(),
  /** Database ID if this is an existing variant being edited */
  existingId: z.string().uuid().optional(),
  /** The option values that define this variant */
  optionValues: z.array(variantOptionValueRefSchema),
  /** Human-readable name (e.g., "Red / S") */
  displayName: z.string(),
  /** SKU - auto-generated but editable */
  sku: z.string().max(100, "SKU must be less than 100 characters").default(""),
  /** Price override - empty string means use base price */
  price: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Price must be a valid positive number"
    )
    .default(""),
  /** Stock quantity */
  stock: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Stock must be a valid positive number"
    )
    .default("0"),
  /** Weight override - empty string means use base weight */
  weight: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Weight must be a valid positive number"
    )
    .default(""),
  /** Length override - empty string means use base length */
  length: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Length must be a valid positive number"
    )
    .default(""),
  /** Width override - empty string means use base width */
  width: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Width must be a valid positive number"
    )
    .default(""),
  /** Height override - empty string means use base height */
  height: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Height must be a valid positive number"
    )
    .default(""),
  /** Variant-specific description */
  description: z.string().default(""),
  /** Primary image ID for this variant */
  imageId: z.string().uuid().optional().or(z.literal("")),
  /** Multiple image IDs for this variant (for gallery) */
  imageIds: z.array(z.string().uuid()).default([]),
  /** Whether this variant is active/purchasable */
  isActive: z.boolean().default(true),
  /** Whether this variant should be excluded from creation */
  isExcluded: z.boolean().default(false),
});

export type GeneratedVariant = z.infer<typeof generatedVariantSchema>;

// ============================================================================
// PRODUCT WITH VARIANTS SCHEMA
// ============================================================================
// Combined schema for creating/updating a product with its variants

/**
 * Complete product form data including variant information.
 * Used for the unified product creation/editing form.
 */
export const productWithVariantsFormSchema = z
  .object({
    // Basic product info
    name: z
      .string()
      .min(1, "Product name is required")
      .min(2, "Product name must be at least 2 characters")
      .max(255, "Product name must be less than 255 characters"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .min(2, "Slug must be at least 2 characters")
      .max(255, "Slug must be less than 255 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase letters, numbers, and hyphens only"
      ),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),

    // Base price (for simple products, or "from" price for variants)
    price: z
      .string()
      .min(1, "Price is required")
      .refine(
        (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
        "Price must be a valid positive number"
      ),

    // Images (media IDs)
    imageIds: z.array(z.string().uuid()).default([]),

    // Inventory (for simple products without variants)
    trackInventory: z.boolean().default(true),
    stock: z
      .string()
      .refine(
        (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
        "Stock must be a valid positive number"
      )
      .default("0"),
    allowBackorder: z.boolean().default(false),
    lowStockThreshold: z.number().int().min(0).default(5),

    // Shipping
    weight: z
      .string()
      .refine(
        (val) =>
          val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
        "Weight must be a valid positive number"
      )
      .default(""),

    // Display
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),

    // Variant configuration
    hasVariants: z.boolean().default(false),
    options: z.array(inlineOptionSchema).default([]),
    variants: z.array(generatedVariantSchema).default([]),
  })
  .refine(
    (data) => {
      // If hasVariants is true, must have at least one option with at least one value
      if (data.hasVariants) {
        return (
          data.options.length > 0 &&
          data.options.every((opt) => opt.values.length > 0)
        );
      }
      return true;
    },
    {
      message:
        "Products with variants must have at least one option with values",
      path: ["options"],
    }
  )
  .refine(
    (data) => {
      // If hasVariants is true, must have at least one non-excluded variant
      if (data.hasVariants) {
        return data.variants.some((v) => !v.isExcluded);
      }
      return true;
    },
    {
      message: "Products with variants must have at least one active variant",
      path: ["variants"],
    }
  );

export type ProductWithVariantsFormData = z.infer<
  typeof productWithVariantsFormSchema
>;

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Form errors type for the product with variants form
 */
export type ProductWithVariantsFormErrors = Partial<
  Record<keyof ProductWithVariantsFormData, string>
> & {
  /** General form error */
  form?: string;
  /** Errors for specific options by index */
  optionErrors?: Record<number, string>;
  /** Errors for specific variants by tempId */
  variantErrors?: Record<
    string,
    Partial<Record<keyof GeneratedVariant, string>>
  >;
};

/**
 * Server action response for product with variants operations
 */
export type ProductWithVariantsResult = {
  success: boolean;
  productId?: string;
  error?: string;
  fieldErrors?: ProductWithVariantsFormErrors;
};

// ============================================================================
// BULK OPERATIONS TYPES
// ============================================================================

/**
 * Schema for bulk editing variant prices
 */
export const bulkPriceUpdateSchema = z.object({
  price: z
    .string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      "Price must be a valid positive number"
    ),
  variantTempIds: z.array(z.string()).optional(), // If empty, apply to all
});

export type BulkPriceUpdate = z.infer<typeof bulkPriceUpdateSchema>;

/**
 * Schema for bulk editing variant stock
 */
export const bulkStockUpdateSchema = z.object({
  stock: z
    .string()
    .refine(
      (val) => !isNaN(parseInt(val)) && parseInt(val) >= 0,
      "Stock must be a valid positive number"
    ),
  variantTempIds: z.array(z.string()).optional(), // If empty, apply to all
});

export type BulkStockUpdate = z.infer<typeof bulkStockUpdateSchema>;

/**
 * Schema for bulk toggling variant active status
 */
export const bulkActiveToggleSchema = z.object({
  isActive: z.boolean(),
  variantTempIds: z.array(z.string()).optional(), // If empty, apply to all
});

export type BulkActiveToggle = z.infer<typeof bulkActiveToggleSchema>;

// ============================================================================
// DATA TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Transform database variant option types to InlineOption format.
 * Used when loading existing product for editing.
 */
export function transformDbOptionsToInlineOptions(
  dbOptions: {
    id: string;
    name: string;
    displayOrder: number;
    values: { id: string; value: string; displayOrder: number }[];
  }[]
): InlineOption[] {
  return dbOptions.map((opt) => ({
    id: opt.id,
    name: opt.name,
    values: opt.values.map((val) => ({
      id: val.id,
      value: val.value,
      isNew: false,
    })),
    isNew: false,
  }));
}

/**
 * Transform database product variants to GeneratedVariant format.
 * Used when loading existing product for editing.
 */
export function transformDbVariantsToGeneratedVariants(
  dbVariants: {
    id: string;
    sku: string | null;
    displayName: string | null;
    price: string | null;
    stock: number;
    weight: string | null;
    length: string | null;
    width: string | null;
    height: string | null;
    description: string | null;
    imageId: string | null;
    isActive: boolean;
    options: {
      optionValue: {
        id: string;
        value: string;
        option: {
          id: string;
          name: string;
        };
      };
    }[];
    images?: {
      mediaId: string;
      media?: {
        id: string;
        url: string;
      };
    }[];
  }[]
): GeneratedVariant[] {
  return dbVariants.map((variant, index) => ({
    tempId: `existing-${variant.id}-${index}`,
    existingId: variant.id,
    optionValues: variant.options.map((opt) => ({
      optionId: opt.optionValue.option.id,
      optionName: opt.optionValue.option.name,
      valueId: opt.optionValue.id,
      value: opt.optionValue.value,
    })),
    displayName:
      variant.displayName ||
      variant.options.map((o) => o.optionValue.value).join(" / "),
    sku: variant.sku || "",
    price: variant.price || "",
    stock: String(variant.stock),
    weight: variant.weight || "",
    length: variant.length || "",
    width: variant.width || "",
    height: variant.height || "",
    description: variant.description || "",
    imageId: variant.imageId || "",
    imageIds: variant.images?.map((img) => img.mediaId) || [],
    isActive: variant.isActive,
    isExcluded: false,
  }));
}
