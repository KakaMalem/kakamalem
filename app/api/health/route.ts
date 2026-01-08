import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "ok" | "error";
      latency?: number;
      error?: string;
    };
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "ok" },
    },
  };

  // Check database connection
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    status.checks.database.latency = Date.now() - dbStart;
  } catch (error) {
    status.status = "unhealthy";
    status.checks.database.status = "error";
    status.checks.database.error =
      error instanceof Error ? error.message : "Unknown database error";
  }

  const httpStatus = status.status === "healthy" ? 200 : 503;
  return NextResponse.json(status, { status: httpStatus });
}
