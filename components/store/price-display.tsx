"use client";

/**
 * Price Display Component
 *
 * Displays a price converted to the customer's preferred currency.
 * Uses Zustand store for currency preference and cached exchange rates.
 */

import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  /** Price in AFN (store's base currency) */
  priceAFN: number;
  /** Show original AFN price in parentheses */
  showOriginal?: boolean;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show strikethrough (for sale prices) */
  strikethrough?: boolean;
}

export function PriceDisplay({
  priceAFN,
  showOriginal = false,
  className,
  size = "md",
  strikethrough = false,
}: PriceDisplayProps) {
  const { currency: _currency, format } = useCurrencyStore();

  const formattedPrice = format(priceAFN, showOriginal);

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
  minPriceAFN: number;
  maxPriceAFN: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PriceRange({
  minPriceAFN,
  maxPriceAFN,
  className,
  size = "md",
}: PriceRangeProps) {
  const { format } = useCurrencyStore();

  // If min and max are the same, just show one price
  if (minPriceAFN === maxPriceAFN) {
    return (
      <PriceDisplay priceAFN={minPriceAFN} className={className} size={size} />
    );
  }

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg font-semibold",
  };

  return (
    <span className={cn(sizeClasses[size], className)}>
      {format(minPriceAFN)} - {format(maxPriceAFN)}
    </span>
  );
}

/**
 * Sale price display with original and discounted price
 */
interface SalePriceProps {
  originalPriceAFN: number;
  salePriceAFN: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SalePrice({
  originalPriceAFN,
  salePriceAFN,
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
    ((originalPriceAFN - salePriceAFN) / originalPriceAFN) * 100
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn(sizeClasses[size], "font-semibold text-red-600")}>
        {format(salePriceAFN)}
      </span>
      <span
        className={cn(
          sizeClasses[size],
          "line-through text-muted-foreground text-sm"
        )}
      >
        {format(originalPriceAFN)}
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
  priceAFN: number;
  className?: string;
}

export function ApproximatePrice({
  priceAFN,
  className,
}: ApproximatePriceProps) {
  const { currency, format } = useCurrencyStore();

  // Don't show approximate indicator for AFN
  if (currency === "AFN") {
    return <span className={className}>{format(priceAFN)}</span>;
  }

  return (
    <span className={cn("text-muted-foreground", className)}>
      ≈ {format(priceAFN)}
    </span>
  );
}
