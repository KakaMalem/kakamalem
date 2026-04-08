import { NextRequest, NextResponse } from "next/server";
import { processAutoReleases } from "@/lib/escrow";

/**
 * Cron endpoint for auto-releasing expired escrows.
 * Finds all in_transit escrows past their 30-day autoReleaseAt deadline
 * and releases funds to the seller (minus platform fee).
 *
 * Should be called on a schedule (e.g., every hour via cron or external scheduler).
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://kakamalem.com/api/cron/escrow-auto-release
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processAutoReleases();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    released: result.data.released,
    timestamp: new Date().toISOString(),
  });
}
