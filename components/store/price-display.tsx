"use client";

/**
 * Price Display Component
 *
 * Displays a price converted to the customer's preferred currency.
 * Uses Zustand store for currency preference and cached exchange rates.
 * Prices are passed in the store's base currency and auto-converted.
 */

import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  /** Price in the store's base currency */
  price: number;
  /** Show original store-currency price in parentheses */
  showOriginal?: boolean;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show strikethrough (for sale prices) */
  strikethrough?: boolean;
}

export function PriceDisplay({
  price,
  showOriginal = false,
  className,
  size = "md",
  strikethrough = false,
}: PriceDisplayProps) {
  const { format } = useCurrencyStore();

  const formattedPrice = format(price, showOriginal);

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg font-semibold",
  };

  return (
    <span
      className={cn(
        sizeClasses[size],
        strikethrough && "line-through text-muted-foreground",
        className
      )}
    >
      {formattedPrice}
    </span>
  );
}

/**
 * Price range display (min - max)
 */
interface PriceRangeProps {
  minPrice: number;
  maxPrice: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PriceRange({
  minPrice,
  maxPrice,
  className,
  size = "md",
}: PriceRangeProps) {
  const { format } = useCurrencyStore();

  // If min and max are the same, just show one price
  if (minPrice === maxPrice) {
    return <PriceDisplay price={minPrice} className={className} size={size} />;
  }

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg font-semibold",
  };

  return (
    <span className={cn(sizeClasses[size], className)}>
      {format(minPrice)} - {format(maxPrice)}
    </span>
  );
}

/**
 * Sale price display with original and discounted price
 */
interface SalePriceProps {
  originalPrice: number;
  salePrice: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SalePrice({
  originalPrice,
  salePrice,
  className,
  size = "md",
}: SalePriceProps) {
  const { format } = useCurrencyStore();

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const discount = Math.round(
    ((originalPrice - salePrice) / originalPrice) * 100
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn(sizeClasses[size], "font-semibold text-red-600")}>
        {format(salePrice)}
      </span>
      <span
        className={cn(
          sizeClasses[size],
          "line-through text-muted-foreground text-sm"
        )}
      >
        {format(originalPrice)}
      </span>
      {discount > 0 && (
        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
          -{discount}%
        </span>
      )}
    </div>
  );
}

/**
 * Approximate price indicator
 * Used when showing converted prices to indicate the amount is approximate
 */
interface ApproximatePriceProps {
  price: number;
  className?: string;
}

export function ApproximatePrice({ price, className }: ApproximatePriceProps) {
  const { currency, storeCurrency, format } = useCurrencyStore();

  // Don't show approximate indicator when displaying in store currency
  if (currency === storeCurrency) {
    return <span className={className}>{format(price)}</span>;
  }

  return (
    <span className={cn("text-muted-foreground", className)}>
      ≈ {format(price)}
    </span>
  );
}
