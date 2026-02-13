"use client";

/**
 * Currency Initializer
 *
 * Invisible client component that:
 * 1. Sets the store's base currency in the Zustand store
 * 2. Auto-detects customer currency from browser locale on first visit
 * 3. Fetches exchange rates
 *
 * Place this in the storefront layout.
 */

import { useEffect } from "react";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  getCurrencyForCountry,
  isSupportedCurrency,
  type SupportedCurrency,
} from "@/lib/currency/country-currency";

interface CurrencyInitializerProps {
  /** The store's base/pricing currency (e.g. "AFN", "USD") */
  storeCurrency: string;
}

export function CurrencyInitializer({
  storeCurrency,
}: CurrencyInitializerProps) {
  const { setStoreCurrency, setCurrency, fetchRates, currencySource } =
    useCurrencyStore();

  useEffect(() => {
    // Always set the store's base currency
    setStoreCurrency(storeCurrency);

    // Only auto-detect if user hasn't manually chosen a currency
    if (currencySource === "auto") {
      // Auto-detect customer currency from browser locale
      // navigator.language returns e.g. "fa-AF", "en-US", "de-DE"
      const locale = navigator.language || "";
      const parts = locale.split("-");
      const countryCode =
        parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;

      if (countryCode) {
        const detectedCurrency = getCurrencyForCountry(countryCode);

        if (detectedCurrency && isSupportedCurrency(detectedCurrency)) {
          setCurrency(detectedCurrency as SupportedCurrency);
        } else {
          // Fallback: use the store's currency
          if (isSupportedCurrency(storeCurrency)) {
            setCurrency(storeCurrency as SupportedCurrency);
          }
        }
      } else {
        // No country code in locale, use store's currency
        if (isSupportedCurrency(storeCurrency)) {
          setCurrency(storeCurrency as SupportedCurrency);
        }
      }
    }

    // Fetch exchange rates
    fetchRates();
  }, [storeCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
