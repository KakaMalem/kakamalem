/**
 * Currency Store (Zustand)
 *
 * Client-side state for currency preferences and conversion.
 * Persists user's preferred currency in localStorage.
 * Supports any store base currency (AFN, USD, etc.) with cross-rate conversion.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type SupportedCurrency,
  supportedCurrencies,
  currencyInfo,
} from "@/lib/currency/country-currency";

type ExchangeRates = Record<string, number>;

/**
 * Non-ISO currencies that Intl.NumberFormat can't handle.
 * These are formatted manually with symbol + number.
 */
const NON_ISO_CURRENCIES = new Set(["USDT", "USDC"]);

/**
 * Format an amount with the correct currency symbol.
 * Uses Intl.NumberFormat for standard ISO currencies, manual formatting for crypto.
 */
function formatWithCurrency(
  amount: number,
  currencyCode: string,
  decimals: number
): string {
  if (NON_ISO_CURRENCIES.has(currencyCode)) {
    const info = currencyInfo[currencyCode as SupportedCurrency];
    const symbol = info?.symbol ?? currencyCode;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
    return `${symbol}${formatted}`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  // Replace ISO code with symbol if Intl didn't use narrow symbol (e.g. "AFN" → "؋")
  const info = currencyInfo[currencyCode as SupportedCurrency];
  if (
    info &&
    info.symbol !== currencyCode &&
    formatted.includes(currencyCode)
  ) {
    return formatted.replace(currencyCode, info.symbol);
  }
  return formatted;
}

interface CurrencyState {
  // Customer's display currency
  currency: SupportedCurrency;

  // Whether currency was auto-detected or manually chosen
  // "auto" = system default (detect from browser locale)
  // specific code = manual preference
  currencySource: "auto" | SupportedCurrency;

  // Store's base/pricing currency (set by CurrencyInitializer)
  storeCurrency: string;

  // Cached exchange rates (AFN-based: 1 AFN = X target)
  rates: ExchangeRates;
  ratesUpdatedAt: Date | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrency: (currency: SupportedCurrency) => void;
  setCurrencyPreference: (preference: "auto" | SupportedCurrency) => void;
  setStoreCurrency: (currency: string) => void;
  setRates: (rates: ExchangeRates) => void;
  fetchRates: () => Promise<void>;

  // Conversion helpers
  convert: (amount: number) => number;
  format: (amount: number, showOriginal?: boolean) => string;
  formatDirect: (amount: number, currency?: string) => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: "USDT",
      currencySource: "auto",
      storeCurrency: "USDT",
      rates: {},
      ratesUpdatedAt: null,
      isLoading: false,
      error: null,

      setCurrency: (currency) => {
        if (supportedCurrencies.includes(currency)) {
          set({ currency });
        }
      },

      setCurrencyPreference: (preference) => {
        if (preference === "auto") {
          set({ currencySource: "auto" });
          // Re-detect will happen on next CurrencyInitializer mount
        } else if (supportedCurrencies.includes(preference)) {
          set({ currencySource: preference, currency: preference });
        }
      },

      setStoreCurrency: (currency) => {
        set({ storeCurrency: currency });
      },

      setRates: (rates) => {
        set({ rates, ratesUpdatedAt: new Date(), error: null });
      },

      fetchRates: async () => {
        const { ratesUpdatedAt } = get();

        // Skip if rates are fresh (less than 1 hour old)
        if (ratesUpdatedAt) {
          const ageMs = Date.now() - new Date(ratesUpdatedAt).getTime();
          if (ageMs < 60 * 60 * 1000) {
            return;
          }
        }

        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/exchange-rates");
          if (!response.ok) {
            throw new Error("Failed to fetch exchange rates");
          }

          const data = await response.json();
          set({
            rates: data.rates,
            ratesUpdatedAt: new Date(),
            isLoading: false,
          });
        } catch (error) {
          console.error("[CurrencyStore] Failed to fetch rates:", error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },

      convert: (amount) => {
        const { currency, storeCurrency, rates } = get();

        // No conversion needed if same currency
        if (currency === storeCurrency) {
          return amount;
        }

        // Cross-rate conversion via AFN-based rates:
        // rates[X] = how much X you get for 1 AFN
        // To convert from storeCurrency to customer currency:
        //   amount_in_AFN = amount / rates[storeCurrency]  (or amount if storeCurrency is AFN)
        //   amount_in_target = amount_in_AFN * rates[currency]  (or amount_in_AFN if currency is AFN)
        const storeRate = storeCurrency === "AFN" ? 1 : rates[storeCurrency];
        const targetRate = currency === "AFN" ? 1 : rates[currency];

        if (!storeRate || !targetRate) {
          return amount; // Fallback to original amount
        }

        return amount * (targetRate / storeRate);
      },

      format: (amount, showOriginal = false) => {
        const { currency, storeCurrency, convert } = get();
        const converted = convert(amount);

        const info = currencyInfo[currency];
        const decimals = info?.decimals ?? 2;

        const formatted = formatWithCurrency(converted, currency, decimals);

        // Optionally show original amount in store currency
        if (showOriginal && currency !== storeCurrency) {
          const storeInfo = currencyInfo[storeCurrency as SupportedCurrency];
          const storeDecimals = storeInfo?.decimals ?? 2;
          const originalFormatted = formatWithCurrency(
            amount,
            storeCurrency,
            storeDecimals
          );
          return `${formatted} (${originalFormatted})`;
        }

        return formatted;
      },

      formatDirect: (amount, currency) => {
        const curr = currency || get().currency;
        const info = currencyInfo[curr as SupportedCurrency];
        const decimals = info?.decimals ?? 2;

        return formatWithCurrency(amount, curr, decimals);
      },
    }),
    {
      name: "currency-preference",
      partialize: (state) => ({
        currency: state.currency,
        currencySource: state.currencySource,
        rates: state.rates,
        ratesUpdatedAt: state.ratesUpdatedAt,
      }),
    }
  )
);
