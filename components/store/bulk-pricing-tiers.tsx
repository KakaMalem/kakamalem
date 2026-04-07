"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import type { PriceTier } from "@/lib/db/schema";

interface BulkPricingTiersProps {
  tiers: PriceTier[];
  basePrice: number;
  currency: string;
  quantity: number;
  onQuantityChange?: (quantity: number) => void;
  className?: string;
}

export function BulkPricingTiers({
  tiers,
  basePrice,
  currency: _currency,
  quantity,
  onQuantityChange,
  className,
}: BulkPricingTiersProps) {
  const { format: formatPrice } = useCurrencyStore();

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [tiers]
  );

  const applicableTierId = useMemo(() => {
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      const tier = sortedTiers[i];
      if (quantity >= tier.minQuantity) {
        if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
          return tier.id;
        }
      }
    }
    return null;
  }, [sortedTiers, quantity]);

  if (sortedTiers.length === 0) return null;

  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{
        gridTemplateColumns: `repeat(${sortedTiers.length}, minmax(0, 1fr))`,
      }}
    >
      {sortedTiers.map((tier) => {
        const tierPrice = parseFloat(tier.price);
        const savingsPercent = Math.round(
          ((basePrice - tierPrice) / basePrice) * 100
        );
        const isActive = applicableTierId === tier.id;
        const rangeLabel =
          tier.maxQuantity === null
            ? `\u2265${tier.minQuantity}`
            : `${tier.minQuantity}-${tier.maxQuantity}`;

        return (
          <button
            key={tier.id}
            type="button"
            onClick={() => onQuantityChange?.(tier.minQuantity)}
            disabled={!onQuantityChange}
            className={cn(
              "relative flex flex-col items-center rounded-lg border px-2 py-2.5 text-center transition-colors",
              isActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/40",
              onQuantityChange && "cursor-pointer"
            )}
          >
            <span
              className={cn(
                "text-sm sm:text-base font-bold leading-tight",
                isActive ? "text-primary" : "text-foreground"
              )}
            >
              {formatPrice(tierPrice)}
            </span>
            <span className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground leading-tight">
              {rangeLabel} pcs
            </span>
            {savingsPercent > 0 && (
              <span
                className={cn(
                  "mt-1 text-[10px] font-medium leading-tight",
                  isActive ? "text-primary" : "text-emerald-600"
                )}
              >
                {savingsPercent}% off
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
