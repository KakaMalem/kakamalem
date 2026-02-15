"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  ShoppingCart,
  Heart,
  Star,
  Loader2,
  Eye,
  ImageOff,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getDisplayPricesWithCampaign,
  type CampaignDiscount,
} from "@/lib/utils/pricing-display";
import { useWishlist } from "@/lib/hooks/use-wishlist";
import { buildVariantUrl } from "@/lib/utils/variant-url";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useStoreBasePath } from "@/components/store/store-path-provider";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    compareAtPrice?: string | null;
    stock: number;
    hasVariants: boolean;
    trackInventory: boolean;
    showStock: boolean;
    status: "draft" | "active" | "archived";
    image: { url: string; altText: string | null } | null;
    /** Lowest variant price (for products with variants) */
    minVariantPrice?: string;
    /** Highest variant price (for products with variants) */
    maxVariantPrice?: string;
    rating?: number;
    reviewCount?: number;
    isNew?: boolean;
  };
  tenantId: string;
  storeSlug: string;
  currency: string;
  className?: string;
  onAddToCart?: (productId: string) => void;
  isAddingToCart?: boolean;
  /** When true, hides add-to-cart button (catalog/showcase mode) */
  catalogMode?: boolean;
  /** Set to true for above-the-fold cards to prioritize loading */
  priority?: boolean;
  /** Optional variant options for direct variant linking (e.g., {Size: "Large", Color: "Black"}) */
  variantOptions?: Record<string, string>;
  /** Optional campaign discount to apply */
  campaignDiscount?: CampaignDiscount | null;
}

export function ProductCard({
  product,
  tenantId,
  storeSlug: _storeSlug,
  currency: _currency,
  className,
  onAddToCart,
  isAddingToCart = false,
  catalogMode = false,
  priority = false,
  variantOptions,
  campaignDiscount = null,
}: ProductCardProps) {
  const { format: formatPrice } = useCurrencyStore();
  const basePath = useStoreBasePath();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Build product URL with optional variant options for direct variant linking
  // Uses human-readable format: ?size=large&color=black
  const productPath = `${basePath}/product/${product.slug}`;
  const productUrl =
    variantOptions && Object.keys(variantOptions).length > 0
      ? buildVariantUrl(productPath, variantOptions)
      : productPath;

  // Wishlist state with optimistic updates
  const {
    isInWishlist,
    toggleWishlist,
    isPending: isWishlistPending,
  } = useWishlist({
    tenantId,
    productId: product.id,
  });

  const isOutOfStock = product.trackInventory && product.stock <= 0;
  const isLowStock =
    product.trackInventory && product.stock > 0 && product.stock <= 5;

  // Determine the display price for products with variants
  // Use minVariantPrice if available (actual lowest price), otherwise fall back to product.price
  const effectivePrice =
    product.hasVariants && product.minVariantPrice
      ? product.minVariantPrice
      : product.price;

  // Use centralized pricing utility with campaign discount support
  const {
    price,
    compareAtPrice,
    discountPercent,
    hasDiscount,
    hasCampaignDiscount,
    campaignBadgeText,
  } = getDisplayPricesWithCampaign(
    effectivePrice,
    product.compareAtPrice ?? null,
    campaignDiscount
  );

  // Only show "From" prefix if variants have different prices
  const showFromPrefix =
    product.hasVariants &&
    product.minVariantPrice &&
    product.maxVariantPrice &&
    product.minVariantPrice !== product.maxVariantPrice;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    if (onAddToCart) {
      onAddToCart(product.id);
    } else {
      window.location.href = productUrl;
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist();
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-background",
        "shadow-sm transition-shadow duration-300 hover:shadow-md",
        className
      )}
    >
      {/* Image Container - 1:1 aspect ratio (square, industry standard) */}
      <Link
        href={productUrl}
        className="relative aspect-square overflow-hidden bg-muted/30"
      >
        {/* Shimmer loading placeholder */}
        <div
          className={cn(
            "absolute inset-0 z-1 overflow-hidden transition-opacity duration-300",
            imageLoaded || !product.image || imageError
              ? "opacity-0"
              : "opacity-100"
          )}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Product image */}
        {product.image && !imageError ? (
          <Image
            src={product.image.url}
            alt={product.image.altText || product.name}
            fill
            priority={priority}
            className={cn(
              "object-cover transition-all duration-500 ease-out",
              "group-hover:scale-105",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          // Placeholder for no image or error
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/30">
            {imageError ? (
              <>
                <ImageOff className="size-8 sm:size-10" />
                <span className="text-[10px] sm:text-xs">
                  Image unavailable
                </span>
              </>
            ) : (
              <ShoppingBag className="size-10 sm:size-12" />
            )}
          </div>
        )}

        {/* Left badges - NEW, Low Stock, Sold Out */}
        <div className="absolute left-1.5 top-1.5 z-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              New
            </span>
          )}
          {isLowStock && !isOutOfStock && product.showStock && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              Low Stock
            </span>
          )}
          {isOutOfStock && (
            <span className="rounded-md bg-gray-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
              Sold Out
            </span>
          )}
        </div>

        {/* Right badge - Discount (campaign badge text or percentage) */}
        {hasDiscount && (
          <span className="absolute right-1.5 top-1.5 z-2 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {hasCampaignDiscount && campaignBadgeText
              ? campaignBadgeText
              : discountPercent
                ? `-${discountPercent}%`
                : "Sale"}
          </span>
        )}
      </Link>

      {/* Content - Price first layout */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {/* Price Row */}
        <div className="flex items-baseline gap-1.5">
          {showFromPrefix && (
            <span className="text-[10px] text-muted-foreground">From</span>
          )}
          <span className="text-sm font-bold tracking-tight">
            {formatPrice(price)}
          </span>
          {hasDiscount && compareAtPrice && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatPrice(compareAtPrice)}
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-foreground/90 sm:text-sm">
          <Link
            href={productUrl}
            className="transition-colors hover:text-foreground"
          >
            {product.name}
          </Link>
        </h3>

        {/* Rating */}
        {product.rating && product.rating > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-medium">
              {product.rating.toFixed(1)}
            </span>
            {product.reviewCount && product.reviewCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({product.reviewCount})
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="min-h-1 flex-1" />

        {/* Action Buttons */}
        <div className="mt-2 flex gap-1.5">
          {/* Wishlist Button */}
          <button
            onClick={handleToggleWishlist}
            disabled={isWishlistPending}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 active:scale-95",
              isInWishlist
                ? "border-red-200 bg-red-50 text-red-500"
                : "border-border bg-background text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            )}
            aria-label={
              isInWishlist ? "Remove from wishlist" : "Add to wishlist"
            }
          >
            {isWishlistPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Heart
                className={cn(
                  "size-3.5 transition-colors",
                  isInWishlist && "fill-current"
                )}
              />
            )}
          </button>

          {/* Cart/View Button */}
          {catalogMode ? (
            <Link
              href={productUrl}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
            >
              <Eye className="size-3.5" />
              <span>View</span>
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || isAddingToCart}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98]",
                isOutOfStock
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-label={isOutOfStock ? "Out of stock" : "Add to cart"}
            >
              {isAddingToCart ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="size-3.5" />
                  <span className="hidden xs:inline">
                    {isOutOfStock ? "Sold Out" : "Add"}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
