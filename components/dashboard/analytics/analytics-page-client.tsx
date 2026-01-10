"use client";

import { AnalyticsTimeFilter } from "./analytics-time-filter";
import { AnalyticsKPICards } from "./analytics-kpi-cards";
import { RevenueTrendChart } from "./revenue-trend-chart";
import { OrdersTrendChart } from "./orders-trend-chart";
import { AnalyticsTopProducts } from "./analytics-top-products";
import { CustomerSplitCard } from "./customer-split-card";
import type { AnalyticsData, TimeRange } from "@/lib/db/queries/analytics";

interface AnalyticsPageClientProps {
  storeSlug: string;
  currency: string;
  timeRange: TimeRange;
  data: AnalyticsData;
}

export function AnalyticsPageClient({
  storeSlug,
  currency,
  timeRange,
  data,
}: AnalyticsPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Header with Time Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your store&apos;s performance
          </p>
        </div>
        <AnalyticsTimeFilter storeSlug={storeSlug} currentRange={timeRange} />
      </div>

      {/* KPI Cards */}
      <AnalyticsKPICards kpis={data.kpis} currency={currency} />

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RevenueTrendChart data={data.dailyData} currency={currency} />
          <OrdersTrendChart data={data.dailyData} />
        </div>
        <div className="space-y-6">
          <AnalyticsTopProducts
            products={data.topProducts}
            currency={currency}
            storeSlug={storeSlug}
          />
          <CustomerSplitCard kpis={data.kpis} />
        </div>
      </div>
    </div>
  );
}
