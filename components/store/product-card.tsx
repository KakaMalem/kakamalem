"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Plus, Heart, Star } from "lucide-react";

import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDisplayPrices } from "@/lib/utils/pricing-display";

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
  storeSlug: string;
  currency: string;
  className?: string;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  isInWishlist?: boolean;
  isAddingToCart?: boolean;
  /** When true, hides add-to-cart button (catalog/showcase mode) */
  catalogMode?: boolean;
}

export function ProductCard({
  product,
  storeSlug,
  currency,
  className,
  onAddToCart,
  onToggleWishlist,
  isInWishlist = false,
  isAddingToCart = false,
  catalogMode = false,
}: ProductCardProps) {
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
      // If no callback provided, navigate to product page
      window.location.href = `/store/${storeSlug}/product/${product.slug}`;
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(product.id);
    }
  };

  return (
    <Card
      className={cn(
        "group relative w-full overflow-hidden border-0 shadow-sm bg-card rounded-xl flex flex-col transition-shadow duration-200 hover:shadow-md p-0 gap-0",
        className
      )}
    >
      {/* Image Container */}
      <Link
        href={`/store/${storeSlug}/product/${product.slug}`}
        className="block"
      >
        <div className="relative aspect-4/5 overflow-hidden bg-linear-to-br from-muted to-muted/50">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText || product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ShoppingBag className="size-16 text-muted-foreground/15" />
            </div>
          )}

          {/* Top Left Badges Stack */}
          <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
            {product.isNew && (
              <Badge className="bg-emerald-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                NEW
              </Badge>
            )}
            {product.showStock && isLowStock && !isOutOfStock && (
              <Badge className="bg-amber-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                Low Stock
              </Badge>
            )}
            {isOutOfStock && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
                Sold Out
              </Badge>
            )}
          </div>

          {/* Discount Badge - Top Right */}
          {hasDiscount && discountPercent && (
            <Badge className="absolute right-1.5 top-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{discountPercent}%
            </Badge>
          )}

          {/* Wishlist Button - Bottom Right on Image */}
          {onToggleWishlist && (
            <button
              className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-95 transition-transform"
              onClick={handleToggleWishlist}
              aria-label={
                isInWishlist ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5",
                  isInWishlist ? "fill-red-500 text-red-500" : "text-gray-600"
                )}
              />
            </button>
          )}
        </div>
      </Link>

      {/* Content - Flex grow to push button to bottom */}
      <div className="p-2.5 flex flex-col flex-1">
        {/* Price Row - Most important info first */}
        <div className="flex items-baseline gap-1.5">
          {product.hasVariants && (
            <span className="text-[10px] font-medium text-muted-foreground">
              From
            </span>
          )}
          <span className="text-base font-bold text-foreground">
            {formatPrice(price, currency)}
          </span>
          {hasDiscount && compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(compareAtPrice, currency)}
            </span>
          )}
        </div>

        {/* Product Name - 2 lines max */}
        <h3 className="text-xs font-medium text-foreground leading-tight line-clamp-2 min-h-8 mt-1.5">
          {product.name}
        </h3>

        {/* Social Proof Row - Rating + Review Count */}
        {product.rating && product.rating > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5">
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
            </div>
            {product.reviewCount && product.reviewCount > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span>{product.reviewCount} reviews</span>
              </>
            )}
          </div>
        )}

        {/* Stock Indicator (compact) - only show if showStock is enabled */}
        {product.showStock &&
          !isOutOfStock &&
          product.trackInventory &&
          product.stock <= 10 && (
            <div className="flex items-center mt-1.5">
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Only {product.stock} left
              </span>
            </div>
          )}

        {/* Spacer to push button to bottom */}
        <div className="flex-1 min-h-1" />

        {/* Quick Add Button - Anchored at bottom */}
        {catalogMode ? (
          <Link
            href={`/store/${storeSlug}/product/${product.slug}`}
            className="w-full h-8 mt-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-all bg-primary text-primary-foreground active:scale-[0.98]"
          >
            <span>View Details</span>
          </Link>
        ) : (
          <button
            className={cn(
              "w-full h-8 mt-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-all",
              isOutOfStock || isAddingToCart
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground active:scale-[0.98]"
            )}
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAddingToCart}
            aria-label={isOutOfStock ? "Out of stock" : "Add to cart"}
          >
            {!isOutOfStock && (
              <Plus
                className={cn("w-3.5 h-3.5", isAddingToCart && "animate-spin")}
              />
            )}
            <span>
              {isOutOfStock
                ? "Out of Stock"
                : isAddingToCart
                  ? "Adding..."
                  : "Add to Cart"}
            </span>
          </button>
        )}
      </div>
    </Card>
  );
}
