"use client";

/**
 * Currency Selector
 *
 * Dropdown component for customers to manually change their display currency.
 * Uses Zustand store to persist preference.
 */

import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  supportedCurrencies,
  currencyInfo,
  type SupportedCurrency,
} from "@/lib/currency/country-currency";

interface CurrencySelectorProps {
  /** Compact mode for header */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

export function CurrencySelector({
  compact = false,
  className: _className,
}: CurrencySelectorProps) {
  const { currency, setCurrency, fetchRates } = useCurrencyStore();

  // Fetch rates on mount
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return (
    <Select
      value={currency}
      onValueChange={(v) => setCurrency(v as SupportedCurrency)}
    >
      <SelectTrigger className={compact ? "w-20 h-8 text-sm" : "w-32"}>
        <SelectValue>
          {compact ? currency : `${currencyInfo[currency]?.symbol} ${currency}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedCurrencies.map((curr) => {
          const info = currencyInfo[curr];
          return (
            <SelectItem key={curr} value={curr}>
              <span className="flex items-center gap-2">
                <span className="w-6 text-center">{info.symbol}</span>
                <span>{curr}</span>
                {!compact && (
                  <span className="text-muted-foreground text-sm">
                    - {info.name}
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Minimal currency selector as a button/badge for mobile or compact spaces
 */
export function CurrencyBadge({ className }: { className?: string }) {
  const { currency, setCurrency, fetchRates } = useCurrencyStore();

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Cycle through main currencies on click
  const handleClick = () => {
    const mainCurrencies: SupportedCurrency[] = ["AFN", "USD", "EUR", "AED"];
    const currentIndex = mainCurrencies.indexOf(currency);
    const nextIndex = (currentIndex + 1) % mainCurrencies.length;
    setCurrency(mainCurrencies[nextIndex]);
  };

  const info = currencyInfo[currency];

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md
        bg-muted hover:bg-muted/80 transition-colors ${className}`}
      title={`Click to change currency (${info.name})`}
    >
      <span>{info.symbol}</span>
      <span>{currency}</span>
    </button>
  );
}
