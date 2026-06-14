"use client";

/**
 * Currency context for the storefront.
 *
 * Each store has one base currency (tenants.currency). The storefront is
 * wrapped in <CurrencyProvider currency={store.currency}> and every price
 * component reads it through useCurrencyStore().format(amount).
 *
 * There is no customer-side FX conversion: `currency` and `storeCurrency`
 * are the same value, `convert` is a passthrough, and `rates` is empty.
 * The shape is kept identical to the historical multi-currency store so the
 * ~20 existing call sites don't need to change.
 */

import { createContext, useContext, useMemo } from "react";
import { formatPrice } from "@/lib/utils";
import { DEFAULT_CURRENCY } from "@/lib/currency/currencies";

interface CurrencyState {
  /** Active display currency (same as storeCurrency — no customer override) */
  currency: string;
  currencySource: "store";
  /** The store's configured base currency */
  storeCurrency: string;
  rates: Record<string, number>;
  ratesUpdatedAt: Date | null;
  isLoading: false;
  error: null;

  setCurrency: (currency: string) => void;
  setCurrencyPreference: (preference: "auto" | string) => void;
  setStoreCurrency: (currency: string) => void;
  setRates: (rates: Record<string, number>) => void;
  fetchRates: () => Promise<void>;

  convert: (amount: number) => number;
  format: (amount: number, showOriginal?: boolean) => string;
  formatDirect: (amount: number, currency?: string) => string;
}

const noop = () => {};

function buildState(currency: string): CurrencyState {
  const resolved = currency || DEFAULT_CURRENCY;
  return {
    currency: resolved,
    currencySource: "store",
    storeCurrency: resolved,
    rates: {},
    ratesUpdatedAt: null,
    isLoading: false,
    error: null,

    setCurrency: noop,
    setCurrencyPreference: noop,
    setStoreCurrency: noop,
    setRates: noop,
    fetchRates: async () => {},

    convert: (amount) => amount,
    format: (amount) => formatPrice(amount, resolved),
    formatDirect: (amount, overrideCurrency) =>
      formatPrice(amount, overrideCurrency || resolved),
  };
}

const CurrencyContext = createContext<CurrencyState>(
  buildState(DEFAULT_CURRENCY)
);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => buildState(currency), [currency]);
  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Read the active store currency + formatters. Falls back to the platform
 * default if used outside a CurrencyProvider (defensive — shouldn't happen
 * inside the storefront).
 */
export function useCurrencyStore(): CurrencyState {
  return useContext(CurrencyContext);
}
