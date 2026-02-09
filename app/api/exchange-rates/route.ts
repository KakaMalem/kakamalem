/**
 * Exchange Rates API
 *
 * Returns current exchange rates for multi-currency support.
 * Caches rates in the database and refreshes every 6 hours.
 *
 * GET /api/exchange-rates
 * Response: { base: "AFN", rates: { USD: 0.011, EUR: 0.010, ... }, updatedAt: "..." }
 */

import { NextResponse } from "next/server";
import { getExchangeRates, BASE_CURRENCY } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  try {
    const rates = await getExchangeRates();

    return NextResponse.json({
      base: BASE_CURRENCY,
      rates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to get exchange rates:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch exchange rates",
        base: BASE_CURRENCY,
        rates: {},
      },
      { status: 500 }
    );
  }
}
