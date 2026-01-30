/**
 * Utility functions for option-based variant URLs
 *
 * URL format: ?size=extra-large&color=black
 * - Option names and values are slugified (lowercase, hyphens for spaces)
 * - Matching is case-insensitive
 * - Partial matches select the first variant matching all specified options
 */

import type { ProductWithDetails } from "@/lib/db/queries/products";

/**
 * Convert a string to a URL-safe slug
 * Supports Unicode characters (Persian, Arabic, etc.)
 *
 * Examples:
 * - "Extra Large" -> "extra-large"
 * - "Clothing Size" -> "clothing-size"
 * - "رنگ" -> "رنگ" (Persian "Color")
 * - "سایز بزرگ" -> "سایز-بزرگ" (Persian "Large Size")
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[?#&=+%]/g, "") // Remove URL-unsafe characters only
    .replace(/\-\-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Trim hyphens from start/end
}

/**
 * Build a map of slugified option name -> original option name
 * for a product's variants
 */
export function getOptionNameMap(
  product: ProductWithDetails
): Map<string, string> {
  const map = new Map<string, string>();

  if (!product.variants) return map;

  for (const variant of product.variants) {
    if (!variant.options) continue;
    for (const opt of variant.options) {
      const name = opt.optionValue?.option?.name;
      if (name) {
        map.set(slugify(name), name);
      }
    }
  }

  return map;
}

/**
 * Build a map of lowercased option value -> original option value
 * for a specific option name
 *
 * Uses lowercase (not slugify) to preserve Unicode characters like Persian
 */
export function getOptionValueMap(
  product: ProductWithDetails,
  optionName: string
): Map<string, string> {
  const map = new Map<string, string>();

  if (!product.variants) return map;

  for (const variant of product.variants) {
    if (!variant.options) continue;
    for (const opt of variant.options) {
      const name = opt.optionValue?.option?.name;
      const value = opt.optionValue?.value;
      if (name === optionName && value) {
        // Use lowercase for case-insensitive matching (preserves Unicode)
        map.set(value.toLowerCase().trim(), value);
      }
    }
  }

  return map;
}

/**
 * Parse URL search params and find the matching variant
 *
 * @param searchParams - URL search params object or string
 * @param product - Product with variants
 * @returns Object with variantId (if exact match) and parsed options
 */
export function parseVariantFromUrl(
  searchParams: URLSearchParams | Record<string, string | undefined>,
  product: ProductWithDetails
): {
  variantId: string | undefined;
  options: Record<string, string>;
} {
  if (!product.hasVariants || !product.variants?.length) {
    return { variantId: undefined, options: {} };
  }

  // Convert to URLSearchParams if needed
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(
          Object.entries(searchParams)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, v as string])
        );

  // Get the option name mapping for this product
  const optionNameMap = getOptionNameMap(product);

  // Parse options from URL params
  const parsedOptions: Record<string, string> = {};

  for (const [sluggedName, sluggedValue] of params.entries()) {
    // Skip non-option params (sort, rating, etc.)
    const originalName = optionNameMap.get(sluggedName);
    if (!originalName) continue;

    // Get the value mapping for this option
    const valueMap = getOptionValueMap(product, originalName);
    const originalValue = valueMap.get(sluggedValue.toLowerCase());

    if (originalValue) {
      parsedOptions[originalName] = originalValue;
    }
  }

  // If no options parsed, return undefined
  if (Object.keys(parsedOptions).length === 0) {
    return { variantId: undefined, options: {} };
  }

  // Find variant that matches ALL specified options
  const matchingVariant = product.variants.find((variant) => {
    if (!variant.options || !variant.isActive) return false;

    // Check if this variant has all the specified options with matching values
    for (const [optName, optValue] of Object.entries(parsedOptions)) {
      const variantOpt = variant.options.find(
        (o) => o.optionValue?.option?.name === optName
      );
      if (!variantOpt || variantOpt.optionValue?.value !== optValue) {
        return false;
      }
    }

    return true;
  });

  if (matchingVariant) {
    // Build full options from the matched variant
    const fullOptions: Record<string, string> = {};
    for (const opt of matchingVariant.options || []) {
      if (opt.optionValue?.option?.name && opt.optionValue?.value) {
        fullOptions[opt.optionValue.option.name] = opt.optionValue.value;
      }
    }
    return { variantId: matchingVariant.id, options: fullOptions };
  }

  // No exact match - return parsed options but no variant ID
  // This allows partial URL params to still influence selection
  return { variantId: undefined, options: parsedOptions };
}

/**
 * Build URL search params from selected options
 *
 * @param options - Selected options (original names/values)
 * @param existingParams - Existing URL params to preserve (sort, rating, etc.)
 * @returns URLSearchParams with option params
 */
export function buildVariantUrlParams(
  options: Record<string, string>,
  existingParams?: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams();

  // Preserve non-option params
  if (existingParams) {
    // Known non-option params to preserve
    const preserveParams = ["sort", "rating", "page"];
    for (const key of preserveParams) {
      const value = existingParams.get(key);
      if (value) {
        params.set(key, value);
      }
    }
  }

  // Add option params
  // - Slugify the NAME for consistent URL keys (Size -> size, Clothing Size -> clothing-size)
  // - Keep VALUE as-is for Unicode support (URLSearchParams handles encoding)
  for (const [name, value] of Object.entries(options)) {
    if (name && value) {
      const sluggedName = slugify(name);
      if (sluggedName) {
        params.set(sluggedName, value.toLowerCase().trim());
      }
    }
  }

  return params;
}

/**
 * Build a full URL path with variant options
 *
 * @param pathname - Base URL path
 * @param options - Selected options
 * @param existingParams - Existing params to preserve
 * @returns Full URL string with query params
 */
export function buildVariantUrl(
  pathname: string,
  options: Record<string, string>,
  existingParams?: URLSearchParams
): string {
  const params = buildVariantUrlParams(options, existingParams);
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

/**
 * Check if a variant matches the given options
 * Used for determining which variant to select when options change
 */
export function findVariantByOptions(
  product: ProductWithDetails,
  options: Record<string, string>
): string | null {
  if (!product.variants) return null;

  const optionEntries = Object.entries(options);
  if (optionEntries.length === 0) return null;

  for (const variant of product.variants) {
    if (!variant.options || !variant.isActive) continue;

    let allMatch = true;
    for (const [optName, optValue] of optionEntries) {
      const variantOpt = variant.options.find(
        (o) => o.optionValue?.option?.name === optName
      );
      if (!variantOpt || variantOpt.optionValue?.value !== optValue) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      return variant.id;
    }
  }

  return null;
}
