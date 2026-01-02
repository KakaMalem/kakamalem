"use server";

import { db } from "@/lib/db";
import {
  variantOptions,
  variantOptionValues,
  productVariants,
  productVariantOptions,
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

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

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
  const isAvailable = await checkVariantOptionNameAvailable(tenantId, input.name);
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
  const isAvailable = await checkVariantOptionNameAvailable(tenantId, input.name);
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
      updatedAt: new Date(),
    })
    .where(
      and(eq(variantOptions.tenantId, tenantId), eq(variantOptions.id, optionId))
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
      and(eq(variantOptions.tenantId, tenantId), eq(variantOptions.id, optionId))
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
  const optionValuesData = optionValueIds.length > 0
    ? await db.query.variantOptionValues.findMany({
        where: inArray(variantOptionValues.id, optionValueIds),
        with: { option: true },
      })
    : [];

  const optionValuesMap = new Map(
    optionValuesData.map((v) => [v.id, { value: v.value, optionName: v.option.name }])
  );

  const displayName = generateDisplayName(optionValueIds, optionValuesMap);

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
      imageId: input.imageId || null,
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

  // Update product to hasVariants = true
  await db
    .update(products)
    .set({ hasVariants: true, updatedAt: new Date() })
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
  const optionValuesData = optionValueIds.length > 0
    ? await db.query.variantOptionValues.findMany({
        where: inArray(variantOptionValues.id, optionValueIds),
        with: { option: true },
      })
    : [];

  const optionValuesMap = new Map(
    optionValuesData.map((v) => [v.id, { value: v.value, optionName: v.option.name }])
  );

  const displayName = generateDisplayName(optionValueIds, optionValuesMap);

  const stockNum = parseInt(input.stock) || 0;

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
      imageId: input.imageId || null,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
      updatedAt: new Date(),
    })
    .where(
      and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, variantId))
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
      and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, variantId))
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
      .set({ hasVariants: false, updatedAt: new Date() })
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
        .set({ hasVariants: false, updatedAt: new Date() })
        .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
    }
  }

  return { success: true };
}
