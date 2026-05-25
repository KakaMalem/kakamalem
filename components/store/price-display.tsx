"use client";

/**
 * Price Display Component
 *
 * AFN-only price formatting. Single-currency platform; no conversion.
 */

import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  strikethrough?: boolean;
  /** Kept for API compatibility; ignored in single-currency mode */
  showOriginal?: boolean;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg font-semibold",
} as const;

export function PriceDisplay({
  price,
  className,
  size = "md",
  strikethrough = false,
}: PriceDisplayProps) {
  return (
    <span
      className={cn(
        sizeClasses[size],
        strikethrough && "line-through text-muted-foreground",
        className
      )}
    >
      {formatPrice(price)}
    </span>
  );
}

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
  if (minPrice === maxPrice) {
    return <PriceDisplay price={minPrice} className={className} size={size} />;
  }

  return (
    <span className={cn(sizeClasses[size], className)}>
      {formatPrice(minPrice)} - {formatPrice(maxPrice)}
    </span>
  );
}

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
  const discount = Math.round(
    ((originalPrice - salePrice) / originalPrice) * 100
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn(sizeClasses[size], "font-semibold text-red-600")}>
        {formatPrice(salePrice)}
      </span>
      <span
        className={cn(
          sizeClasses[size],
          "line-through text-muted-foreground text-sm"
        )}
      >
        {formatPrice(originalPrice)}
      </span>
      {discount > 0 && (
        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
          -{discount}%
        </span>
      )}
    </div>
  );
}

interface ApproximatePriceProps {
  price: number;
  className?: string;
}

export function ApproximatePrice({ price, className }: ApproximatePriceProps) {
  return <span className={className}>{formatPrice(price)}</span>;
}
