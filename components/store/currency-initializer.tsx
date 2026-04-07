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
  getCountryFromTimezone,
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

    // USDT/crypto stores: no multi-currency, no rate fetching needed
    if (storeCurrency === "USDT" || storeCurrency === "USDC") {
      setCurrency(storeCurrency as SupportedCurrency);
      return;
    }

    // Legacy fiat stores: auto-detect customer currency and fetch rates
    if (currencySource === "auto") {
      let detectedCurrency: string | null = null;

      // 1. Try timezone (most reliable — reflects physical location)
      const tzCountry = getCountryFromTimezone();
      if (tzCountry) {
        detectedCurrency = getCurrencyForCountry(tzCountry);
      }

      // 2. Fallback: try navigator.language country code (e.g. "fa-AF" → "AF")
      if (!detectedCurrency || !isSupportedCurrency(detectedCurrency)) {
        const locale = navigator.language || "";
        const parts = locale.split("-");
        const countryCode =
          parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
        if (countryCode) {
          detectedCurrency = getCurrencyForCountry(countryCode);
        }
      }

      // 3. Apply detected currency or fall back to store currency
      if (detectedCurrency && isSupportedCurrency(detectedCurrency)) {
        setCurrency(detectedCurrency as SupportedCurrency);
      } else if (isSupportedCurrency(storeCurrency)) {
        setCurrency(storeCurrency as SupportedCurrency);
      }
    }

    // Fetch exchange rates (legacy fiat stores only)
    fetchRates();
  }, [storeCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
