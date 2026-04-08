import { NextRequest, NextResponse } from "next/server";
import { maturePendingEarnings } from "@/lib/actions/earnings";

/**
 * Cron endpoint for maturing pending seller earnings.
 * Moves funds from pending → available after the hold period (default 7 days).
 *
 * Should be called on a schedule (e.g., every hour via cron).
 * Protected by CRON_SECRET.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://kakamalem.com/api/cron/mature-earnings
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await maturePendingEarnings();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    matured: result.matured,
    timestamp: new Date().toISOString(),
  });
}
