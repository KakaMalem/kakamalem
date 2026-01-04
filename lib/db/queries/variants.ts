"use server";

import { db } from "@/lib/db";
import {
  variantOptions,
  variantOptionValues,
  productVariants,
  productVariantImages,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export type VariantOptionWithValues = Awaited<
  ReturnType<typeof getTenantVariantOptions>
>[number];

/**
 * Get all variant options for a tenant with their values
 */
export async function getTenantVariantOptions(tenantId: string) {
  const options = await db.query.variantOptions.findMany({
    where: eq(variantOptions.tenantId, tenantId),
    with: {
      values: {
        orderBy: [asc(variantOptionValues.displayOrder)],
      },
    },
    orderBy: [asc(variantOptions.displayOrder), asc(variantOptions.name)],
  });

  return options;
}

/**
 * Get a single variant option by ID
 */
export async function getVariantOptionById(tenantId: string, optionId: string) {
  const option = await db.query.variantOptions.findFirst({
    where: and(
      eq(variantOptions.tenantId, tenantId),
      eq(variantOptions.id, optionId)
    ),
    with: {
      values: {
        orderBy: [asc(variantOptionValues.displayOrder)],
      },
    },
  });

  return option;
}

/**
 * Check if a variant option name is available within a tenant
 */
export async function checkVariantOptionNameAvailable(
  tenantId: string,
  name: string,
  excludeOptionId?: string
): Promise<boolean> {
  const conditions = [
    eq(variantOptions.tenantId, tenantId),
    eq(variantOptions.name, name),
  ];

  const existing = await db.query.variantOptions.findFirst({
    where: excludeOptionId
      ? and(...conditions, eq(variantOptions.id, excludeOptionId))
      : and(...conditions),
    columns: { id: true },
  });

  // If excludeOptionId is provided and matched, it's available (updating same option)
  if (excludeOptionId && existing?.id === excludeOptionId) {
    return true;
  }

  return !existing;
}

/**
 * Get product variants for a product
 */
export async function getProductVariants(tenantId: string, productId: string) {
  const variants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.productId, productId)
    ),
    with: {
      options: {
        with: {
          optionValue: {
            with: {
              option: true,
            },
          },
        },
      },
      image: true,
      images: {
        with: {
          media: true,
        },
        orderBy: [asc(productVariantImages.position)],
      },
    },
    orderBy: [asc(productVariants.displayOrder)],
  });

  return variants;
}

/**
 * Get a single variant by ID
 */
export async function getVariantById(tenantId: string, variantId: string) {
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.id, variantId)
    ),
    with: {
      options: {
        with: {
          optionValue: {
            with: {
              option: true,
            },
          },
        },
      },
      image: true,
      images: {
        with: {
          media: true,
        },
        orderBy: [asc(productVariantImages.position)],
      },
      product: true,
    },
  });

  return variant;
}

/**
 * Check if SKU is unique within tenant and product
 */
export async function checkVariantSkuAvailable(
  tenantId: string,
  productId: string,
  sku: string,
  excludeVariantId?: string
): Promise<boolean> {
  const conditions = [
    eq(productVariants.tenantId, tenantId),
    eq(productVariants.productId, productId),
    eq(productVariants.sku, sku),
  ];

  const existing = await db.query.productVariants.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  if (!existing) return true;
  if (excludeVariantId && existing.id === excludeVariantId) return true;

  return false;
}

/**
 * Get the unique variant options used by a specific product.
 * This reconstructs which options (Size, Color) and their values (S, M, L, Red, Blue)
 * are used by the product's variants.
 *
 * Used when editing a product to populate the variant options builder.
 */
export type ProductVariantOptionType = {
  id: string;
  name: string;
  displayOrder: number;
  values: {
    id: string;
    value: string;
    displayOrder: number;
  }[];
};

export async function getProductVariantOptionTypes(
  tenantId: string,
  productId: string
): Promise<ProductVariantOptionType[]> {
  // Get all variants for this product with their option values
  const variants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.productId, productId)
    ),
    with: {
      options: {
        with: {
          optionValue: {
            with: {
              option: true,
            },
          },
        },
      },
    },
  });

  // Build a map of optionId -> { option, values: Set<valueId> }
  const optionsMap = new Map<
    string,
    {
      option: { id: string; name: string; displayOrder: number };
      valuesMap: Map<string, { id: string; value: string; displayOrder: number }>;
    }
  >();

  for (const variant of variants) {
    for (const variantOption of variant.options) {
      const optionValue = variantOption.optionValue;
      const option = optionValue.option;

      if (!optionsMap.has(option.id)) {
        optionsMap.set(option.id, {
          option: {
            id: option.id,
            name: option.name,
            displayOrder: option.displayOrder,
          },
          valuesMap: new Map(),
        });
      }

      const entry = optionsMap.get(option.id)!;
      if (!entry.valuesMap.has(optionValue.id)) {
        entry.valuesMap.set(optionValue.id, {
          id: optionValue.id,
          value: optionValue.value,
          displayOrder: optionValue.displayOrder,
        });
      }
    }
  }

  // Convert map to array, sorted by option display order
  const result: ProductVariantOptionType[] = [];

  for (const [, entry] of optionsMap) {
    const values = Array.from(entry.valuesMap.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder
    );

    result.push({
      id: entry.option.id,
      name: entry.option.name,
      displayOrder: entry.option.displayOrder,
      values,
    });
  }

  // Sort by display order
  result.sort((a, b) => a.displayOrder - b.displayOrder);

  return result;
}
