import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getAnalyticsData, type TimeRange } from "@/lib/db/queries/analytics";
import { AnalyticsPageClient } from "@/components/dashboard/analytics/analytics-page-client";

interface AnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    range?: string;
  }>;
}

const VALID_RANGES: TimeRange[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this_month",
  "last_month",
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
  const timeRange = VALID_RANGES.includes(search.range as TimeRange)
    ? (search.range as TimeRange)
    : "7d";

  // Fetch analytics data
  const analyticsData = await getAnalyticsData(store.id, timeRange);

  return (
    <AnalyticsPageClient
      storeSlug={slug}
      currency={store.currency}
      timeRange={timeRange}
      data={analyticsData}
    />
  );
}
