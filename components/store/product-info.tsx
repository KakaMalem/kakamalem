"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart,
  Heart,
  Loader2,
  Star,
  Minus,
  Plus,
  AlertCircle,
  Phone,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { VariantSelector } from "@/components/store/variant-selector";
import { BulkPricingTiers } from "@/components/store/bulk-pricing-tiers";
import { cn, formatPrice } from "@/lib/utils";
import { getDisplayPrices } from "@/lib/utils/pricing-display";
import { toggleWishlistAction } from "@/lib/actions/wishlists";
import { useCart } from "@/lib/hooks/use-cart";
import type { CartItemProduct, CartItemVariant } from "@/lib/types/cart";

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
  /** When true, hides add-to-cart and quantity controls */
  catalogMode?: boolean;
  /** Store mode for appropriate messaging */
  storeMode?: "full" | "online_only" | "offline_only" | "catalog";
  /** Contact phone for catalog/offline mode */
  contactPhone?: string | null;
}

export function ProductInfo({
  product,
  tenantId,
  currency,
  reviewStats,
  priceTiers = [],
  onVariantChange,
  initialIsInWishlist = false,
  catalogMode = false,
  storeMode = "full",
  contactPhone,
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
  const [isInWishlist, setIsInWishlist] = useState(initialIsInWishlist);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const [quantity, setQuantity] = useState(product.minOrderQuantity ?? 1);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [editingQtyValue, setEditingQtyValue] = useState("");
  const [addToCartError, setAddToCartError] = useState<string | null>(null);
  const [shakeButton, setShakeButton] = useState(false);

  // Use the new cart hook
  const {
    addToCart,
    isAdding: isAddingToCart,
    addError,
  } = useCart({ debounce: false });

  // Order quantity limits (no default max - supports bulk/wholesale orders)
  const minQty = product.minOrderQuantity ?? 1;
  const maxQty = product.maxOrderQuantity ?? null; // null = unlimited

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
    compareAtPrice: displayCompareAtPrice,
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

  // Quantity controls (supports unlimited quantities for bulk orders)
  const incrementQuantity = () => {
    let newQty = quantity + 1;
    // Apply max limit if set
    if (maxQty !== null) newQty = Math.min(newQty, maxQty);
    // Apply stock limit if tracking inventory
    if (product.trackInventory && !product.allowBackorder && currentStock) {
      newQty = Math.min(newQty, currentStock);
    }
    setQuantity(newQty);
  };

  const decrementQuantity = () => {
    const newQty = Math.max(quantity - 1, minQty);
    setQuantity(newQty);
  };

  const handleQuantityInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    // Allow empty string for typing, or valid positive integers
    if (value === "" || /^\d+$/.test(value)) {
      setEditingQtyValue(value);

      // Update quantity in real-time for valid numbers (enables live tier pricing)
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= minQty) {
        let clamped = parsed;
        if (maxQty !== null) clamped = Math.min(clamped, maxQty);
        if (product.trackInventory && !product.allowBackorder && currentStock) {
          clamped = Math.min(clamped, currentStock);
        }
        setQuantity(clamped);
      }
    }
  };

  const handleQuantityInputFocus = () => {
    setIsEditingQty(true);
    setEditingQtyValue(String(quantity));
  };

  const handleQuantityInputBlur = () => {
    setIsEditingQty(false);
    const parsed = parseInt(editingQtyValue, 10);
    if (isNaN(parsed) || parsed < minQty) {
      // Reset to min quantity if invalid
      return;
    }
    let clamped = Math.max(minQty, parsed);
    // Apply max limit if set
    if (maxQty !== null) clamped = Math.min(clamped, maxQty);
    // Apply stock limit if tracking inventory
    if (product.trackInventory && !product.allowBackorder && currentStock) {
      clamped = Math.min(clamped, currentStock);
    }
    if (clamped !== quantity) {
      setQuantity(clamped);
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setIsEditingQty(false);
      setEditingQtyValue(String(quantity));
      e.currentTarget.blur();
    }
  };

  // Display value: use editingQtyValue while editing, otherwise quantity
  const displayQtyValue = isEditingQty ? editingQtyValue : String(quantity);

  // Check if can add more (considering stock and optional max limit)
  const canIncrement =
    (maxQty === null || quantity < maxQty) &&
    (!product.trackInventory ||
      product.allowBackorder ||
      quantity < currentStock);
  const canDecrement = quantity > minQty;

  // Trigger shake animation on error
  const triggerShake = useCallback(() => {
    setShakeButton(true);
    setTimeout(() => setShakeButton(false), 500);
  }, []);

  // Clear error after a delay
  useEffect(() => {
    if (addToCartError) {
      const timer = setTimeout(() => setAddToCartError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [addToCartError]);

  const handleAddToCart = () => {
    setAddToCartError(null);

    // Build optimistic product data for immediate UI feedback
    const optimisticProduct: CartItemProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      trackInventory: product.trackInventory,
      allowBackorder: product.allowBackorder,
      status: product.status,
      hasVariants: product.hasVariants,
      image: product.images?.[0]
        ? {
            url: product.images[0].media.url,
            altText: product.images[0].media.altText,
          }
        : null,
      priceTiers: priceTiers.map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        price: tier.price,
      })),
    };

    // Build optimistic variant data if selected
    const optimisticVariant: CartItemVariant = selectedVariant
      ? {
          id: selectedVariant.id,
          displayName: selectedVariant.displayName,
          price: selectedVariant.price,
          stock: selectedVariant.stock,
          isActive: selectedVariant.isActive,
        }
      : null;

    addToCart(
      product.id,
      quantity,
      selectedVariantId,
      optimisticProduct,
      optimisticVariant
    );
  };

  // Handle add to cart errors - track previous error to detect new errors during render
  const [prevAddError, setPrevAddError] = useState(addError);
  if (addError !== prevAddError) {
    setPrevAddError(addError);
    if (addError) {
      triggerShake();
      setAddToCartError(addError.message);
    }
  }

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
    <div className="space-y-5 sm:space-y-6">
      {/* Product Title */}
      <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
        {product.name}
      </h1>

      {/* Rating */}
      {reviewStats.totalReviews > 0 && reviewStats.averageRating && (
        <a
          href="#reviews"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 transition-colors hover:bg-muted"
        >
          <div className="flex items-center gap-1">
            <Star className="size-4 fill-amber-500 stroke-transparent" />
            <span className="text-sm font-medium">
              {reviewStats.averageRating.toFixed(1)}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            ({reviewStats.totalReviews}{" "}
            {reviewStats.totalReviews === 1 ? "review" : "reviews"})
          </span>
        </a>
      )}

      {/* Price Section */}
      <div className="space-y-3 sm:space-y-4">
        {/* Current Price */}
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl font-bold">
            {formatPrice(effectivePrice, currency)}
          </span>
          {(hasDiscount || applicableTier) && (
            <span className="text-base sm:text-lg text-muted-foreground line-through">
              {formatPrice(
                applicableTier
                  ? displayPrice
                  : (displayCompareAtPrice ?? displayPrice),
                currency
              )}
            </span>
          )}
          {hasDiscount && discountPercent && !applicableTier && (
            <Badge
              variant="destructive"
              className="text-xs sm:text-sm font-semibold"
            >
              -{discountPercent}%
            </Badge>
          )}
          {applicableTier && (
            <Badge className="bg-green-600 text-xs sm:text-sm font-semibold">
              Bulk Discount
            </Badge>
          )}
          {product.hasVariants && !selectedVariant && !hasDiscount && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              Starting price
            </span>
          )}
        </div>

        {/* Total and Savings */}
        {quantity > 1 && (
          <div className="p-3 bg-muted/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {quantity} × {formatPrice(effectivePrice, currency)}
              </span>
              <span className="text-base sm:text-lg font-bold">
                {formatPrice(totalPrice, currency)}
              </span>
            </div>
            {totalSavings > 0 && (
              <div className="flex items-center justify-between mt-1.5 text-green-600">
                <span className="text-xs sm:text-sm">You save</span>
                <span className="text-xs sm:text-sm font-semibold">
                  {formatPrice(totalSavings, currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Price Tiers (Quantity Discounts) */}
        {sortedTiers.length > 0 && (
          <BulkPricingTiers
            tiers={sortedTiers}
            basePrice={displayPrice}
            currency={currency}
            quantity={quantity}
            onQuantityChange={!catalogMode ? setQuantity : undefined}
          />
        )}
      </div>

      {/* Description */}
      {product.description && <RichTextContent html={product.description} />}

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

      {/* Quantity Selector - Hidden in catalog mode */}
      {!catalogMode && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Quantity
            </span>
            {product.showStock &&
              product.trackInventory &&
              currentStock > 0 &&
              currentStock <= 10 && (
                <span className="text-xs sm:text-sm text-amber-600 font-medium">
                  Only {currentStock} left
                </span>
              )}
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl border-2 border-border">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 sm:size-12 rounded-l-lg rounded-r-none hover:bg-muted/50"
                onClick={decrementQuantity}
                disabled={!canDecrement || isAddingToCart}
              >
                <Minus className="size-4 sm:size-5" />
              </Button>
              <Input
                type="text"
                inputMode="numeric"
                value={displayQtyValue}
                onChange={handleQuantityInputChange}
                onFocus={handleQuantityInputFocus}
                onBlur={handleQuantityInputBlur}
                onKeyDown={handleQuantityKeyDown}
                onWheel={(e) => e.currentTarget.blur()}
                className="h-11 sm:h-12 w-16 sm:w-20 text-center text-base font-medium border-0 rounded-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                disabled={isAddingToCart}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 sm:size-12 rounded-r-lg rounded-l-none hover:bg-muted/50"
                onClick={incrementQuantity}
                disabled={!canIncrement || isAddingToCart}
              >
                <Plus className="size-4 sm:size-5" />
              </Button>
            </div>
            {minQty > 1 && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                Min: {minQty}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons - Different for catalog/offline mode */}
      {catalogMode ? (
        <div className="rounded-xl bg-muted/30 p-4 text-center">
          {storeMode === "offline_only" ? (
            <>
              <div className="mb-2 flex justify-center">
                <Store className="size-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Available in-store only
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Visit us to purchase this product
              </p>
              {contactPhone && (
                <a
                  href={`tel:${contactPhone}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-95"
                >
                  <Phone className="size-4" />
                  Call: {contactPhone}
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Interested in this product? Contact us for pricing and
                availability.
              </p>
              {contactPhone && (
                <a
                  href={`tel:${contactPhone}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95"
                >
                  <Phone className="size-4" />
                  Call: {contactPhone}
                </a>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Out of stock notice */}
          {isOutOfStock && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-center text-sm font-medium">
              Currently out of stock
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 sm:gap-3">
            <Button
              className={cn(
                "flex-1 gap-2 h-12 sm:h-14 text-sm sm:text-base rounded-xl transition-all active:scale-[0.98]",
                shakeButton && "animate-shake",
                addToCartError && "ring-2 ring-destructive ring-offset-2"
              )}
              size="lg"
              disabled={isOutOfStock || isAddingToCart}
              onClick={handleAddToCart}
            >
              {isAddingToCart ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span className="hidden sm:inline">Adding...</span>
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
              className="size-12 sm:size-14 shrink-0 rounded-xl border-2"
              onClick={handleToggleWishlist}
              disabled={isTogglingWishlist}
              aria-label={
                isInWishlist ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              {isTogglingWishlist ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Heart
                  className={cn(
                    "size-5 sm:size-6 transition-colors",
                    isInWishlist && "fill-red-500 stroke-red-500"
                  )}
                />
              )}
            </Button>
          </div>

          {/* Error Message */}
          {addToCartError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-xl text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>{addToCartError}</span>
            </div>
          )}
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
