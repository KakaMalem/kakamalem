/**
 * Cartesian Product Utilities for Variant Generation
 *
 * These utilities generate all possible combinations of variant options
 * entirely on the client side - no server round-trip needed.
 */

/**
 * Represents a single option value in the Cartesian product calculation
 */
export type OptionValueForCartesian = {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
};

/**
 * Represents a generated variant combination
 */
export type GeneratedVariantCombination = {
  /** Unique client-side ID for React keys */
  tempId: string;
  /** The option values that make up this variant */
  optionValues: OptionValueForCartesian[];
  /** Human-readable display name (e.g., "Red / S / Cotton") */
  displayName: string;
};

/**
 * Generates the Cartesian product of multiple arrays.
 *
 * @example
 * generateCartesianProduct([['Red', 'Blue'], ['S', 'M', 'L']])
 * // Returns: [['Red', 'S'], ['Red', 'M'], ['Red', 'L'], ['Blue', 'S'], ['Blue', 'M'], ['Blue', 'L']]
 *
 * @param arrays - Array of arrays to compute the Cartesian product of
 * @returns Array of all possible combinations
 */
export function generateCartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  if (arrays.some((arr) => arr.length === 0)) return [];

  return arrays.reduce<T[][]>(
    (accumulator, currentArray) =>
      accumulator.flatMap((existingCombo) =>
        currentArray.map((item) => [...existingCombo, item])
      ),
    [[]] as T[][]
  );
}

/**
 * Generates a display name from an array of option values.
 * Uses " / " as the separator (e.g., "Red / S / Cotton").
 *
 * @param values - Array of value strings
 * @returns Formatted display name
 */
export function generateDisplayName(values: string[]): string {
  return values.filter(Boolean).join(" / ");
}

/**
 * Generates a suggested SKU from product slug and option values.
 * Converts to lowercase, replaces spaces with hyphens.
 *
 * @example
 * generateSku('blue-tshirt', ['Red', 'S'])
 * // Returns: 'blue-tshirt-red-s'
 *
 * @param productSlug - The product's URL slug
 * @param values - Array of option value strings
 * @returns Suggested SKU string
 */
export function generateSku(productSlug: string, values: string[]): string {
  const valuePart = values
    .map((v) =>
      v
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    )
    .filter(Boolean)
    .join("-");

  return `${productSlug}-${valuePart}`;
}

/**
 * Generates all variant combinations from a list of options with their values.
 * This is the main function used by the variant builder UI.
 *
 * @example
 * const options = [
 *   { optionId: '1', optionName: 'Color', values: [{ valueId: 'a', value: 'Red' }, { valueId: 'b', value: 'Blue' }] },
 *   { optionId: '2', optionName: 'Size', values: [{ valueId: 'c', value: 'S' }, { valueId: 'd', value: 'M' }] }
 * ];
 * generateVariantCombinations(options);
 * // Returns 4 combinations: Red/S, Red/M, Blue/S, Blue/M
 *
 * @param options - Array of options, each with their values
 * @returns Array of generated variant combinations
 */
export function generateVariantCombinations(
  options: {
    optionId: string;
    optionName: string;
    values: { valueId: string; value: string }[];
  }[]
): GeneratedVariantCombination[] {
  if (options.length === 0) return [];

  // Convert options to arrays of OptionValueForCartesian
  const optionValueArrays: OptionValueForCartesian[][] = options.map((option) =>
    option.values.map((val) => ({
      optionId: option.optionId,
      optionName: option.optionName,
      valueId: val.valueId,
      value: val.value,
    }))
  );

  // Generate Cartesian product
  const combinations = generateCartesianProduct(optionValueArrays);

  // Convert to GeneratedVariantCombination
  return combinations.map((combo, index) => {
    const valueStrings = combo.map((ov) => ov.value);
    return {
      tempId: `temp-variant-${index}-${Date.now()}`,
      optionValues: combo,
      displayName: generateDisplayName(valueStrings),
    };
  });
}

/**
 * Calculates the total number of variants that will be generated.
 * Useful for showing a preview count before generation.
 *
 * @param options - Array of options with their values
 * @returns Total number of combinations
 */
export function calculateVariantCount(
  options: { values: { valueId: string; value: string }[] }[]
): number {
  if (options.length === 0) return 0;
  if (options.some((opt) => opt.values.length === 0)) return 0;

  return options.reduce((total, option) => total * option.values.length, 1);
}

/**
 * Validates if the variant count is within acceptable limits.
 * Returns warnings or errors based on the count.
 *
 * @param count - Number of variants
 * @returns Validation result with status and message
 */
export function validateVariantCount(count: number): {
  status: "ok" | "warning" | "error";
  message: string | null;
} {
  if (count === 0) {
    return { status: "ok", message: null };
  }

  if (count > 100) {
    return {
      status: "error",
      message: `Too many variants (${count}). Maximum allowed is 100. Consider reducing the number of options or values.`,
    };
  }

  if (count > 50) {
    return {
      status: "warning",
      message: `This will create ${count} variants. Consider if all combinations are necessary.`,
    };
  }

  return { status: "ok", message: null };
}

/**
 * Groups variants by the first option for display purposes.
 * Useful for creating collapsible sections in the variant table.
 *
 * @example
 * // If first option is Color with values Red, Blue:
 * // Groups variants into { 'Red': [...variants], 'Blue': [...variants] }
 *
 * @param variants - Array of generated variant combinations
 * @returns Map of first option value to its variants
 */
export function groupVariantsByFirstOption(
  variants: GeneratedVariantCombination[]
): Map<string, GeneratedVariantCombination[]> {
  const groups = new Map<string, GeneratedVariantCombination[]>();

  for (const variant of variants) {
    if (variant.optionValues.length === 0) continue;

    const firstValue = variant.optionValues[0].value;

    if (!groups.has(firstValue)) {
      groups.set(firstValue, []);
    }

    groups.get(firstValue)!.push(variant);
  }

  return groups;
}

/**
 * Generic version of groupVariantsByFirstOption that works with any variant type
 * that has an optionValues array with a value property.
 *
 * @param variants - Array of variants with optionValues
 * @returns Map of first option value to its variants
 */
export function groupVariantsByFirstOptionGeneric<
  T extends { optionValues: { value: string }[] }
>(variants: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const variant of variants) {
    if (variant.optionValues.length === 0) continue;

    const firstValue = variant.optionValues[0].value;

    if (!groups.has(firstValue)) {
      groups.set(firstValue, []);
    }

    groups.get(firstValue)!.push(variant);
  }

  return groups;
}
