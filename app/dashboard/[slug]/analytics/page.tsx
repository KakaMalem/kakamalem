import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getAnalyticsData, type TimeRange } from "@/lib/db/queries/analytics";
import { EnhancedAnalyticsPageClient } from "@/components/dashboard/analytics/enhanced-analytics-page-client";

interface AnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    range?: string;
    start?: string;
    end?: string;
    tab?: string;
  }>;
}

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

export default async function AnalyticsPage({
  params,
  searchParams,
}: AnalyticsPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Validate and default time range
  let timeRange: TimeRange = VALID_RANGES.includes(search.range as TimeRange)
    ? (search.range as TimeRange)
    : "7d";

  // Handle custom date range
  const customStart = search.start;
  const customEnd = search.end;
  if (timeRange === "custom" && customStart && customEnd) {
    // Validate custom dates
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      timeRange = "7d"; // Fall back to 7d if invalid dates
    }
  } else if (timeRange === "custom") {
    timeRange = "7d"; // Fall back if custom but no dates provided
  }

  // Fetch analytics data
  const analyticsData = await getAnalyticsData(store.id, timeRange);

  return (
    <EnhancedAnalyticsPageClient
      storeSlug={slug}
      tenantId={store.id}
      currency={store.currency}
      data={analyticsData}
    />
  );
}
