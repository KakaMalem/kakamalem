import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, gte, and, count, sum, desc, notInArray } from "drizzle-orm";
import type { RealTimeMetrics } from "@/lib/db/queries/analytics";

const EXCLUDED_STATUSES: ("cancelled" | "returned")[] = [
  "cancelled",
  "returned",
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  try {
    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Run queries in parallel
    const [todayStats, lastOrder] = await Promise.all([
      // Today's orders and revenue
      db
        .select({
          orders: count(),
          revenue: sum(orders.total),
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            gte(orders.createdAt, todayStr),
            notInArray(orders.status, EXCLUDED_STATUSES)
          )
        ),

      // Last order time
      db
        .select({
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            notInArray(orders.status, EXCLUDED_STATUSES)
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(1),
    ]);

    const stats = todayStats[0];
    const lastOrderData = lastOrder[0];

    const metrics: RealTimeMetrics = {
      ordersToday: stats?.orders || 0,
      revenueToday: parseFloat(stats?.revenue || "0"),
      activeVisitors: 0, // Would need session tracking to implement
      lastOrderAt: lastOrderData?.createdAt || null,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching real-time metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch real-time metrics" },
      { status: 500 }
    );
  }
}
