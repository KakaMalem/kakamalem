"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAmountButtonsProps {
  total: number;
  currency: string;
  onSelect: (amount: number) => void;
  selectedAmount?: number;
  className?: string;
}

// Generate common cash denominations based on total
function getQuickAmounts(total: number): number[] {
  if (total <= 0) return [];

  // Round up to nearest convenient amounts
  const amounts: number[] = [];

  // Exact amount
  amounts.push(total);

  // Common rounding targets
  const roundTargets = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

  for (const target of roundTargets) {
    const rounded = Math.ceil(total / target) * target;
    if (rounded > total && rounded <= total * 3 && !amounts.includes(rounded)) {
      amounts.push(rounded);
    }
    if (amounts.length >= 6) break;
  }

  return amounts.sort((a, b) => a - b).slice(0, 6);
}

export function QuickAmountButtons({
  total,
  currency,
  onSelect,
  selectedAmount,
  className,
}: QuickAmountButtonsProps) {
  const amounts = getQuickAmounts(total);

  if (amounts.length === 0) return null;

  const formatAmount = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {amounts.map((amount) => {
        const isExact = amount === total;
        const isSelected = selectedAmount === amount;
        return (
          <Button
            key={amount}
            type="button"
            variant={isSelected ? "default" : isExact ? "secondary" : "outline"}
            className={cn(
              "h-12 text-sm font-medium",
              isExact && !isSelected && "border-primary/50 bg-primary/5"
            )}
            onClick={() => onSelect(amount)}
          >
            {isExact ? "Exact" : formatAmount(amount)}
            {!isExact && (
              <span className="ml-1 text-xs opacity-70">{currency}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
