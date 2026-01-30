import { NextRequest, NextResponse } from "next/server";
import { getTrafficSources, type TimeRange } from "@/lib/db/queries/analytics";

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
    const data = await getTrafficSources(tenantId, timeRange);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching traffic sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch traffic sources" },
      { status: 500 }
    );
  }
}
