import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price with currency symbol.
 * Defaults to AFN; supports any ISO currency code.
 */
export function formatPrice(price: number, currency: string = "AFN"): string {
  if (currency === "AFN") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AFN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace("AFN", "؋");
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);
}

/**
 * Format a date string for display
 * Format: "Jan 15, 2024 at 3:30 PM"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
