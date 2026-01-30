"use server";

import { db } from "@/lib/db";
import {
  variantOptions,
  variantOptionValues,
  productVariants,
  productVariantOptions,
  productVariantImages,
  optionValueImages,
  products,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  variantOptionSchema,
  variantOptionValueSchema,
  variantOptionWithValuesSchema,
  productVariantSchema,
  type VariantOptionInput,
  type VariantOptionValueInput,
  type VariantOptionWithValuesInput,
  type ProductVariantInput,
} from "@/lib/validations/variants";
import {
  checkVariantOptionNameAvailable,
  checkVariantSkuAvailable,
} from "@/lib/db/queries/variants";
import { generateSku } from "@/lib/utils/slug";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Helper function to recalculate and sync product stock from its active variants.
 * This ensures the product.stock field always matches the sum of active variant stocks.
 * Should be called after any operation that modifies variant stocks or active status.
 */
export async function syncProductStockFromVariants(
  tenantId: string,
  productId: string
): Promise<void> {
  // Get all active variants for this product
  const activeVariants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.productId, productId),
      eq(productVariants.isActive, true)
    ),
    columns: {
      stock: true,
    },
  });

  // Calculate total stock
  const totalStock = activeVariants.reduce(
    (sum, variant) => sum + variant.stock,
    0
  );

  // Update product stock
  await db
    .update(products)
    .set({
      stock: totalStock,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
}

// ============================================================================
// VARIANT OPTIONS (Size, Color, etc.)
// ============================================================================

export async function createVariantOption(
  tenantId: string,
  input: VariantOptionInput
): Promise<ActionResult<{ id: string }>> {
  const result = variantOptionSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Check name is unique
  const isAvailable = await checkVariantOptionNameAvailable(
    tenantId,
    input.name
  );
  if (!isAvailable) {
    return {
      success: false,
      error: {
        message: "An option with this name already exists",
        field: "name",
      },
    };
  }

  const [option] = await db
    .insert(variantOptions)
    .values({
      tenantId,
      name: input.name,
      displayOrder: input.displayOrder,
    })
    .returning({ id: variantOptions.id });

  return { success: true, data: { id: option.id } };
}

export async function createVariantOptionWithValues(
  tenantId: string,
  input: VariantOptionWithValuesInput
): Promise<ActionResult<{ id: string }>> {
  const result = variantOptionWithValuesSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Check name is unique
  const isAvailable = await checkVariantOptionNameAvailable(
    tenantId,
    input.name
  );
  if (!isAvailable) {
    return {
      success: false,
      error: {
        message: "An option with this name already exists",
        field: "name",
      },
    };
  }

  // Create option and values in a transaction
  const [option] = await db
    .insert(variantOptions)
    .values({
      tenantId,
      name: input.name,
      displayOrder: input.displayOrder,
    })
    .returning({ id: variantOptions.id });

  // Insert values
  if (input.values.length > 0) {
    await db.insert(variantOptionValues).values(
      input.values.map((v, index) => ({
        tenantId,
        optionId: option.id,
        value: v.value,
        displayOrder: v.displayOrder ?? index,
      }))
    );
  }

  return { success: true, data: { id: option.id } };
}

export async function updateVariantOption(
  tenantId: string,
  optionId: string,
  input: VariantOptionInput
): Promise<ActionResult> {
  const result = variantOptionSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Check name is unique (excluding current option)
  const isAvailable = await checkVariantOptionNameAvailable(
    tenantId,
    input.name,
    optionId
  );
  if (!isAvailable) {
    return {
      success: false,
      error: {
        message: "An option with this name already exists",
        field: "name",
      },
    };
  }

  await db
    .update(variantOptions)
    .set({
      name: input.name,
      displayOrder: input.displayOrder,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(variantOptions.tenantId, tenantId),
        eq(variantOptions.id, optionId)
      )
    );

  return { success: true };
}

export async function deleteVariantOption(
  tenantId: string,
  optionId: string
): Promise<ActionResult> {
  // This will cascade delete all option values and any product variant options
  await db
    .delete(variantOptions)
    .where(
      and(
        eq(variantOptions.tenantId, tenantId),
        eq(variantOptions.id, optionId)
      )
    );

  return { success: true };
}

// ============================================================================
// VARIANT OPTION VALUES (S, M, L, etc.)
// ============================================================================

export async function addVariantOptionValue(
  tenantId: string,
  optionId: string,
  input: VariantOptionValueInput
): Promise<ActionResult<{ id: string }>> {
  const result = variantOptionValueSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Check value is unique within option
  const existing = await db.query.variantOptionValues.findFirst({
    where: and(
      eq(variantOptionValues.tenantId, tenantId),
      eq(variantOptionValues.optionId, optionId),
      eq(variantOptionValues.value, input.value)
    ),
  });

  if (existing) {
    return {
      success: false,
      error: {
        message: "This value already exists for this option",
        field: "value",
      },
    };
  }

  const [value] = await db
    .insert(variantOptionValues)
    .values({
      tenantId,
      optionId,
      value: input.value,
      displayOrder: input.displayOrder,
    })
    .returning({ id: variantOptionValues.id });

  return { success: true, data: { id: value.id } };
}

export async function updateVariantOptionValue(
  tenantId: string,
  valueId: string,
  input: VariantOptionValueInput
): Promise<ActionResult> {
  const result = variantOptionValueSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Get current value to check option
  const current = await db.query.variantOptionValues.findFirst({
    where: and(
      eq(variantOptionValues.tenantId, tenantId),
      eq(variantOptionValues.id, valueId)
    ),
  });

  if (!current) {
    return {
      success: false,
      error: { message: "Value not found" },
    };
  }

  // Check value is unique within option (excluding current)
  const existing = await db.query.variantOptionValues.findFirst({
    where: and(
      eq(variantOptionValues.tenantId, tenantId),
      eq(variantOptionValues.optionId, current.optionId),
      eq(variantOptionValues.value, input.value)
    ),
  });

  if (existing && existing.id !== valueId) {
    return {
      success: false,
      error: {
        message: "This value already exists for this option",
        field: "value",
      },
    };
  }

  await db
    .update(variantOptionValues)
    .set({
      value: input.value,
      displayOrder: input.displayOrder,
    })
    .where(
      and(
        eq(variantOptionValues.tenantId, tenantId),
        eq(variantOptionValues.id, valueId)
      )
    );

  return { success: true };
}

export async function deleteVariantOptionValue(
  tenantId: string,
  valueId: string
): Promise<ActionResult> {
  await db
    .delete(variantOptionValues)
    .where(
      and(
        eq(variantOptionValues.tenantId, tenantId),
        eq(variantOptionValues.id, valueId)
      )
    );

  return { success: true };
}

// ============================================================================
// PRODUCT VARIANTS
// ============================================================================

/**
 * Generate display name from option values (e.g., "Blue / XL")
 */
function generateDisplayName(
  optionValueIds: string[],
  optionValuesMap: Map<string, { value: string; optionName: string }>
): string {
  return optionValueIds
    .map((id) => optionValuesMap.get(id)?.value || "")
    .filter(Boolean)
    .join(" / ");
}

export async function createProductVariant(
  tenantId: string,
  productId: string,
  input: ProductVariantInput
): Promise<ActionResult<{ id: string }>> {
  const result = productVariantSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Check SKU uniqueness if provided
  if (input.sku) {
    const isSkuAvailable = await checkVariantSkuAvailable(
      tenantId,
      productId,
      input.sku
    );
    if (!isSkuAvailable) {
      return {
        success: false,
        error: {
          message: "This SKU is already used by another variant",
          field: "sku",
        },
      };
    }
  }

  // Get option values for display name
  const optionValueIds = Object.values(input.optionValues);
  const optionValuesData =
    optionValueIds.length > 0
      ? await db.query.variantOptionValues.findMany({
          where: inArray(variantOptionValues.id, optionValueIds),
          with: { option: true },
        })
      : [];

  const optionValuesMap = new Map(
    optionValuesData.map((v) => [
      v.id,
      { value: v.value, optionName: v.option.name },
    ])
  );

  const displayName = generateDisplayName(optionValueIds, optionValuesMap);

  // Determine primary image (first image or legacy imageId)
  const primaryImageId =
    input.images.length > 0 ? input.images[0].mediaId : input.imageId || null;

  // Create variant
  const [variant] = await db
    .insert(productVariants)
    .values({
      tenantId,
      productId,
      sku: input.sku || null,
      displayName,
      price: input.price ? input.price : null,
      weight: input.weight ? input.weight : null,
      stock: parseInt(input.stock) || 0,
      stockStatus: parseInt(input.stock) > 0 ? "in_stock" : "out_of_stock",
      imageId: primaryImageId,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
    })
    .returning({ id: productVariants.id });

  // Create variant option links
  if (optionValueIds.length > 0) {
    await db.insert(productVariantOptions).values(
      optionValueIds.map((optionValueId) => ({
        tenantId,
        variantId: variant.id,
        optionValueId,
      }))
    );
  }

  // Create variant images
  if (input.images.length > 0) {
    await db.insert(productVariantImages).values(
      input.images.map((img, index) => ({
        tenantId,
        variantId: variant.id,
        mediaId: img.mediaId,
        position: img.position ?? index,
      }))
    );
  }

  // Update product to hasVariants = true
  await db
    .update(products)
    .set({ hasVariants: true, updatedAt: new Date().toISOString() })
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));

  return { success: true, data: { id: variant.id } };
}

export async function updateProductVariant(
  tenantId: string,
  variantId: string,
  input: ProductVariantInput
): Promise<ActionResult> {
  const result = productVariantSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Get current variant
  const current = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.id, variantId)
    ),
  });

  if (!current) {
    return {
      success: false,
      error: { message: "Variant not found" },
    };
  }

  // Check SKU uniqueness if changed
  if (input.sku && input.sku !== current.sku) {
    const isSkuAvailable = await checkVariantSkuAvailable(
      tenantId,
      current.productId,
      input.sku,
      variantId
    );
    if (!isSkuAvailable) {
      return {
        success: false,
        error: {
          message: "This SKU is already used by another variant",
          field: "sku",
        },
      };
    }
  }

  // Get option values for display name
  const optionValueIds = Object.values(input.optionValues);
  const optionValuesData =
    optionValueIds.length > 0
      ? await db.query.variantOptionValues.findMany({
          where: inArray(variantOptionValues.id, optionValueIds),
          with: { option: true },
        })
      : [];

  const optionValuesMap = new Map(
    optionValuesData.map((v) => [
      v.id,
      { value: v.value, optionName: v.option.name },
    ])
  );

  const displayName = generateDisplayName(optionValueIds, optionValuesMap);

  const stockNum = parseInt(input.stock) || 0;

  // Determine primary image (first image or legacy imageId)
  const primaryImageId =
    input.images.length > 0 ? input.images[0].mediaId : input.imageId || null;

  // Update variant
  await db
    .update(productVariants)
    .set({
      sku: input.sku || null,
      displayName,
      price: input.price ? input.price : null,
      weight: input.weight ? input.weight : null,
      stock: stockNum,
      stockStatus: stockNum > 0 ? "in_stock" : "out_of_stock",
      imageId: primaryImageId,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.id, variantId)
      )
    );

  // Update variant options - delete old and insert new
  await db
    .delete(productVariantOptions)
    .where(eq(productVariantOptions.variantId, variantId));

  if (optionValueIds.length > 0) {
    await db.insert(productVariantOptions).values(
      optionValueIds.map((optionValueId) => ({
        tenantId,
        variantId,
        optionValueId,
      }))
    );
  }

  // Update variant images - delete old and insert new
  await db
    .delete(productVariantImages)
    .where(eq(productVariantImages.variantId, variantId));

  if (input.images.length > 0) {
    await db.insert(productVariantImages).values(
      input.images.map((img, index) => ({
        tenantId,
        variantId,
        mediaId: img.mediaId,
        position: img.position ?? index,
      }))
    );
  }

  return { success: true };
}

export async function deleteProductVariant(
  tenantId: string,
  variantId: string
): Promise<ActionResult> {
  // Get variant to find product
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.id, variantId)
    ),
  });

  if (!variant) {
    return {
      success: false,
      error: { message: "Variant not found" },
    };
  }

  // Delete variant (cascade deletes variant options)
  await db
    .delete(productVariants)
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.id, variantId)
      )
    );

  // Check if product still has variants
  const remainingVariants = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.productId, variant.productId)
    ),
  });

  // If no more variants, set hasVariants to false
  if (!remainingVariants) {
    await db
      .update(products)
      .set({ hasVariants: false, updatedAt: new Date().toISOString() })
      .where(
        and(eq(products.tenantId, tenantId), eq(products.id, variant.productId))
      );
  }

  return { success: true };
}

export async function bulkDeleteProductVariants(
  tenantId: string,
  variantIds: string[]
): Promise<ActionResult> {
  if (variantIds.length === 0) {
    return { success: true };
  }

  // Get variants to find products
  const variants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.tenantId, tenantId),
      inArray(productVariants.id, variantIds)
    ),
  });

  const productIds = [...new Set(variants.map((v) => v.productId))];

  // Delete variants
  await db
    .delete(productVariants)
    .where(
      and(
        eq(productVariants.tenantId, tenantId),
        inArray(productVariants.id, variantIds)
      )
    );

  // Check which products still have variants
  for (const productId of productIds) {
    const remainingVariants = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.productId, productId)
      ),
    });

    if (!remainingVariants) {
      await db
        .update(products)
        .set({ hasVariants: false, updatedAt: new Date().toISOString() })
        .where(
          and(eq(products.tenantId, tenantId), eq(products.id, productId))
        );
    }
  }

  return { success: true };
}

// ============================================================================
// BULK VARIANT CREATION FOR INLINE VARIANT BUILDER
// ============================================================================

import type {
  InlineOption,
  GeneratedVariant,
} from "@/lib/validations/variant-form";

/**
 * Input for creating variants in bulk from the inline builder
 */
export type BulkVariantCreationInput = {
  options: InlineOption[];
  variants: GeneratedVariant[];
  imageAssignments?: OptionValueImageAssignment[];
};

/**
 * Type for option value to image mapping
 */
export type OptionValueImageAssignment = {
  optionId: string; // ID or tempId of the option
  optionName: string;
  valueId: string; // ID or value string for new values
  value: string;
  imageIds: string[]; // Media IDs assigned to this value
};

/**
 * Create or update all variants for a product in bulk.
 * This handles:
 * - Creating new variant options (if marked as new)
 * - Creating new variant option values (if marked as new)
 * - Creating all product variants with their option links
 */
export async function createProductVariantsInBulk(
  tenantId: string,
  productId: string,
  input: BulkVariantCreationInput
): Promise<ActionResult<{ variantIds: string[] }>> {
  const { options, variants, imageAssignments } = input;

  // Filter out excluded variants
  const activeVariants = variants.filter((v) => !v.isExcluded);

  if (activeVariants.length === 0) {
    return {
      success: false,
      error: { message: "At least one variant is required" },
    };
  }

  // Validate variant count
  if (activeVariants.length > 100) {
    return {
      success: false,
      error: { message: "Maximum 100 variants allowed" },
    };
  }

  try {
    // Get product name for SKU generation
    const product = await db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
      columns: { name: true },
    });

    if (!product) {
      return {
        success: false,
        error: { message: "Product not found" },
      };
    }

    const productName = product.name;
    // Step 1: Create or find variant options and their values
    // Map: tempId/id -> actualId for options
    const optionIdMap = new Map<string, string>();
    // Map: value string (within option) -> actualValueId
    const valueIdMap = new Map<string, string>();

    for (const option of options) {
      let optionId: string;

      if (option.isNew || !option.id) {
        // Create new option
        const existingOption = await db.query.variantOptions.findFirst({
          where: and(
            eq(variantOptions.tenantId, tenantId),
            eq(variantOptions.name, option.name)
          ),
        });

        if (existingOption) {
          optionId = existingOption.id;
          // Update swatch settings if changed
          if (option.swatchSize || option.swatchShape) {
            await db
              .update(variantOptions)
              .set({
                swatchSize: option.swatchSize || "md",
                swatchShape: option.swatchShape || "square",
                updatedAt: new Date().toISOString(),
              })
              .where(eq(variantOptions.id, existingOption.id));
          }
        } else {
          const [newOption] = await db
            .insert(variantOptions)
            .values({
              tenantId,
              name: option.name,
              displayOrder: options.indexOf(option),
              swatchSize: option.swatchSize || "md",
              swatchShape: option.swatchShape || "square",
            })
            .returning({ id: variantOptions.id });
          optionId = newOption.id;
        }
      } else {
        optionId = option.id;
        // Update swatch settings for existing option if specified
        if (option.swatchSize || option.swatchShape) {
          await db
            .update(variantOptions)
            .set({
              swatchSize: option.swatchSize || "md",
              swatchShape: option.swatchShape || "square",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(variantOptions.id, option.id));
        }
      }

      // Store mapping
      const optionKey = option.id || option.tempId || option.name;
      optionIdMap.set(optionKey, optionId);

      // Step 2: Create or find option values
      for (const val of option.values) {
        let valueId: string;

        if (val.isNew || !val.id) {
          // Check if value exists
          const existingValue = await db.query.variantOptionValues.findFirst({
            where: and(
              eq(variantOptionValues.tenantId, tenantId),
              eq(variantOptionValues.optionId, optionId),
              eq(variantOptionValues.value, val.value)
            ),
          });

          if (existingValue) {
            valueId = existingValue.id;
            // Update swatch data if changed
            if (
              val.swatchType !== existingValue.swatchType ||
              val.swatchValue !== existingValue.swatchValue
            ) {
              await db
                .update(variantOptionValues)
                .set({
                  swatchType: val.swatchType || "text",
                  swatchValue: val.swatchValue || null,
                })
                .where(eq(variantOptionValues.id, existingValue.id));
            }
          } else {
            const [newValue] = await db
              .insert(variantOptionValues)
              .values({
                tenantId,
                optionId,
                value: val.value,
                displayOrder: option.values.indexOf(val),
                swatchType: val.swatchType || "text",
                swatchValue: val.swatchValue || null,
              })
              .returning({ id: variantOptionValues.id });
            valueId = newValue.id;
          }
        } else {
          valueId = val.id;
          // Update swatch data for existing values if provided
          if (val.swatchType || val.swatchValue !== undefined) {
            await db
              .update(variantOptionValues)
              .set({
                swatchType: val.swatchType || "text",
                swatchValue: val.swatchValue || null,
              })
              .where(eq(variantOptionValues.id, valueId));
          }
        }

        // Store mapping: use "optionKey:value" as key
        valueIdMap.set(`${optionKey}:${val.value}`, valueId);
      }
    }

    // Step 3: Create product variants
    const createdVariantIds: string[] = [];

    for (let i = 0; i < activeVariants.length; i++) {
      const variant = activeVariants[i];

      // Build optionValues map for this variant (optionId -> valueId)
      const optionValuesForVariant: Record<string, string> = {};

      for (const ov of variant.optionValues) {
        // Find the option key
        const optionKey = ov.optionId;
        const actualOptionId = optionIdMap.get(optionKey);

        if (!actualOptionId) {
          // Try to find by name
          for (const [key, id] of optionIdMap) {
            const option = options.find(
              (o) => o.id === key || o.tempId === key || o.name === key
            );
            if (option?.name === ov.optionName) {
              optionValuesForVariant[id] =
                valueIdMap.get(`${key}:${ov.value}`) || "";
              break;
            }
          }
        } else {
          const valueKey = `${optionKey}:${ov.value}`;
          optionValuesForVariant[actualOptionId] =
            valueIdMap.get(valueKey) || "";
        }
      }

      // Get actual value IDs for display name
      const actualValueIds = Object.values(optionValuesForVariant).filter(
        Boolean
      );

      // Fetch values for display name
      const valuesData =
        actualValueIds.length > 0
          ? await db.query.variantOptionValues.findMany({
              where: inArray(variantOptionValues.id, actualValueIds),
              with: { option: true },
            })
          : [];

      const displayName = valuesData.map((v) => v.value).join(" / ");

      // Auto-generate SKU from product name + variant display name
      const variantDisplayName = displayName || variant.displayName;
      const autoSku = generateSku(`${productName} ${variantDisplayName}`);

      // Check SKU uniqueness and append suffix if needed
      let skuSuffix = 0;
      let finalSku = autoSku;
      while (true) {
        const isSkuAvailable = await checkVariantSkuAvailable(
          tenantId,
          productId,
          finalSku
        );
        if (isSkuAvailable) break;
        skuSuffix++;
        finalSku = `${autoSku}-${skuSuffix}`;
      }

      // Create variant
      const stockNum = parseInt(variant.stock) || 0;

      // Determine primary image: first from imageIds array, fallback to imageId, or inherit from option value assignments
      let primaryImageId: string | null =
        variant.imageIds && variant.imageIds.length > 0
          ? variant.imageIds[0]
          : variant.imageId || null;

      // If still no primary image, try to inherit from option value assignments
      if (!primaryImageId && imageAssignments && imageAssignments.length > 0) {
        for (const ov of variant.optionValues) {
          const optionKey = ov.optionId;
          const assignment = imageAssignments.find(
            (a) =>
              (a.optionId === optionKey || a.optionName === ov.optionName) &&
              a.value === ov.value
          );
          if (assignment && assignment.imageIds.length > 0) {
            primaryImageId = assignment.imageIds[0];
            break;
          }
        }
      }

      const [newVariant] = await db
        .insert(productVariants)
        .values({
          tenantId,
          productId,
          sku: finalSku,
          barcode: variant.barcode || null, // Save barcode from form
          displayName: variantDisplayName,
          price: variant.price || null,
          weight: variant.weight || null,
          length: variant.length || null,
          width: variant.width || null,
          height: variant.height || null,
          description: variant.description || null,
          imageId: primaryImageId,
          stock: stockNum,
          stockStatus: stockNum > 0 ? "in_stock" : "out_of_stock",
          isActive: variant.isActive,
          displayOrder: i,
        })
        .returning({ id: productVariants.id });

      createdVariantIds.push(newVariant.id);

      // Create variant option links
      if (actualValueIds.length > 0) {
        await db.insert(productVariantOptions).values(
          actualValueIds.map((valueId) => ({
            tenantId,
            variantId: newVariant.id,
            optionValueId: valueId,
          }))
        );
      }

      // Create variant images
      // If variant has explicit images, use those. Otherwise, inherit from option value assignments.
      let variantImageIds = variant.imageIds || [];

      // If no explicit images but we have imageAssignments, inherit from option values
      if (
        variantImageIds.length === 0 &&
        imageAssignments &&
        imageAssignments.length > 0
      ) {
        // Find images for this variant's option values
        for (const ov of variant.optionValues) {
          const optionKey = ov.optionId;
          const assignment = imageAssignments.find(
            (a) =>
              (a.optionId === optionKey || a.optionName === ov.optionName) &&
              a.value === ov.value
          );
          if (assignment && assignment.imageIds.length > 0) {
            // Use the first matching option value's images
            variantImageIds = assignment.imageIds;
            break;
          }
        }
      }

      if (variantImageIds.length > 0) {
        await db.insert(productVariantImages).values(
          variantImageIds.map((mediaId, index) => ({
            tenantId,
            variantId: newVariant.id,
            mediaId,
            position: index,
          }))
        );
      }
    }

    // Step 4: Update product hasVariants flag and sync stock
    // Calculate total stock from active variants
    const totalStock = activeVariants.reduce((sum, v) => {
      const stock = parseInt(v.stock) || 0;
      return sum + (v.isActive ? stock : 0);
    }, 0);

    await db
      .update(products)
      .set({
        hasVariants: true,
        stock: totalStock, // Sync stock with variant totals
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));

    // Step 5: Save option value image assignments
    if (imageAssignments && imageAssignments.length > 0) {
      // Delete existing image assignments for this product
      await db
        .delete(optionValueImages)
        .where(
          and(
            eq(optionValueImages.tenantId, tenantId),
            eq(optionValueImages.productId, productId)
          )
        );

      // Create new image assignments
      const imagesToInsert: {
        tenantId: string;
        productId: string;
        optionValueId: string;
        mediaId: string;
        position: number;
      }[] = [];

      for (const assignment of imageAssignments) {
        // Find the actual option value ID using the valueIdMap
        const optionKey = assignment.optionId;
        const valueKey = `${optionKey}:${assignment.value}`;
        const actualValueId = valueIdMap.get(valueKey);

        if (actualValueId && assignment.imageIds.length > 0) {
          for (let i = 0; i < assignment.imageIds.length; i++) {
            imagesToInsert.push({
              tenantId,
              productId,
              optionValueId: actualValueId,
              mediaId: assignment.imageIds[i],
              position: i,
            });
          }
        }
      }

      if (imagesToInsert.length > 0) {
        await db.insert(optionValueImages).values(imagesToInsert);
      }
    }

    return { success: true, data: { variantIds: createdVariantIds } };
  } catch (error) {
    console.error("Error creating variants in bulk:", error);
    return {
      success: false,
      error: { message: "Failed to create variants" },
    };
  }
}

/**
 * Update all variants for a product, handling adds/updates/deletes
 */
export async function updateProductVariantsInBulk(
  tenantId: string,
  productId: string,
  input: BulkVariantCreationInput
): Promise<ActionResult> {
  const { options, variants, imageAssignments } = input;

  // Filter out excluded variants
  const activeVariants = variants.filter((v) => !v.isExcluded);

  try {
    // Get product name for SKU generation
    const product = await db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
      columns: { name: true },
    });

    if (!product) {
      return {
        success: false,
        error: { message: "Product not found" },
      };
    }

    const productName = product.name;

    // Get existing variants
    const existingVariants = await db.query.productVariants.findMany({
      where: and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.productId, productId)
      ),
    });

    const existingIds = new Set(existingVariants.map((v) => v.id));
    const newVariantExistingIds = new Set(
      activeVariants.filter((v) => v.existingId).map((v) => v.existingId!)
    );

    // Delete variants that are no longer in the list
    const toDelete = existingVariants.filter(
      (v) => !newVariantExistingIds.has(v.id)
    );
    if (toDelete.length > 0) {
      await db.delete(productVariants).where(
        and(
          eq(productVariants.tenantId, tenantId),
          inArray(
            productVariants.id,
            toDelete.map((v) => v.id)
          )
        )
      );
    }

    // If no active variants remain after this update
    if (activeVariants.length === 0) {
      await db
        .update(products)
        .set({
          hasVariants: false,
          stock: 0, // Reset stock when no variants
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(products.tenantId, tenantId), eq(products.id, productId))
        );
      return { success: true };
    }

    // Create new options/values as needed (same logic as create)
    const optionIdMap = new Map<string, string>();
    const valueIdMap = new Map<string, string>();

    for (const option of options) {
      let optionId: string;

      if (option.isNew || !option.id) {
        const existingOption = await db.query.variantOptions.findFirst({
          where: and(
            eq(variantOptions.tenantId, tenantId),
            eq(variantOptions.name, option.name)
          ),
        });

        if (existingOption) {
          optionId = existingOption.id;
          // Update swatch settings if changed
          if (option.swatchSize || option.swatchShape) {
            await db
              .update(variantOptions)
              .set({
                swatchSize: option.swatchSize || "md",
                swatchShape: option.swatchShape || "square",
                updatedAt: new Date().toISOString(),
              })
              .where(eq(variantOptions.id, existingOption.id));
          }
        } else {
          const [newOption] = await db
            .insert(variantOptions)
            .values({
              tenantId,
              name: option.name,
              displayOrder: options.indexOf(option),
              swatchSize: option.swatchSize || "md",
              swatchShape: option.swatchShape || "square",
            })
            .returning({ id: variantOptions.id });
          optionId = newOption.id;
        }
      } else {
        optionId = option.id;
        // Update swatch settings for existing option if specified
        if (option.swatchSize || option.swatchShape) {
          await db
            .update(variantOptions)
            .set({
              swatchSize: option.swatchSize || "md",
              swatchShape: option.swatchShape || "square",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(variantOptions.id, option.id));
        }
      }

      const optionKey = option.id || option.tempId || option.name;
      optionIdMap.set(optionKey, optionId);

      for (const val of option.values) {
        let valueId: string;

        if (val.isNew || !val.id) {
          const existingValue = await db.query.variantOptionValues.findFirst({
            where: and(
              eq(variantOptionValues.tenantId, tenantId),
              eq(variantOptionValues.optionId, optionId),
              eq(variantOptionValues.value, val.value)
            ),
          });

          if (existingValue) {
            valueId = existingValue.id;
            // Update swatch data if changed
            if (
              val.swatchType !== existingValue.swatchType ||
              val.swatchValue !== existingValue.swatchValue
            ) {
              await db
                .update(variantOptionValues)
                .set({
                  swatchType: val.swatchType || "text",
                  swatchValue: val.swatchValue || null,
                })
                .where(eq(variantOptionValues.id, existingValue.id));
            }
          } else {
            const [newValue] = await db
              .insert(variantOptionValues)
              .values({
                tenantId,
                optionId,
                value: val.value,
                displayOrder: option.values.indexOf(val),
                swatchType: val.swatchType || "text",
                swatchValue: val.swatchValue || null,
              })
              .returning({ id: variantOptionValues.id });
            valueId = newValue.id;
          }
        } else {
          valueId = val.id;
          // Update swatch data for existing values if provided
          if (val.swatchType || val.swatchValue !== undefined) {
            await db
              .update(variantOptionValues)
              .set({
                swatchType: val.swatchType || "text",
                swatchValue: val.swatchValue || null,
              })
              .where(eq(variantOptionValues.id, valueId));
          }
        }

        valueIdMap.set(`${optionKey}:${val.value}`, valueId);
      }
    }

    // Update or create variants
    for (let i = 0; i < activeVariants.length; i++) {
      const variant = activeVariants[i];

      // Build optionValues
      const optionValuesForVariant: Record<string, string> = {};
      for (const ov of variant.optionValues) {
        const optionKey = ov.optionId;
        const actualOptionId = optionIdMap.get(optionKey);

        if (!actualOptionId) {
          for (const [key, id] of optionIdMap) {
            const option = options.find(
              (o) => o.id === key || o.tempId === key || o.name === key
            );
            if (option?.name === ov.optionName) {
              optionValuesForVariant[id] =
                valueIdMap.get(`${key}:${ov.value}`) || "";
              break;
            }
          }
        } else {
          optionValuesForVariant[actualOptionId] =
            valueIdMap.get(`${optionKey}:${ov.value}`) || "";
        }
      }

      const actualValueIds = Object.values(optionValuesForVariant).filter(
        Boolean
      );
      const valuesData =
        actualValueIds.length > 0
          ? await db.query.variantOptionValues.findMany({
              where: inArray(variantOptionValues.id, actualValueIds),
            })
          : [];
      const displayName = valuesData.map((v) => v.value).join(" / ");
      const variantDisplayName = displayName || variant.displayName;

      const stockNum = parseInt(variant.stock) || 0;

      // Determine primary image: first from imageIds array, fallback to imageId, or inherit from option value assignments
      let primaryImageId: string | null =
        variant.imageIds && variant.imageIds.length > 0
          ? variant.imageIds[0]
          : variant.imageId || null;

      // Compute variant images with inheritance
      let variantImageIds = variant.imageIds || [];

      // If no explicit images, try to inherit from option value assignments
      if (!primaryImageId && imageAssignments && imageAssignments.length > 0) {
        for (const ov of variant.optionValues) {
          const optionKey = ov.optionId;
          const assignment = imageAssignments.find(
            (a) =>
              (a.optionId === optionKey || a.optionName === ov.optionName) &&
              a.value === ov.value
          );
          if (assignment && assignment.imageIds.length > 0) {
            primaryImageId = assignment.imageIds[0];
            variantImageIds = assignment.imageIds;
            break;
          }
        }
      }

      if (variant.existingId && existingIds.has(variant.existingId)) {
        // For existing variants, we don't regenerate SKU (they already have one)
        // Just update barcode and other fields
        await db
          .update(productVariants)
          .set({
            barcode: variant.barcode || null, // Update barcode from form
            displayName: variantDisplayName,
            price: variant.price || null,
            weight: variant.weight || null,
            length: variant.length || null,
            width: variant.width || null,
            height: variant.height || null,
            description: variant.description || null,
            imageId: primaryImageId,
            stock: stockNum,
            stockStatus: stockNum > 0 ? "in_stock" : "out_of_stock",
            isActive: variant.isActive,
            displayOrder: i,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(productVariants.tenantId, tenantId),
              eq(productVariants.id, variant.existingId)
            )
          );

        // Update option links
        await db
          .delete(productVariantOptions)
          .where(eq(productVariantOptions.variantId, variant.existingId));

        if (actualValueIds.length > 0) {
          await db.insert(productVariantOptions).values(
            actualValueIds.map((valueId) => ({
              tenantId,
              variantId: variant.existingId!,
              optionValueId: valueId,
            }))
          );
        }

        // Update variant images - delete old and insert new (using inherited images if applicable)
        await db
          .delete(productVariantImages)
          .where(eq(productVariantImages.variantId, variant.existingId));

        if (variantImageIds.length > 0) {
          await db.insert(productVariantImages).values(
            variantImageIds.map((mediaId, index) => ({
              tenantId,
              variantId: variant.existingId!,
              mediaId,
              position: index,
            }))
          );
        }
      } else {
        // Auto-generate SKU for new variants
        const autoSku = generateSku(`${productName} ${variantDisplayName}`);

        // Check SKU uniqueness and append suffix if needed
        let skuSuffix = 0;
        let finalSku = autoSku;
        while (true) {
          const isSkuAvailable = await checkVariantSkuAvailable(
            tenantId,
            productId,
            finalSku
          );
          if (isSkuAvailable) break;
          skuSuffix++;
          finalSku = `${autoSku}-${skuSuffix}`;
        }

        // Create new variant
        const [newVariant] = await db
          .insert(productVariants)
          .values({
            tenantId,
            productId,
            sku: finalSku,
            barcode: variant.barcode || null, // Save barcode from form
            displayName: variantDisplayName,
            price: variant.price || null,
            weight: variant.weight || null,
            length: variant.length || null,
            width: variant.width || null,
            height: variant.height || null,
            description: variant.description || null,
            imageId: primaryImageId,
            stock: stockNum,
            stockStatus: stockNum > 0 ? "in_stock" : "out_of_stock",
            isActive: variant.isActive,
            displayOrder: i,
          })
          .returning({ id: productVariants.id });

        if (actualValueIds.length > 0) {
          await db.insert(productVariantOptions).values(
            actualValueIds.map((valueId) => ({
              tenantId,
              variantId: newVariant.id,
              optionValueId: valueId,
            }))
          );
        }

        // Create variant images for new variant (using inherited images if applicable)
        if (variantImageIds.length > 0) {
          await db.insert(productVariantImages).values(
            variantImageIds.map((mediaId, index) => ({
              tenantId,
              variantId: newVariant.id,
              mediaId,
              position: index,
            }))
          );
        }
      }
    }

    // Calculate total stock from active variants and update product
    const totalStock = activeVariants.reduce((sum, v) => {
      const stock = parseInt(v.stock) || 0;
      return sum + (v.isActive ? stock : 0);
    }, 0);

    await db
      .update(products)
      .set({
        hasVariants: true,
        stock: totalStock, // Sync stock with variant totals
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));

    // Save option value image assignments
    if (imageAssignments && imageAssignments.length > 0) {
      // Delete existing image assignments for this product
      await db
        .delete(optionValueImages)
        .where(
          and(
            eq(optionValueImages.tenantId, tenantId),
            eq(optionValueImages.productId, productId)
          )
        );

      // Create new image assignments
      const imagesToInsert: {
        tenantId: string;
        productId: string;
        optionValueId: string;
        mediaId: string;
        position: number;
      }[] = [];

      for (const assignment of imageAssignments) {
        // Find the actual option value ID using the valueIdMap
        const optionKey = assignment.optionId;
        const valueKey = `${optionKey}:${assignment.value}`;
        const actualValueId = valueIdMap.get(valueKey);

        if (actualValueId && assignment.imageIds.length > 0) {
          for (let i = 0; i < assignment.imageIds.length; i++) {
            imagesToInsert.push({
              tenantId,
              productId,
              optionValueId: actualValueId,
              mediaId: assignment.imageIds[i],
              position: i,
            });
          }
        }
      }

      if (imagesToInsert.length > 0) {
        await db.insert(optionValueImages).values(imagesToInsert);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating variants in bulk:", error);
    return {
      success: false,
      error: { message: "Failed to update variants" },
    };
  }
}

// ============================================================================
// OPTION VALUE IMAGES (Image filtering system)
// ============================================================================

/**
 * Save option value image assignments for a product.
 * This replaces all existing assignments for the product.
 * Note: Prefer using imageAssignments in createProductVariantsInBulk/updateProductVariantsInBulk
 * which properly maps tempIds to real IDs.
 */
export async function saveOptionValueImages(
  tenantId: string,
  productId: string,
  assignments: OptionValueImageAssignment[]
): Promise<ActionResult> {
  try {
    // Delete all existing assignments for this product
    await db
      .delete(optionValueImages)
      .where(
        and(
          eq(optionValueImages.tenantId, tenantId),
          eq(optionValueImages.productId, productId)
        )
      );

    // Insert new assignments
    const insertValues: {
      tenantId: string;
      productId: string;
      optionValueId: string;
      mediaId: string;
      position: number;
    }[] = [];

    for (const assignment of assignments) {
      for (let i = 0; i < assignment.imageIds.length; i++) {
        insertValues.push({
          tenantId,
          productId,
          optionValueId: assignment.valueId,
          mediaId: assignment.imageIds[i],
          position: i,
        });
      }
    }

    if (insertValues.length > 0) {
      await db.insert(optionValueImages).values(insertValues);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving option value images:", error);
    return {
      success: false,
      error: { message: "Failed to save option value images" },
    };
  }
}

/**
 * Get option value image assignments for a product.
 */
export async function getOptionValueImages(
  tenantId: string,
  productId: string
): Promise<ActionResult<OptionValueImageAssignment[]>> {
  try {
    const images = await db.query.optionValueImages.findMany({
      where: and(
        eq(optionValueImages.tenantId, tenantId),
        eq(optionValueImages.productId, productId)
      ),
      with: {
        optionValue: {
          with: {
            option: true,
          },
        },
        media: true,
      },
      orderBy: (ovi, { asc }) => [asc(ovi.position)],
    });

    // Group by option value
    const assignmentMap = new Map<string, OptionValueImageAssignment>();

    for (const img of images) {
      const key = img.optionValueId;
      const existing = assignmentMap.get(key);

      if (existing) {
        existing.imageIds.push(img.mediaId);
      } else {
        assignmentMap.set(key, {
          optionId: img.optionValue.option.id,
          optionName: img.optionValue.option.name,
          valueId: img.optionValueId,
          value: img.optionValue.value,
          imageIds: [img.mediaId],
        });
      }
    }

    return {
      success: true,
      data: Array.from(assignmentMap.values()),
    };
  } catch (error) {
    console.error("Error getting option value images:", error);
    return {
      success: false,
      error: { message: "Failed to get option value images" },
    };
  }
}

/**
 * Update swatch configuration for an option value.
 */
export async function updateOptionValueSwatch(
  tenantId: string,
  valueId: string,
  swatchType: "text" | "color" | "image",
  swatchValue?: string
): Promise<ActionResult> {
  try {
    await db
      .update(variantOptionValues)
      .set({
        swatchType,
        swatchValue: swatchValue || null,
      })
      .where(
        and(
          eq(variantOptionValues.tenantId, tenantId),
          eq(variantOptionValues.id, valueId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error("Error updating option value swatch:", error);
    return {
      success: false,
      error: { message: "Failed to update swatch" },
    };
  }
}

/**
 * Bulk update swatch configurations for multiple option values.
 */
export async function bulkUpdateOptionValueSwatches(
  tenantId: string,
  updates: {
    valueId: string;
    swatchType: "text" | "color" | "image";
    swatchValue?: string;
  }[]
): Promise<ActionResult> {
  try {
    // Update each value
    for (const update of updates) {
      await db
        .update(variantOptionValues)
        .set({
          swatchType: update.swatchType,
          swatchValue: update.swatchValue || null,
        })
        .where(
          and(
            eq(variantOptionValues.tenantId, tenantId),
            eq(variantOptionValues.id, update.valueId)
          )
        );
    }

    return { success: true };
  } catch (error) {
    console.error("Error bulk updating swatches:", error);
    return {
      success: false,
      error: { message: "Failed to update swatches" },
    };
  }
}
