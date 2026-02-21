"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsFilterBar } from "./filters";
import { EnhancedAnalyticsKPICards } from "./kpis";
import { RevenueTrendChart } from "./revenue-trend-chart";
import { OrdersTrendChart } from "./orders-trend-chart";
import { AnalyticsTopProducts } from "./analytics-top-products";
import { CustomerSplitCard } from "./customer-split-card";
import { CategoryDistributionChart } from "./charts/category-distribution-chart";
import { SalesHeatmap } from "./charts/sales-heatmap";
import { ConversionFunnelChart } from "./charts/conversion-funnel-chart";
import { ProductPerformanceTable } from "./tables/product-performance-table";
import { TrafficSourcesTable } from "./tables/traffic-sources-table";
import { RealTimeIndicator } from "./widgets/real-time-indicator";
import { SectionEngagementCard } from "./section-engagement-card";
import { ExportDropdown } from "./export";
import { useAnalyticsFilters } from "@/lib/hooks/use-analytics-filters";
import { useRealTimeMetrics } from "@/lib/hooks/use-analytics";
import type {
  AnalyticsData,
  EnhancedAnalyticsKPIs,
  CategoryPerformance,
  HeatmapData,
  ConversionFunnelData,
  ProductPerformanceRow,
  TrafficSourceData,
} from "@/lib/db/queries/analytics";

interface EnhancedAnalyticsPageClientProps {
  storeSlug: string;
  tenantId: string;
  currency: string;
  // Basic analytics data (always available)
  data: AnalyticsData;
  // Enhanced data (may be undefined if not available)
  enhancedKpis?: EnhancedAnalyticsKPIs;
  categoryData?: CategoryPerformance[];
  heatmapData?: HeatmapData[];
  funnelData?: ConversionFunnelData[];
  productTableData?: ProductPerformanceRow[];
  trafficData?: TrafficSourceData[];
  sectionData?: {
    sectionType: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }[];
}

function EnhancedAnalyticsPageClientInner({
  storeSlug,
  tenantId,
  currency,
  data,
  enhancedKpis,
  categoryData,
  heatmapData,
  funnelData,
  productTableData,
  trafficData,
  sectionData,
}: EnhancedAnalyticsPageClientProps) {
  const { filters, setRange, setDateRange, setTab } = useAnalyticsFilters();

  // Real-time metrics with 30s polling
  const {
    data: realTimeData,
    isLoading: realTimeLoading,
    isError: realTimeError,
  } = useRealTimeMetrics(tenantId);

  // Use enhanced KPIs if available, otherwise create from basic data
  const kpisForDisplay: EnhancedAnalyticsKPIs = enhancedKpis || {
    ...data.kpis,
    conversionRate: 0,
    conversionRateChange: 0,
    cartAbandonmentRate: 0,
    cartAbandonmentChange: 0,
    averageItemsPerOrder: 0,
    itemsPerOrderChange: 0,
    productViews: 0,
    productViewsChange: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your store&apos;s performance and growth
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AnalyticsFilterBar
            timeRange={filters.range === "custom" ? "custom" : filters.range}
            customStart={filters.start}
            customEnd={filters.end}
            onTimeRangeChange={setRange}
            onCustomRangeChange={setDateRange}
          >
            <ExportDropdown
              data={data}
              storeSlug={storeSlug}
              currency={currency}
            />
          </AnalyticsFilterBar>
        </div>
      </div>

      {/* Real-time indicator */}
      <RealTimeIndicator
        data={realTimeData}
        isLoading={realTimeLoading}
        isError={realTimeError}
        currency={currency}
      />

      {/* Tabs */}
      <Tabs
        value={filters.tab}
        onValueChange={(value) =>
          setTab(value as "overview" | "products" | "customers" | "conversions")
        }
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <EnhancedAnalyticsKPICards
            kpis={kpisForDisplay}
            dailyData={data.dailyData}
            currency={currency}
          />

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div id="revenue-chart">
                <RevenueTrendChart data={data.dailyData} currency={currency} />
              </div>
              <div id="orders-chart">
                <OrdersTrendChart data={data.dailyData} />
              </div>
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

          {/* Additional charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {categoryData && categoryData.length > 0 && (
              <CategoryDistributionChart
                data={categoryData}
                currency={currency}
              />
            )}
            {heatmapData && heatmapData.length > 0 && (
              <SalesHeatmap data={heatmapData} currency={currency} />
            )}
          </div>

          {/* Section engagement */}
          {sectionData && <SectionEngagementCard data={sectionData} />}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6 mt-6">
          {productTableData ? (
            <ProductPerformanceTable
              data={productTableData}
              currency={currency}
            />
          ) : (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Product performance data is not available.
            </div>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <CustomerSplitCard kpis={data.kpis} />
            {trafficData && trafficData.length > 0 && (
              <TrafficSourcesTable data={trafficData} currency={currency} />
            )}
          </div>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions" className="space-y-6 mt-6">
          {funnelData && funnelData.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ConversionFunnelChart data={funnelData} />
              {heatmapData && heatmapData.length > 0 && (
                <SalesHeatmap data={heatmapData} currency={currency} />
              )}
            </div>
          ) : (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Conversion funnel data is not available.
              <p className="text-sm mt-2">
                Funnel data is collected from page views, cart actions, and
                checkout events.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrap with NuqsAdapter for nuqs to work properly
export function EnhancedAnalyticsPageClient(
  props: EnhancedAnalyticsPageClientProps
) {
  return (
    <NuqsAdapter>
      <EnhancedAnalyticsPageClientInner {...props} />
    </NuqsAdapter>
  );
}
