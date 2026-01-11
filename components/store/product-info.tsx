"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Heart,
  Loader2,
  Star,
  Tag,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VariantSelector } from "@/components/store/variant-selector";
import { cn, formatPrice } from "@/lib/utils";
import { getDisplayPrices } from "@/lib/utils/pricing-display";
import { addToCartAction } from "@/lib/cart/actions";
import { toggleWishlistAction } from "@/lib/actions/wishlists";
import { useCartStore } from "@/lib/stores/use-cart-store";

import type { ProductWithDetails } from "@/lib/db/queries/products";
import type { PriceTier } from "@/lib/db/schema";

interface ReviewStats {
  averageRating: number | null;
  totalReviews: number;
}

interface ProductInfoProps {
  product: ProductWithDetails & {
    compareAtPrice?: string | null;
    minOrderQuantity?: number | null;
    maxOrderQuantity?: number | null;
  };
  tenantId: string;
  storeSlug: string;
  currency: string;
  reviewStats: ReviewStats;
  priceTiers?: PriceTier[];
  onVariantChange?: (variantId: string | null) => void;
  initialIsInWishlist?: boolean;
}

export function ProductInfo({
  product,
  tenantId,
  storeSlug,
  currency,
  reviewStats,
  priceTiers = [],
  onVariantChange,
  initialIsInWishlist = false,
}: ProductInfoProps) {
  // Track selected options by option name (e.g., {Color: "Blue", Size: "M"})
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(() => {
    // Initialize with first available variant's options
    if (product.hasVariants && product.variants?.length) {
      // Find first available variant (active and in stock)
      const firstAvailableVariant = product.variants.find((variant) => {
        if (!variant.isActive) return false;
        // Available if: not tracking inventory, allows backorder, or has stock
        return (
          !product.trackInventory || product.allowBackorder || variant.stock > 0
        );
      });

      // Fall back to first variant if none are available
      const variantToUse = firstAvailableVariant || product.variants[0];

      if (variantToUse?.options) {
        const initialOptions: Record<string, string> = {};
        for (const opt of variantToUse.options) {
          if (opt.optionValue?.option?.name && opt.optionValue?.value) {
            initialOptions[opt.optionValue.option.name] = opt.optionValue.value;
          }
        }
        return initialOptions;
      }
    }
    return {};
  });
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(initialIsInWishlist);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const [quantity, setQuantity] = useState(product.minOrderQuantity ?? 1);
  const setCart = useCartStore((state) => state.setCart);
  const setCartOpen = useCartStore((state) => state.setIsOpen);

  // Order quantity limits
  const minQty = product.minOrderQuantity ?? 1;
  const maxQty = product.maxOrderQuantity ?? 999;

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
  const basePrice =
    product.hasVariants && selectedVariant?.price
      ? selectedVariant.price
      : product.price;

  const baseCompareAtPrice =
    product.hasVariants && selectedVariant?.compareAtPrice
      ? selectedVariant.compareAtPrice
      : (product as ProductWithDetails & { compareAtPrice?: string | null })
          .compareAtPrice;

  // Get display prices with discount calculation
  const {
    price: displayPrice,
    discountPercent,
    hasDiscount,
  } = getDisplayPrices(basePrice, baseCompareAtPrice ?? null);

  const currentStock =
    product.hasVariants && selectedVariant
      ? selectedVariant.stock
      : product.stock;

  const isOutOfStock =
    product.trackInventory && currentStock <= 0 && !product.allowBackorder;

  // Sort price tiers by minQuantity
  const sortedTiers = useMemo(
    () => [...priceTiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [priceTiers]
  );

  // Find the applicable tier for current quantity
  const applicableTier = useMemo(() => {
    if (sortedTiers.length === 0) return null;
    // Find the highest tier that the quantity qualifies for
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      const tier = sortedTiers[i];
      if (quantity >= tier.minQuantity) {
        if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
          return tier;
        }
      }
    }
    return null;
  }, [sortedTiers, quantity]);

  // Calculate the effective price (tier price if applicable, otherwise base price)
  const effectivePrice = applicableTier
    ? parseFloat(applicableTier.price)
    : displayPrice;

  // Calculate total price
  const totalPrice = effectivePrice * quantity;

  // Calculate savings compared to base price
  const savingsPerUnit = applicableTier ? displayPrice - effectivePrice : 0;
  const totalSavings = savingsPerUnit * quantity;

  // Group variants by option type for variant selector
  const variantOptions =
    product.hasVariants && product.variants
      ? groupVariantsByOption(product.variants)
      : null;

  // Quantity controls
  const incrementQuantity = () => {
    const newQty = Math.min(quantity + 1, maxQty, currentStock || maxQty);
    setQuantity(newQty);
  };

  const decrementQuantity = () => {
    const newQty = Math.max(quantity - 1, minQty);
    setQuantity(newQty);
  };

  const handleQuantityChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(
      minQty,
      Math.min(parsed, maxQty, currentStock || maxQty)
    );
    setQuantity(clamped);
  };

  // Check if can add more (considering stock)
  const canIncrement =
    quantity < maxQty && (!product.trackInventory || quantity < currentStock);
  const canDecrement = quantity > minQty;

  const handleAddToCart = async () => {
    setIsAddingToCart(true);

    const result = await addToCartAction(
      tenantId,
      storeSlug,
      product.id,
      quantity,
      selectedVariantId
    );

    if (result.success) {
      setCart(result.cart, storeSlug);
      toast.success(`${quantity} item${quantity > 1 ? "s" : ""} added to cart`);
      // Open the cart drawer to show the added item
      setCartOpen(true);
    } else {
      toast.error(result.error);
    }

    setIsAddingToCart(false);
  };

  const handleToggleWishlist = async () => {
    setIsTogglingWishlist(true);

    const result = await toggleWishlistAction(
      tenantId,
      product.id,
      selectedVariantId ?? undefined
    );

    if (result.error) {
      toast.error(result.error.message);
    } else if (result.data) {
      setIsInWishlist(result.data.action === "added");
      toast.success(
        result.data.action === "added"
          ? "Added to wishlist"
          : "Removed from wishlist"
      );
    }

    setIsTogglingWishlist(false);
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

      {/* Price Section */}
      <div className="space-y-4">
        {/* Current Price */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <h4 className="text-3xl font-bold text-primary">
            {formatPrice(effectivePrice, currency)}
          </h4>
          {(hasDiscount || applicableTier) && (
            <span className="text-xl text-muted-foreground line-through">
              {formatPrice(displayPrice, currency)}
            </span>
          )}
          {hasDiscount && discountPercent && !applicableTier && (
            <Badge variant="destructive" className="text-sm font-semibold">
              -{discountPercent}% OFF
            </Badge>
          )}
          {applicableTier && (
            <Badge className="bg-green-600 text-sm font-semibold">
              Bulk Discount Applied
            </Badge>
          )}
          {product.hasVariants && !selectedVariant && !hasDiscount && (
            <span className="text-sm font-medium text-muted-foreground">
              Starting price
            </span>
          )}
        </div>

        {/* Total and Savings */}
        {quantity > 1 && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {quantity} items × {formatPrice(effectivePrice, currency)}
              </span>
              <span className="text-lg font-bold">
                {formatPrice(totalPrice, currency)}
              </span>
            </div>
            {totalSavings > 0 && (
              <div className="flex items-center justify-between mt-1 text-green-600">
                <span className="text-sm">You save</span>
                <span className="text-sm font-semibold">
                  {formatPrice(totalSavings, currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Price Tiers (Quantity Discounts) */}
        {sortedTiers.length > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="size-4 text-primary" />
              <span className="font-semibold">Bulk Pricing - Save More!</span>
            </div>
            <div className="space-y-2">
              {sortedTiers.map((tier) => {
                const tierPrice = parseFloat(tier.price);
                const savings = Math.round(
                  ((displayPrice - tierPrice) / displayPrice) * 100
                );
                const isActive = applicableTier?.id === tier.id;

                return (
                  <div
                    key={tier.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md transition-colors",
                      isActive
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <Check className="size-4 text-primary shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          isActive ? "font-medium" : "text-muted-foreground"
                        )}
                      >
                        {tier.maxQuantity === null
                          ? `${tier.minQuantity}+ units`
                          : `${tier.minQuantity}-${tier.maxQuantity} units`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          isActive && "text-primary"
                        )}
                      >
                        {formatPrice(tierPrice, currency)}
                      </span>
                      {savings > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            isActive && "bg-green-100 text-green-700"
                          )}
                        >
                          -{savings}%
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Quantity Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Quantity</span>
          {product.showStock &&
            product.trackInventory &&
            currentStock > 0 &&
            currentStock <= 10 && (
              <span className="text-sm text-amber-600">
                Only {currentStock} left in stock
              </span>
            )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-lg">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-r-none"
              onClick={decrementQuantity}
              disabled={!canDecrement || isAddingToCart}
            >
              <Minus className="size-4" />
            </Button>
            <Input
              type="number"
              min={minQty}
              max={Math.min(
                maxQty,
                product.trackInventory ? currentStock : maxQty
              )}
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="h-10 w-16 text-center border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isAddingToCart}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-l-none"
              onClick={incrementQuantity}
              disabled={!canIncrement || isAddingToCart}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {minQty > 1 && (
            <span className="text-sm text-muted-foreground">
              Min. order: {minQty}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          className="grow gap-2 h-12 text-base"
          size="lg"
          disabled={isOutOfStock || isAddingToCart}
          onClick={handleAddToCart}
        >
          {isAddingToCart ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <ShoppingCart className="size-5" />
              Add to Cart
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-12 px-4"
          onClick={handleToggleWishlist}
          disabled={isTogglingWishlist}
        >
          {isTogglingWishlist ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Heart
              className={cn(
                "size-5",
                isInWishlist && "fill-red-500 stroke-red-500"
              )}
            />
          )}
        </Button>
      </div>

      {/* Stock Status */}
      {isOutOfStock && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-center font-medium">
          Out of Stock
        </div>
      )}
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
