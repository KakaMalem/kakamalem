/**
 * Currency Service
 *
 * Handles exchange rate fetching, caching, and currency conversion.
 *
 * Primary source: sarafi.af (Sarai Shahzada market — the de facto AFN rate in Afghanistan)
 * Fallback: Fawaz Ahmed's free currency API (international forex rates)
 */

import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { supportedCurrencies } from "./country-currency";

// Base currency for the platform
export const BASE_CURRENCY = "AFN";

// Cache duration in hours
const CACHE_DURATION_HOURS = 6;

// Sarafi.af API (Sarai Shahzada market rates)
const SARAFI_API_URL = "https://sarafi.af/api/exchange-rates";

// Fawaz Ahmed Currency API (fallback)
const FAWAZ_API_BASE =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1";

export type ExchangeRates = Record<string, number>;

// =============================================================================
// RATE SOURCES
// =============================================================================

/**
 * Type for a sarafi.af rate entry
 */
interface SarafiRate {
  currency: string; // e.g. "USDAFN"
  currency_name: string;
  buy_rate: string;
  sell_rate: string;
  change: { percentage: string; points: string };
  created_at: string;
}

/**
 * Fetch exchange rates from sarafi.af (Sarai Shahzada market).
 * Returns null if the fetch fails (so caller can try fallback).
 *
 * Rates are in "X AFN per 1 foreign currency" format.
 * We convert to our format: "1 AFN = Y foreign currency" (Y = 1/X).
 * Uses the midpoint of buy/sell for fairness.
 */
async function fetchSarafiRates(): Promise<ExchangeRates | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(SARAFI_API_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`sarafi.af returned ${response.status}`);
    }

    const data = await response.json();
    const marketRates: SarafiRate[] = data?.default_market_rates?.rates;

    if (
      !marketRates ||
      !Array.isArray(marketRates) ||
      marketRates.length === 0
    ) {
      throw new Error("No rates in sarafi.af response");
    }

    const rates: ExchangeRates = { AFN: 1 };

    for (const entry of marketRates) {
      // Extract currency code: "USDAFN" → "USD"
      const code = entry.currency.replace("AFN", "").toUpperCase();
      if (!code || !(supportedCurrencies as readonly string[]).includes(code))
        continue;

      const buy = parseFloat(entry.buy_rate);
      const sell = parseFloat(entry.sell_rate);
      if (!buy || !sell || buy <= 0 || sell <= 0) continue;

      // Midpoint: how many AFN per 1 unit of foreign currency
      const midpoint = (buy + sell) / 2;

      // Our format: 1 AFN = X foreign currency
      rates[code] = 1 / midpoint;
    }

    // Sanity check: must have at least USD
    if (!rates.USD) {
      throw new Error("USD rate missing from sarafi.af response");
    }

    console.log(
      `[Currency] Fetched ${Object.keys(rates).length - 1} rates from sarafi.af (1 USD ≈ ${(1 / rates.USD).toFixed(2)} AFN)`
    );

    return rates;
  } catch (error) {
    console.warn("[Currency] sarafi.af fetch failed:", error);
    return null;
  }
}

/**
 * Fetch exchange rates from Fawaz Ahmed Currency API (fallback).
 * Uses USD as intermediary since AFN rates might not be directly available.
 */
async function fetchFawazRates(): Promise<ExchangeRates | null> {
  try {
    const response = await fetch(`${FAWAZ_API_BASE}/currencies/usd.json`, {
      next: { revalidate: CACHE_DURATION_HOURS * 60 * 60 },
    });

    if (!response.ok) {
      throw new Error(`Fawaz API returned ${response.status}`);
    }

    const data = await response.json();
    const usdRates = data.usd;

    if (!usdRates || !usdRates.afn) {
      throw new Error("AFN rate not found in Fawaz API response");
    }

    // Calculate rates from AFN to other currencies
    // If 1 USD = X AFN, then 1 AFN = 1/X USD
    const afnToUsd = 1 / usdRates.afn;

    const rates: ExchangeRates = { AFN: 1 };

    for (const currency of supportedCurrencies) {
      if (currency === "AFN") continue;

      const currencyLower = currency.toLowerCase();
      if (usdRates[currencyLower]) {
        rates[currency] = afnToUsd * usdRates[currencyLower];
      }
    }

    console.log(
      `[Currency] Fetched ${Object.keys(rates).length - 1} rates from Fawaz Ahmed API`
    );

    return rates;
  } catch (error) {
    console.warn("[Currency] Fawaz Ahmed API fetch failed:", error);
    return null;
  }
}

/**
 * Fetch fresh exchange rates.
 * Tries sarafi.af first (accurate Afghan market rates), falls back to Fawaz Ahmed.
 */
async function fetchFreshRates(): Promise<{
  rates: ExchangeRates;
  source: string;
}> {
  // Try sarafi.af first (Sarai Shahzada — the real AFN market rate)
  const sarafiRates = await fetchSarafiRates();
  if (sarafiRates) {
    return { rates: sarafiRates, source: "sarafi.af" };
  }

  // Fallback to Fawaz Ahmed (international forex)
  const fawazRates = await fetchFawazRates();
  if (fawazRates) {
    return { rates: fawazRates, source: "fawazahmed0" };
  }

  // Both failed — use hardcoded fallback
  console.error("[Currency] All rate sources failed, using fallback rates");
  return { rates: getFallbackRates(), source: "fallback" };
}

/**
 * Fallback exchange rates in case all APIs fail.
 * Based on Sarai Shahzada rates (~63 AFN = 1 USD, Feb 2026).
 */
function getFallbackRates(): ExchangeRates {
  // Approximate rates: 1 AFN = X target currency
  // Based on Sarai Shahzada midpoint rates (Feb 2026)
  return {
    AFN: 1,
    USD: 1 / 63.18, // ~0.01583
    EUR: 1 / 74.1, // ~0.01350
    GBP: 1 / 80.0, // ~0.01250
    AED: 1 / 17.2, // ~0.05814
    SAR: 1 / 16.85, // ~0.05935
    PKR: 1 / 0.23, // ~4.35
    INR: 1 / 0.73, // ~1.37
    TRY: 1 / 1.75, // ~0.571
    CAD: 1 / 44.0, // ~0.02273
    AUD: 1 / 39.5, // ~0.02532
  };
}

// =============================================================================
// CACHING
// =============================================================================

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
async function cacheRates(rates: ExchangeRates, source: string): Promise<void> {
  try {
    const now = new Date().toISOString();

    for (const [currency, rate] of Object.entries(rates)) {
      await db
        .insert(exchangeRates)
        .values({
          baseCurrency: BASE_CURRENCY,
          targetCurrency: currency,
          rate: rate.toString(),
          source,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [exchangeRates.baseCurrency, exchangeRates.targetCurrency],
          set: {
            rate: rate.toString(),
            source,
            fetchedAt: now,
          },
        });
    }
  } catch (error) {
    console.error("[Currency] Failed to cache rates:", error);
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

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
  const { rates, source } = await fetchFreshRates();

  // Cache the rates (don't await, fire and forget)
  cacheRates(rates, source).catch(() => {});

  return rates;
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

// Re-export types and utils
export * from "./country-currency";
