/**
 * Currency metadata — single source of truth for the per-store base currency.
 *
 * The platform is single-currency *per store*: each tenant picks one base
 * currency and every price (storefront, dashboard, receipts, invoices) is
 * displayed in it. There is no live FX conversion between currencies.
 *
 * `currencyOptions` in lib/validations/stores.ts is the canonical list of
 * allowed codes; this module attaches display metadata to each.
 */

export interface CurrencyMeta {
  /** ISO 4217 code, e.g. "AFN" */
  code: string;
  /** Human label for selects, e.g. "Afghan Afghani" */
  label: string;
  /** Symbol used in storefront price formatting, e.g. "؋", "$" */
  symbol: string;
  /** Where the symbol sits relative to the number */
  symbolPosition: "before" | "after";
  /** Decimal places to show (AFN/PKR commonly shown as whole numbers) */
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyMeta> = {
  AFN: {
    code: "AFN",
    label: "Afghan Afghani",
    symbol: "؋",
    symbolPosition: "before",
    decimals: 0,
  },
  USD: {
    code: "USD",
    label: "US Dollar",
    symbol: "$",
    symbolPosition: "before",
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    label: "Euro",
    symbol: "€",
    symbolPosition: "before",
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    label: "British Pound",
    symbol: "£",
    symbolPosition: "before",
    decimals: 2,
  },
  AED: {
    code: "AED",
    label: "UAE Dirham",
    symbol: "د.إ",
    symbolPosition: "before",
    decimals: 2,
  },
  SAR: {
    code: "SAR",
    label: "Saudi Riyal",
    symbol: "﷼",
    symbolPosition: "before",
    decimals: 2,
  },
  PKR: {
    code: "PKR",
    label: "Pakistani Rupee",
    symbol: "₨",
    symbolPosition: "before",
    decimals: 0,
  },
  INR: {
    code: "INR",
    label: "Indian Rupee",
    symbol: "₹",
    symbolPosition: "before",
    decimals: 2,
  },
  TRY: {
    code: "TRY",
    label: "Turkish Lira",
    symbol: "₺",
    symbolPosition: "before",
    decimals: 2,
  },
  CAD: {
    code: "CAD",
    label: "Canadian Dollar",
    symbol: "CA$",
    symbolPosition: "before",
    decimals: 2,
  },
  AUD: {
    code: "AUD",
    label: "Australian Dollar",
    symbol: "A$",
    symbolPosition: "before",
    decimals: 2,
  },
};

/** Default base currency for new stores. */
export const DEFAULT_CURRENCY = "AFN";

/** Resolve metadata for a code, falling back to AFN for unknown/empty input. */
export function getCurrencyMeta(code: string | null | undefined): CurrencyMeta {
  if (!code) return CURRENCIES[DEFAULT_CURRENCY];
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}
