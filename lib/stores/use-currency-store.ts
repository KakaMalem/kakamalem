/**
 * Currency Store (Zustand)
 *
 * Client-side state for currency preferences and conversion.
 * Persists user's preferred currency in localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type SupportedCurrency,
  supportedCurrencies,
  currencyInfo,
} from "@/lib/currency/country-currency";

type ExchangeRates = Record<string, number>;

interface CurrencyState {
  // Current display currency
  currency: SupportedCurrency;

  // Cached exchange rates
  rates: ExchangeRates;
  ratesUpdatedAt: Date | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrency: (currency: SupportedCurrency) => void;
  setRates: (rates: ExchangeRates) => void;
  fetchRates: () => Promise<void>;

  // Conversion helpers
  convert: (amountAFN: number) => number;
  format: (amountAFN: number, showOriginal?: boolean) => string;
  formatDirect: (amount: number, currency?: string) => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: "AFN",
      rates: {},
      ratesUpdatedAt: null,
      isLoading: false,
      error: null,

      setCurrency: (currency) => {
        if (supportedCurrencies.includes(currency)) {
          set({ currency });
        }
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

      convert: (amountAFN) => {
        const { currency, rates } = get();

        if (currency === "AFN") {
          return amountAFN;
        }

        const rate = rates[currency];
        if (!rate) {
          return amountAFN; // Fallback to original amount
        }

        return amountAFN * rate;
      },

      format: (amountAFN, showOriginal = false) => {
        const { currency, convert } = get();
        const converted = convert(amountAFN);

        const info = currencyInfo[currency];
        const decimals = info?.decimals ?? 2;

        // Format the converted amount
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(converted);

        // Optionally show original AFN amount
        if (showOriginal && currency !== "AFN") {
          const afnFormatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "AFN",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amountAFN);
          return `${formatted} (${afnFormatted})`;
        }

        return formatted;
      },

      formatDirect: (amount, currency) => {
        const curr = currency || get().currency;
        const info = currencyInfo[curr as SupportedCurrency];
        const decimals = info?.decimals ?? 2;

        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: curr,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(amount);
      },
    }),
    {
      name: "currency-preference",
      partialize: (state) => ({
        currency: state.currency,
        rates: state.rates,
        ratesUpdatedAt: state.ratesUpdatedAt,
      }),
    }
  )
);

/**
 * Hook to initialize currency from server-detected location.
 * Call this in the storefront layout.
 */
export function useInitializeCurrency(detectedCurrency?: string) {
  const { setCurrency, fetchRates, currency } = useCurrencyStore();

  // Initialize currency on first load if detected
  if (
    detectedCurrency &&
    supportedCurrencies.includes(detectedCurrency as SupportedCurrency) &&
    currency === "AFN" // Only set if user hasn't chosen a currency yet
  ) {
    setCurrency(detectedCurrency as SupportedCurrency);
  }

  // Fetch rates on mount
  fetchRates();
}
