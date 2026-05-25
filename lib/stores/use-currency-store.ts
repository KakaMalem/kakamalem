/**
 * Currency Store (AFN-only shim)
 *
 * The platform is single-currency (AFN). This module exists to preserve the
 * existing call sites that read `format`, `currency`, `storeCurrency`, etc.
 * Everything resolves to AFN.
 *
 * If we ever want multi-currency back, restore from the `crypto-baseline` tag.
 */

import { formatPrice } from "@/lib/utils";

interface CurrencyState {
  currency: "AFN";
  currencySource: "auto";
  storeCurrency: "AFN";
  rates: Record<string, number>;
  ratesUpdatedAt: Date | null;
  isLoading: false;
  error: null;

  setCurrency: (currency: "AFN") => void;
  setCurrencyPreference: (preference: "auto" | "AFN") => void;
  setStoreCurrency: (currency: string) => void;
  setRates: (rates: Record<string, number>) => void;
  fetchRates: () => Promise<void>;

  convert: (amount: number) => number;
  format: (amount: number, showOriginal?: boolean) => string;
  formatDirect: (amount: number, currency?: string) => string;
}

const noop = () => {};

export const useCurrencyStore = (): CurrencyState => ({
  currency: "AFN",
  currencySource: "auto",
  storeCurrency: "AFN",
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
  format: (amount) => formatPrice(amount),
  formatDirect: (amount) => formatPrice(amount),
});
