import { NextRequest, NextResponse } from "next/server";
import {
  getProductPerformance,
  type TimeRange,
} from "@/lib/db/queries/analytics";

const VALID_RANGES: TimeRange[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "this_year",
  "custom",
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get("tenantId");
  const range = searchParams.get("timeRange") || "7d";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const sortBy = searchParams.get("sortBy") || "revenue";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  const timeRange: TimeRange = VALID_RANGES.includes(range as TimeRange)
    ? (range as TimeRange)
    : "7d";

  try {
    const data = await getProductPerformance(tenantId, timeRange, {
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching product performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch product performance" },
      { status: 500 }
    );
  }
}
