"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BillingInterval } from "@/lib/db/schema";

type BillingIntervalSelectorProps = {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  monthlyPrice: number;
  yearlyPrice: number;
  currency?: string;
  disabled?: boolean;
};

/**
 * Calculate savings percentage for yearly billing
 */
function calculateSavings(
  monthlyPrice: number,
  yearlyPrice: number
): { amount: number; percentage: number } {
  const yearlyFromMonthly = monthlyPrice * 12;
  const savingsAmount = yearlyFromMonthly - yearlyPrice;
  const savingsPercentage = Math.round(
    (savingsAmount / yearlyFromMonthly) * 100
  );
  return { amount: savingsAmount, percentage: savingsPercentage };
}

/**
 * Format price with currency
 */
function formatPrice(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return currency === "AFN" ? formatted.replace("AFN", "؋") : formatted;
}

export function BillingIntervalSelector({
  value,
  onChange,
  monthlyPrice,
  yearlyPrice,
  currency = "AFN",
  disabled = false,
}: BillingIntervalSelectorProps) {
  const savings = calculateSavings(monthlyPrice, yearlyPrice);
  const monthlyEquivalent = yearlyPrice / 12;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Billing Interval</span>
        {savings.percentage > 0 && (
          <Badge variant="secondary" className="text-xs">
            Save {savings.percentage}% yearly
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Monthly Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("monthly")}
          className={cn(
            "relative flex flex-col items-center rounded-lg border-2 p-4 transition-all",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            value === "monthly"
              ? "border-primary bg-primary/5"
              : "border-muted bg-background",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="text-sm font-medium text-muted-foreground">
            Monthly
          </span>
          <span className="mt-1 text-2xl font-bold">
            {formatPrice(monthlyPrice, currency)}
          </span>
          <span className="text-xs text-muted-foreground">per month</span>
          {value === "monthly" && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <Badge variant="default" className="text-xs">
                Selected
              </Badge>
            </div>
          )}
        </button>

        {/* Yearly Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("yearly")}
          className={cn(
            "relative flex flex-col items-center rounded-lg border-2 p-4 transition-all",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            value === "yearly"
              ? "border-primary bg-primary/5"
              : "border-muted bg-background",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {savings.percentage > 0 && (
            <div className="absolute -top-2 right-2">
              <Badge variant="destructive" className="text-xs">
                Best Value
              </Badge>
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            Yearly
          </span>
          <span className="mt-1 text-2xl font-bold">
            {formatPrice(yearlyPrice, currency)}
          </span>
          <span className="text-xs text-muted-foreground">per year</span>
          {monthlyEquivalent < monthlyPrice && (
            <span className="mt-1 text-xs text-green-600">
              {formatPrice(monthlyEquivalent, currency)}/mo
            </span>
          )}
          {value === "yearly" && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <Badge variant="default" className="text-xs">
                Selected
              </Badge>
            </div>
          )}
        </button>
      </div>

      {value === "yearly" && savings.amount > 0 && (
        <p className="text-center text-sm text-green-600">
          You save {formatPrice(savings.amount, currency)} per year!
        </p>
      )}
    </div>
  );
}
