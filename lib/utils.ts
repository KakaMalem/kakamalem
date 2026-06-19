import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getCurrencyMeta, DEFAULT_CURRENCY } from "@/lib/currency/currencies";
import { parseDate } from "@/lib/utils/safe-date";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price in the given store currency.
 *
 * Uses the per-currency metadata (symbol, position, decimals) from
 * lib/currency/currencies.ts so the symbol and grouping are consistent
 * everywhere. Unknown/empty currencies fall back to the platform default.
 */
export function formatPrice(
  price: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const meta = getCurrencyMeta(currency);
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(price);

  return meta.symbolPosition === "before"
    ? `${meta.symbol}${amount}`
    : `${amount} ${meta.symbol}`;
}

/**
 * Format a date string for display
 * Format: "Jan 15, 2024 at 3:30 PM"
 */
export function formatDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
