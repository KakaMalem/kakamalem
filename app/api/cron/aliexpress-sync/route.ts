import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and, isNotNull, lt, or } from "drizzle-orm";
import { syncAliExpressProduct } from "@/lib/actions/source-sync";

export const dynamic = "force-dynamic";

/**
 * CRON Job: AliExpress Price & Stock Sync
 * Runs periodically to update products imported from AliExpress.
 */
export async function GET(req: NextRequest) {
  // 1. Basic auth check for CRON
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    processed: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // 2. Fetch products that need syncing
    // Criteria: AliExpress source, sync enabled, and not synced in the last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const productsToSync = await db.query.products.findMany({
      where: and(
        eq(products.sourceType, "aliexpress"),
        eq(products.sourceSyncEnabled, true),
        or(
          isNotNull(products.sourceLastSyncedAt),
          lt(products.sourceLastSyncedAt, sixHoursAgo)
        )
      ),
      limit: 10, // Small batch for safety during scraping
    });

    if (productsToSync.length === 0) {
      return NextResponse.json({ message: "No products need syncing" });
    }

    // 3. Process each product
    for (const product of productsToSync) {
      if (!product.sourceUrl) continue;
      results.processed++;

      try {
        const result = await syncAliExpressProduct(
          product.id,
          product.tenantId,
          false
        );

        if (!result.success) {
          throw new Error(result.reason || "Unknown sync error");
        }

        results.updated++;
      } catch (err) {
        results.failed++;
        results.errors.push(
          `Product ${product.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }

      // Small delay to avoid aggressive scraping
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      timeTaken: `${Date.now() - startTime}ms`,
      ...results,
    });
  } catch (error) {
    console.error("AliExpress Sync Cron Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
