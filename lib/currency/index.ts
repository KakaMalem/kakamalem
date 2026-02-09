/**
 * Currency Service
 *
 * Handles exchange rate fetching, caching, and currency conversion.
 * Uses Fawaz Ahmed's free currency API (supports AFN).
 *
 * API: https://github.com/fawazahmed0/exchange-api
 */

import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { supportedCurrencies } from "./country-currency";

// Base currency for the platform
export const BASE_CURRENCY = "AFN";

// Cache duration in hours
const CACHE_DURATION_HOURS = 6;

// Fawaz Ahmed Currency API base URL
const CURRENCY_API_BASE =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1";

export type ExchangeRates = Record<string, number>;

/**
 * Fetch fresh exchange rates from the Fawaz Ahmed Currency API.
 * Uses USD as intermediary since AFN rates might not be directly available.
 */
async function fetchFreshRates(): Promise<ExchangeRates> {
  try {
    // Fetch USD-based rates (AFN is available in this API)
    const response = await fetch(`${CURRENCY_API_BASE}/currencies/usd.json`, {
      next: { revalidate: CACHE_DURATION_HOURS * 60 * 60 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.status}`);
    }

    const data = await response.json();
    const usdRates = data.usd;

    if (!usdRates || !usdRates.afn) {
      throw new Error("AFN rate not found in API response");
    }

    // Calculate rates from AFN to other currencies
    // If 1 USD = X AFN, then 1 AFN = 1/X USD
    // Then 1 AFN = (1/X) * Y for currency Y where 1 USD = Y
    const afnToUsd = 1 / usdRates.afn; // ~0.011 (1 AFN ≈ 0.011 USD)

    const rates: ExchangeRates = {};

    for (const currency of supportedCurrencies) {
      if (currency === "AFN") {
        rates.AFN = 1; // 1 AFN = 1 AFN
        continue;
      }

      const currencyLower = currency.toLowerCase();
      if (usdRates[currencyLower]) {
        // 1 AFN = X target currency
        rates[currency] = afnToUsd * usdRates[currencyLower];
      }
    }

    return rates;
  } catch (error) {
    console.error("[Currency] Failed to fetch exchange rates:", error);
    // Return fallback rates (approximate as of Jan 2026)
    return getFallbackRates();
  }
}

/**
 * Fallback exchange rates in case API fails.
 * These are approximate rates and should only be used as last resort.
 */
function getFallbackRates(): ExchangeRates {
  // Approximate rates: 1 AFN = X target currency
  // Based on ~90 AFN = 1 USD (Jan 2026 estimate)
  const afnToUsd = 0.011;
  return {
    AFN: 1,
    USD: afnToUsd, // ~0.011
    EUR: afnToUsd * 0.92, // ~0.010
    GBP: afnToUsd * 0.79, // ~0.0087
    AED: afnToUsd * 3.67, // ~0.040
    SAR: afnToUsd * 3.75, // ~0.041
    PKR: afnToUsd * 278, // ~3.06
    INR: afnToUsd * 83, // ~0.91
    TRY: afnToUsd * 30, // ~0.33
    CAD: afnToUsd * 1.36, // ~0.015
    AUD: afnToUsd * 1.54, // ~0.017
  };
}

/**
 * Get cached exchange rates from the database.
 * Returns null if cache is stale or doesn't exist.
 */
async function getCachedRates(): Promise<ExchangeRates | null> {
  try {
    const cacheThreshold = new Date(
      Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000
    );

    const cachedRates = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, BASE_CURRENCY),
          gte(exchangeRates.fetchedAt, cacheThreshold.toISOString())
        )
      );

    if (cachedRates.length === 0) {
      return null;
    }

    const rates: ExchangeRates = {};
    for (const rate of cachedRates) {
      rates[rate.targetCurrency] = parseFloat(rate.rate);
    }

    return rates;
  } catch (error) {
    console.error("[Currency] Failed to get cached rates:", error);
    return null;
  }
}

/**
 * Save exchange rates to the database cache.
 */
async function cacheRates(rates: ExchangeRates): Promise<void> {
  try {
    const now = new Date().toISOString();

    for (const [currency, rate] of Object.entries(rates)) {
      await db
        .insert(exchangeRates)
        .values({
          baseCurrency: BASE_CURRENCY,
          targetCurrency: currency,
          rate: rate.toString(),
          source: "fawazahmed0",
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [exchangeRates.baseCurrency, exchangeRates.targetCurrency],
          set: {
            rate: rate.toString(),
            fetchedAt: now,
          },
        });
    }
  } catch (error) {
    console.error("[Currency] Failed to cache rates:", error);
  }
}

/**
 * Get current exchange rates (from cache or fresh fetch).
 * Returns rates object where rates[CURRENCY] = amount in CURRENCY for 1 AFN.
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  // Try to get cached rates first
  const cachedRates = await getCachedRates();
  if (
    cachedRates &&
    Object.keys(cachedRates).length >= supportedCurrencies.length - 1
  ) {
    return cachedRates;
  }

  // Fetch fresh rates
  const freshRates = await fetchFreshRates();

  // Cache the rates (don't await, fire and forget)
  cacheRates(freshRates).catch(() => {});

  return freshRates;
}

/**
 * Convert an amount from AFN to another currency.
 *
 * @param amountAFN Amount in Afghan Afghani
 * @param targetCurrency Target currency code (e.g., "USD", "EUR")
 * @param rates Optional pre-fetched rates (to avoid multiple DB calls)
 * @returns Converted amount in target currency
 */
export async function convertFromAFN(
  amountAFN: number,
  targetCurrency: string,
  rates?: ExchangeRates
): Promise<number> {
  if (targetCurrency === BASE_CURRENCY) {
    return amountAFN;
  }

  const exchangeRates = rates || (await getExchangeRates());
  const rate = exchangeRates[targetCurrency];

  if (!rate) {
    console.warn(
      `[Currency] No rate found for ${targetCurrency}, using fallback`
    );
    const fallback = getFallbackRates();
    return amountAFN * (fallback[targetCurrency] || 1);
  }

  return amountAFN * rate;
}

/**
 * Convert an amount from another currency to AFN.
 *
 * @param amount Amount in source currency
 * @param sourceCurrency Source currency code
 * @param rates Optional pre-fetched rates
 * @returns Amount in AFN
 */
export async function convertToAFN(
  amount: number,
  sourceCurrency: string,
  rates?: ExchangeRates
): Promise<number> {
  if (sourceCurrency === BASE_CURRENCY) {
    return amount;
  }

  const exchangeRates = rates || (await getExchangeRates());
  const rate = exchangeRates[sourceCurrency];

  if (!rate || rate === 0) {
    console.warn(`[Currency] No rate found for ${sourceCurrency}`);
    return amount;
  }

  return amount / rate;
}

/**
 * Format an amount in a specific currency.
 *
 * @param amount Amount to format
 * @param currency Currency code
 * @param locale Optional locale for formatting
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string
): string {
  try {
    return new Intl.NumberFormat(locale || "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "AFN" || currency === "PKR" ? 0 : 2,
      maximumFractionDigits: currency === "AFN" || currency === "PKR" ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Lock exchange rate for checkout.
 * Returns the rate and expiry time.
 *
 * @param targetCurrency Customer's currency
 * @param lockDurationMinutes How long to lock the rate (default 15 min)
 */
export async function lockExchangeRate(
  targetCurrency: string,
  lockDurationMinutes: number = 15
): Promise<{
  rate: number;
  expiresAt: Date;
  lockedAt: Date;
}> {
  const rates = await getExchangeRates();
  const rate = rates[targetCurrency] || 1;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);

  return {
    rate,
    expiresAt,
    lockedAt: now,
  };
}

// Re-export types and utils
export * from "./country-currency";
