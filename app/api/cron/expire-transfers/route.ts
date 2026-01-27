import { NextResponse } from "next/server";
import { expirePendingTransferRequests } from "@/lib/db/queries/store-transfers";

/**
 * Cron job to expire pending store transfer requests
 * Call this endpoint with a cron service (e.g., Vercel Cron, external cron)
 *
 * Recommended schedule: Once per hour
 * Example cron: 0 * * * * (every hour at minute 0)
 *
 * Authentication: Bearer token via CRON_SECRET environment variable
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow access without auth in development for testing
  if (process.env.NODE_ENV === "production" && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const expiredCount = await expirePendingTransferRequests();

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to expire transfer requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
