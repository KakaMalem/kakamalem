"use client";

import { useMemo } from "react";
import { Tag, TrendingDown, Zap, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  // Sort tiers by minQuantity
  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [tiers]
  );

  // Find the applicable tier for current quantity
  const applicableTier = useMemo(() => {
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

  // Find the next tier to unlock
  const nextTier = useMemo(() => {
    if (!applicableTier) {
      // No tier active yet, find first tier
      return sortedTiers[0] ?? null;
    }

    const currentIndex = sortedTiers.findIndex(
      (t) => t.id === applicableTier.id
    );
    if (currentIndex < sortedTiers.length - 1) {
      return sortedTiers[currentIndex + 1];
    }
    return null;
  }, [sortedTiers, applicableTier]);

  // Calculate units needed for next tier
  const unitsToNextTier = nextTier ? nextTier.minQuantity - quantity : 0;

  // Calculate progress to next tier (as percentage)
  const progressToNextTier = useMemo(() => {
    if (!nextTier) return 100; // Already at max tier
    if (!applicableTier) {
      // Progress towards first tier
      return Math.min((quantity / nextTier.minQuantity) * 100, 100);
    }
    const prevMin = applicableTier.minQuantity;
    const nextMin = nextTier.minQuantity;
    const range = nextMin - prevMin;
    const progress = ((quantity - prevMin) / range) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, [quantity, applicableTier, nextTier]);

  // Calculate maximum potential savings (at highest tier)
  const maxSavingsPercent = useMemo(() => {
    if (sortedTiers.length === 0) return 0;
    const highestTier = sortedTiers[sortedTiers.length - 1];
    const tierPrice = parseFloat(highestTier.price);
    return Math.round(((basePrice - tierPrice) / basePrice) * 100);
  }, [sortedTiers, basePrice]);

  // Handle tier quick-select
  const handleTierClick = (tier: PriceTier) => {
    if (onQuantityChange) {
      onQuantityChange(tier.minQuantity);
    }
  };

  if (sortedTiers.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-linear-to-br from-background to-muted/30 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 sm:px-5 sm:py-4 bg-linear-to-r from-primary/5 to-primary/10 border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 sm:size-9 rounded-xl bg-primary/10">
              <Tag className="size-4 sm:size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold">
                Volume Discounts
              </h3>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Save up to {maxSavingsPercent}% on bulk orders
              </p>
            </div>
          </div>
          {applicableTier && (
            <Badge className="bg-green-600/90 hover:bg-green-600 text-white text-xs px-2 py-0.5">
              <Sparkles className="size-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Next Tier Progress */}
      {nextTier && unitsToNextTier > 0 && (
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-amber-500/5 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-amber-700">
              <Zap className="size-4" />
              <span className="text-xs sm:text-sm font-medium">
                Add {unitsToNextTier} more for{" "}
                {formatPrice(parseFloat(nextTier.price))}/unit
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-500/10"
              onClick={() => handleTierClick(nextTier)}
            >
              Unlock
              <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressToNextTier}%` }}
            />
          </div>
        </div>
      )}

      {/* Tier List */}
      <div className="p-3 sm:p-4 space-y-2">
        {sortedTiers.map((tier, index) => {
          const tierPrice = parseFloat(tier.price);
          const savingsPercent = Math.round(
            ((basePrice - tierPrice) / basePrice) * 100
          );
          const isActive = applicableTier?.id === tier.id;
          const isUnlocked = quantity >= tier.minQuantity;
          const isNext = nextTier?.id === tier.id;

          return (
            <button
              key={tier.id}
              onClick={() => handleTierClick(tier)}
              disabled={!onQuantityChange}
              className={cn(
                "w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl text-left transition-all duration-200",
                isActive
                  ? "bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                  : isNext
                    ? "bg-amber-500/5 ring-1 ring-amber-500/20 hover:ring-amber-500/40"
                    : isUnlocked
                      ? "bg-muted/50 hover:bg-muted/70"
                      : "bg-muted/20 hover:bg-muted/40",
                onQuantityChange &&
                  "cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              )}
              aria-label={`${tier.minQuantity}${tier.maxQuantity === null ? "+" : `-${tier.maxQuantity}`} units at ${formatPrice(tierPrice)} per unit, ${savingsPercent}% discount${isActive ? ", currently active" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Tier indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center size-8 sm:size-9 rounded-lg shrink-0 font-semibold text-xs sm:text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isUnlocked
                        ? "bg-green-600/20 text-green-700"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>

                {/* Quantity range */}
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-sm sm:text-base font-medium truncate",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {tier.maxQuantity === null
                      ? `${tier.minQuantity}+ units`
                      : `${tier.minQuantity}–${tier.maxQuantity} units`}
                  </div>
                  {isActive && (
                    <div className="text-xs text-primary/70">
                      Your current tier
                    </div>
                  )}
                  {isNext && !isActive && (
                    <div className="text-xs text-amber-600">
                      {unitsToNextTier} more to unlock
                    </div>
                  )}
                </div>
              </div>

              {/* Price and savings */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-right">
                  <div
                    className={cn(
                      "text-sm sm:text-base font-semibold",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {formatPrice(tierPrice)}
                  </div>
                  <div className="text-xs text-muted-foreground">per unit</div>
                </div>
                {savingsPercent > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs px-2 py-0.5 shrink-0",
                      isActive
                        ? "bg-green-600 text-white hover:bg-green-600"
                        : "bg-green-100 text-green-700 hover:bg-green-100"
                    )}
                  >
                    <TrendingDown className="size-3 mr-0.5" />
                    {savingsPercent}%
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      {applicableTier && !nextTier && (
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-green-500/5 border-t border-border/50">
          <div className="flex items-center gap-2 text-green-700">
            <Sparkles className="size-4" />
            <span className="text-xs sm:text-sm font-medium">
              Maximum discount unlocked!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
