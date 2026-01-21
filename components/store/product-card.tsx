"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  ShoppingCart,
  Heart,
  Star,
  Loader2,
  Eye,
} from "lucide-react";

import { cn, formatPrice } from "@/lib/utils";
import { getDisplayPrices } from "@/lib/utils/pricing-display";
import { useWishlist } from "@/lib/hooks/use-wishlist";

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
  /** Initial wishlist state from server */
  initialIsInWishlist?: boolean;
  /** When true, hides add-to-cart button (catalog/showcase mode) */
  catalogMode?: boolean;
}

export function ProductCard({
  product,
  tenantId,
  storeSlug,
  currency,
  className,
  onAddToCart,
  isAddingToCart = false,
  initialIsInWishlist = false,
  catalogMode = false,
}: ProductCardProps) {
  // Wishlist state with optimistic updates
  const {
    isInWishlist,
    toggleWishlist,
    isPending: isWishlistPending,
  } = useWishlist({
    tenantId,
    productId: product.id,
    initialState: initialIsInWishlist,
  });

  const isOutOfStock = product.trackInventory && product.stock <= 0;
  const isLowStock =
    product.trackInventory && product.stock > 0 && product.stock <= 5;

  // Use centralized pricing utility
  const { price, compareAtPrice, discountPercent, hasDiscount } =
    getDisplayPrices(product.price, product.compareAtPrice ?? null);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    if (onAddToCart) {
      onAddToCart(product.id);
    } else {
      window.location.href = `/store/${storeSlug}/product/${product.slug}`;
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist();
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-background",
        "shadow-sm transition-shadow duration-300 hover:shadow-md",
        className
      )}
    >
      {/* Image Container */}
      <Link
        href={`/store/${storeSlug}/product/${product.slug}`}
        className="relative aspect-4/5 overflow-hidden bg-muted/30"
      >
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.altText || product.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="size-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Left badges - NEW, Low Stock, Sold Out */}
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {product.isNew && (
            <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              NEW
            </span>
          )}
          {isLowStock && !isOutOfStock && product.showStock && (
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Low Stock
            </span>
          )}
          {isOutOfStock && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Sold Out
            </span>
          )}
        </div>

        {/* Right badge - Discount */}
        {hasDiscount && discountPercent && (
          <span className="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            -{discountPercent}%
          </span>
        )}
      </Link>

      {/* Content - Price first layout like hero mockup */}
      <div className="flex flex-1 flex-col p-2.5">
        {/* Price Row */}
        <div className="flex items-baseline gap-1.5">
          {product.hasVariants && (
            <span className="text-[10px] text-muted-foreground">From</span>
          )}
          <span className="text-sm font-bold">
            {formatPrice(price, currency)}
          </span>
          {hasDiscount && compareAtPrice && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatPrice(compareAtPrice, currency)}
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-snug">
          <Link
            href={`/store/${storeSlug}/product/${product.slug}`}
            className="hover:text-foreground transition-colors"
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
        <div className="flex-1 min-h-1" />

        {/* Action Buttons */}
        <div className="mt-2 flex gap-1.5">
          {/* Wishlist Button */}
          <button
            onClick={handleToggleWishlist}
            disabled={isWishlistPending}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95",
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
              href={`/store/${storeSlug}/product/${product.slug}`}
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
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98]",
                isOutOfStock
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
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
