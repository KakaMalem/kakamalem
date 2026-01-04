"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Heart, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VariantSelector } from "@/components/store/variant-selector";
import { formatPrice } from "@/lib/utils";
import { addToCartAction } from "@/lib/cart/actions";
import { useCartStore } from "@/lib/stores/use-cart-store";

import type { ProductWithDetails } from "@/lib/db/queries/products";

interface ReviewStats {
  averageRating: number | null;
  totalReviews: number;
}

interface ProductInfoProps {
  product: ProductWithDetails;
  tenantId: string;
  storeSlug: string;
  currency: string;
  reviewStats: ReviewStats;
  onVariantChange?: (variantId: string | null) => void;
}

export function ProductInfo({
  product,
  tenantId,
  storeSlug,
  currency,
  reviewStats,
  onVariantChange,
}: ProductInfoProps) {
  // Track selected options by option name (e.g., {Color: "Blue", Size: "M"})
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(() => {
    // Initialize with first variant's options
    if (
      product.hasVariants &&
      product.variants?.length &&
      product.variants[0].options
    ) {
      const initialOptions: Record<string, string> = {};
      for (const opt of product.variants[0].options) {
        if (opt.optionValue?.option?.name && opt.optionValue?.value) {
          initialOptions[opt.optionValue.option.name] = opt.optionValue.value;
        }
      }
      return initialOptions;
    }
    return {};
  });
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const setCart = useCartStore((state) => state.setCart);
  const setCartOpen = useCartStore((state) => state.setIsOpen);

  // Find the variant that matches ALL selected options
  const selectedVariant =
    product.hasVariants && product.variants
      ? product.variants.find((variant) => {
          if (!variant.options || variant.options.length === 0) return false;

          // Check if this variant matches all selected options
          return Object.entries(selectedOptions).every(
            ([optionName, selectedValue]) => {
              return variant.options?.some(
                (opt) =>
                  opt.optionValue?.option?.name === optionName &&
                  opt.optionValue?.value === selectedValue
              );
            }
          );
        })
      : undefined;

  const selectedVariantId = selectedVariant?.id || null;

  // Notify parent when variant changes
  useEffect(() => {
    onVariantChange?.(selectedVariantId);
  }, [selectedVariantId, onVariantChange]);

  // Determine price and stock based on whether product has variants
  const displayPrice =
    product.hasVariants && selectedVariant?.price
      ? parseFloat(selectedVariant.price)
      : parseFloat(product.price);

  const currentStock =
    product.hasVariants && selectedVariant
      ? selectedVariant.stock
      : product.stock;

  const isOutOfStock =
    product.trackInventory && currentStock <= 0 && !product.allowBackorder;

  // Group variants by option type for variant selector
  const variantOptions =
    product.hasVariants && product.variants
      ? groupVariantsByOption(product.variants)
      : null;

  const handleAddToCart = async () => {
    setIsAddingToCart(true);

    const result = await addToCartAction(
      tenantId,
      storeSlug,
      product.id,
      1,
      selectedVariantId
    );

    if (result.success) {
      setCart(result.cart, storeSlug);
      toast.success("Added to cart");
      // Open the cart drawer to show the added item
      setCartOpen(true);
    } else {
      toast.error(result.error);
    }

    setIsAddingToCart(false);
  };

  return (
    <div className="space-y-6 py-5">
      {/* Product Title */}
      <h1 className="text-3xl font-semibold">{product.name}</h1>

      {/* Rating */}
      {reviewStats.totalReviews > 0 && reviewStats.averageRating && (
        <div className="flex w-fit items-center rounded-sm border px-2.5 py-1.5">
          <span className="me-2.5 flex items-center gap-1 border-e pe-2.5 text-sm">
            <span className="text-lg font-medium">
              {reviewStats.averageRating.toFixed(1)}
            </span>
            <Star className="mb-0.5 size-4 fill-amber-500 stroke-transparent" />
          </span>
          <span className="text-muted-foreground">
            {reviewStats.totalReviews}{" "}
            {reviewStats.totalReviews === 1 ? "Review" : "Reviews"}
          </span>
        </div>
      )}

      {/* Price */}
      <div className="flex items-center gap-3">
        <h4 className="text-3xl font-bold">
          {formatPrice(displayPrice, currency)}
        </h4>
        {product.hasVariants && !selectedVariant && (
          <span className="text-sm font-medium text-muted-foreground">
            Starting price
          </span>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-muted-foreground">{product.description}</p>
      )}

      <Separator />

      {/* Variant Selectors */}
      {product.hasVariants && variantOptions && (
        <>
          {Object.entries(variantOptions).map(([optionName, values]) => {
            const options = values.map((value) => {
              // Check if selecting this value would result in a valid variant
              const potentialOptions = {
                ...selectedOptions,
                [optionName]: value,
              };
              const matchingVariant = product.variants?.find((variant) => {
                if (!variant.options || variant.options.length === 0)
                  return false;
                return Object.entries(potentialOptions).every(
                  ([optName, optValue]) => {
                    return variant.options?.some(
                      (opt) =>
                        opt.optionValue?.option?.name === optName &&
                        opt.optionValue?.value === optValue
                    );
                  }
                );
              });

              const isAvailable =
                !!matchingVariant?.isActive &&
                (matchingVariant.stock > 0 ||
                  !product.trackInventory ||
                  product.allowBackorder);

              return {
                label: value,
                value,
                isAvailable,
              };
            });

            return (
              <VariantSelector
                key={optionName}
                label={optionName}
                options={options}
                selectedValue={selectedOptions[optionName] || ""}
                onValueChange={(value) => {
                  setSelectedOptions((prev) => ({
                    ...prev,
                    [optionName]: value,
                  }));
                }}
              />
            );
          })}
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-6">
        <Button
          className="grow gap-2"
          disabled={isOutOfStock || isAddingToCart}
          onClick={handleAddToCart}
        >
          {isAddingToCart ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <ShoppingCart className="size-4" />
              Add to Cart
            </>
          )}
        </Button>
        <Button variant="secondary" className="grow gap-2">
          <Heart className="size-4" />
          Wish List
        </Button>
      </div>
    </div>
  );
}

// Helper to group variants by option type
function groupVariantsByOption(
  variants: NonNullable<ProductWithDetails["variants"]>
): Record<string, string[]> {
  const groups: Record<string, Set<string>> = {};

  for (const variant of variants) {
    if (!variant.options) continue;
    for (const opt of variant.options) {
      if (!opt.optionValue?.option?.name || !opt.optionValue?.value) continue;
      const optionName = opt.optionValue.option.name;
      const value = opt.optionValue.value;

      if (!groups[optionName]) {
        groups[optionName] = new Set();
      }
      groups[optionName].add(value);
    }
  }

  // Convert sets to arrays
  const result: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(groups)) {
    result[key] = Array.from(set);
  }

  return result;
}
