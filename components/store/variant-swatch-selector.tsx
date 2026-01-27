"use client";

import { useCallback, useMemo, useId } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SwatchType } from "@/lib/db/schema";

// Animation variants
const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// Types for variant option data
export type VariantOptionData = {
  id: string;
  name: string;
  displayOrder: number;
  values: VariantOptionValueData[];
};

export type VariantOptionValueData = {
  id: string;
  value: string;
  displayOrder: number;
  swatchType: SwatchType;
  swatchValue?: string | null; // Hex color or media ID
  swatchImageUrl?: string | null; // Resolved URL for image swatches
  /** Whether this value is available (has at least one in-stock variant) */
  isAvailable?: boolean;
  /** Image IDs for gallery filtering */
  filterImageIds?: string[];
};

// Type for a complete variant (combination of option values)
export type ProductVariantData = {
  id: string;
  sku?: string | null;
  displayName?: string | null;
  price?: string | null;
  stock: number;
  isActive: boolean;
  imageId?: string | null;
  optionValues: {
    optionId: string;
    valueId: string;
  }[];
};

interface VariantSwatchSelectorProps {
  /** Available options for this product */
  options: VariantOptionData[];
  /** All variants for this product */
  variants: ProductVariantData[];
  /** Currently selected option values (valueId per optionId) */
  selectedValues: Record<string, string>;
  /** Callback when selection changes */
  onSelectionChange: (optionId: string, valueId: string) => void;
  /** Callback when selected variant changes (for price display, add to cart, etc.) */
  onVariantChange?: (variant: ProductVariantData | null) => void;
  /** Callback when filter images should change */
  onFilterImagesChange?: (imageIds: string[] | null) => void;
  /** Base price to display when no variant selected */
  basePrice: string;
  /** Currency symbol */
  currency?: string;
  /** Show price per variant */
  showVariantPrice?: boolean;
  /** Minimum touch target size (for accessibility) */
  swatchSize?: "sm" | "md" | "lg";
  /** Layout direction */
  direction?: "horizontal" | "vertical";
  /** Show unavailable options as disabled */
  showUnavailable?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function VariantSwatchSelector({
  options,
  variants,
  selectedValues,
  onSelectionChange,
  onVariantChange,
  onFilterImagesChange,
  basePrice,
  currency = "AFN",
  showVariantPrice = true,
  swatchSize = "md",
  direction = "vertical",
  showUnavailable = true,
  disabled = false,
}: VariantSwatchSelectorProps) {
  // Generate unique IDs for accessibility
  const groupIdPrefix = useId();

  // Sort options by display order
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [options]);

  // Find the currently selected variant
  const selectedVariant = useMemo(() => {
    if (Object.keys(selectedValues).length !== options.length) {
      return null;
    }

    return (
      variants.find((variant) => {
        return variant.optionValues.every(
          (ov) => selectedValues[ov.optionId] === ov.valueId
        );
      }) || null
    );
  }, [selectedValues, variants, options.length]);

  // Determine which values are available based on current selection
  const getAvailableValues = useCallback(
    (optionId: string): Set<string> => {
      // Get other selected options
      const otherSelections = Object.entries(selectedValues)
        .filter(([id]) => id !== optionId)
        .map(([id, valueId]) => ({ optionId: id, valueId }));

      // Find variants that match the other selections
      const matchingVariants = variants.filter((variant) => {
        return otherSelections.every((sel) =>
          variant.optionValues.some(
            (ov) => ov.optionId === sel.optionId && ov.valueId === sel.valueId
          )
        );
      });

      // Get available values for this option
      const availableValues = new Set<string>();
      matchingVariants.forEach((variant) => {
        const optionValue = variant.optionValues.find(
          (ov) => ov.optionId === optionId
        );
        if (optionValue && variant.stock > 0 && variant.isActive) {
          availableValues.add(optionValue.valueId);
        }
      });

      return availableValues;
    },
    [selectedValues, variants]
  );

  // Handle value selection
  const handleSelect = useCallback(
    (optionId: string, valueId: string) => {
      if (disabled) return;

      onSelectionChange(optionId, valueId);

      // Find the option value for image filtering
      const option = options.find((o) => o.id === optionId);
      const value = option?.values.find((v) => v.id === valueId);

      if (
        value?.filterImageIds &&
        value.filterImageIds.length > 0 &&
        onFilterImagesChange
      ) {
        onFilterImagesChange(value.filterImageIds);
      }
    },
    [disabled, onSelectionChange, onFilterImagesChange, options]
  );

  // Notify parent when variant changes
  useMemo(() => {
    if (onVariantChange) {
      onVariantChange(selectedVariant);
    }
  }, [selectedVariant, onVariantChange]);

  // Swatch size classes
  const sizeClasses = {
    sm: {
      swatch: "h-8 w-8 min-w-8",
      text: "h-8 px-3 text-sm",
      icon: "h-3 w-3",
    },
    md: {
      swatch: "h-10 w-10 min-w-10",
      text: "h-10 px-4 text-sm",
      icon: "h-4 w-4",
    },
    lg: {
      swatch: "h-12 w-12 min-w-12",
      text: "h-12 px-5 text-base",
      icon: "h-5 w-5",
    },
  };

  const sizes = sizeClasses[swatchSize];

  return (
    <div
      className={cn(
        "space-y-4",
        direction === "horizontal" && "flex flex-wrap gap-6"
      )}
      role="group"
      aria-label="Product variant options"
    >
      {sortedOptions.map((option) => {
        const availableValues = getAvailableValues(option.id);
        const selectedValueId = selectedValues[option.id];
        const selectedValue = option.values.find(
          (v) => v.id === selectedValueId
        );
        const groupId = `${groupIdPrefix}-${option.id}`;

        // Sort values by display order
        const sortedValues = [...option.values].sort(
          (a, b) => a.displayOrder - b.displayOrder
        );

        return (
          <div
            key={option.id}
            className={cn(direction === "horizontal" && "flex-1 min-w-37.5")}
          >
            {/* Option label */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">{option.name}</span>
              {selectedValue && (
                <span className="text-sm text-muted-foreground">
                  : {selectedValue.value}
                </span>
              )}
            </div>

            {/* Swatches */}
            <div
              role="radiogroup"
              aria-labelledby={groupId}
              className="flex flex-wrap gap-2"
            >
              {sortedValues.map((value) => {
                const isSelected = selectedValueId === value.id;
                const isAvailable = availableValues.has(value.id);
                const shouldShow = showUnavailable || isAvailable;

                if (!shouldShow) return null;

                // Determine swatch rendering based on type
                const renderSwatch = () => {
                  // Color swatch
                  if (value.swatchType === "color" && value.swatchValue) {
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={`${option.name}: ${value.value}${!isAvailable ? " (unavailable)" : ""}`}
                              disabled={disabled || !isAvailable}
                              onClick={() => handleSelect(option.id, value.id)}
                              className={cn(
                                "relative rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                sizes.swatch,
                                isSelected &&
                                  "ring-2 ring-primary ring-offset-2",
                                !isAvailable && "opacity-40 cursor-not-allowed",
                                isAvailable &&
                                  !disabled &&
                                  "hover:scale-110 cursor-pointer"
                              )}
                              style={{ backgroundColor: value.swatchValue }}
                            >
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <Check
                                    className={cn(
                                      sizes.icon,
                                      isLightColor(value.swatchValue)
                                        ? "text-gray-800"
                                        : "text-white"
                                    )}
                                  />
                                </motion.div>
                              )}
                              {!isAvailable && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-full h-0.5 bg-gray-400 rotate-45 absolute" />
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{value.value}</p>
                            {!isAvailable && (
                              <p className="text-xs text-muted-foreground">
                                Out of stock
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  // Image swatch
                  if (value.swatchType === "image" && value.swatchImageUrl) {
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={`${option.name}: ${value.value}${!isAvailable ? " (unavailable)" : ""}`}
                              disabled={disabled || !isAvailable}
                              onClick={() => handleSelect(option.id, value.id)}
                              className={cn(
                                "relative rounded-md border-2 overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                sizes.swatch,
                                isSelected &&
                                  "ring-2 ring-primary ring-offset-2 border-primary",
                                !isAvailable && "opacity-40 cursor-not-allowed",
                                isAvailable &&
                                  !disabled &&
                                  "hover:scale-105 cursor-pointer"
                              )}
                            >
                              <Image
                                src={value.swatchImageUrl}
                                alt={value.value}
                                fill
                                className="object-cover"
                              />
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                                >
                                  <Check
                                    className={cn(sizes.icon, "text-white")}
                                  />
                                </motion.div>
                              )}
                              {!isAvailable && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                                  <div className="w-full h-0.5 bg-gray-600 rotate-45 absolute" />
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{value.value}</p>
                            {!isAvailable && (
                              <p className="text-xs text-muted-foreground">
                                Out of stock
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  // Text swatch (default)
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${option.name}: ${value.value}${!isAvailable ? " (unavailable)" : ""}`}
                      disabled={disabled || !isAvailable}
                      onClick={() => handleSelect(option.id, value.id)}
                      className={cn(
                        "relative rounded-md border-2 font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        sizes.text,
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground",
                        !isSelected &&
                          "border-input bg-background hover:bg-muted",
                        !isAvailable &&
                          "opacity-40 cursor-not-allowed line-through",
                        isAvailable && !disabled && "cursor-pointer"
                      )}
                    >
                      {value.value}
                    </button>
                  );
                };

                return (
                  <AnimatePresence key={value.id} mode="wait">
                    <motion.div
                      variants={scaleIn}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {renderSwatch()}
                    </motion.div>
                  </AnimatePresence>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selected variant info */}
      {showVariantPrice && selectedVariant && (
        <motion.div
          variants={scaleIn}
          initial="initial"
          animate="animate"
          className="pt-2 border-t"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedVariant.displayName || "Selected variant"}
            </span>
            <span className="font-semibold">
              {currency} {selectedVariant.price || basePrice}
            </span>
          </div>
          {selectedVariant.stock <= 0 && (
            <Badge variant="destructive" className="mt-1">
              <AlertCircle className="h-3 w-3 mr-1" />
              Out of stock
            </Badge>
          )}
          {selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
            <Badge variant="secondary" className="mt-1">
              Only {selectedVariant.stock} left
            </Badge>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Helper to determine if a hex color is light
function isLightColor(hex: string): boolean {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Calculate perceived brightness (ITU-R BT.709)
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return brightness > 0.5;
}

// Export helper types
export type { SwatchType };
