"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AnalyticsData,
  EnhancedAnalyticsKPIs,
  TimeRange,
  CategoryPerformance,
  TrafficSourceData,
  ConversionFunnelData,
  GeographicData,
  HeatmapData,
  RealTimeMetrics,
  ProductPerformanceRow,
} from "@/lib/db/queries/analytics";

// ============================================================================
// Query Key Factory
// ============================================================================

export type AnalyticsQueryParams = {
  tenantId: string;
  timeRange: TimeRange;
  startDate?: string;
  endDate?: string;
  compareEnabled?: boolean;
  granularity?: "hour" | "day" | "week" | "month";
  productId?: string;
  categoryId?: string;
};

export const analyticsKeys = {
  all: (tenantId: string) => ["analytics", tenantId] as const,

  // Main analytics data (existing)
  data: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "data", params] as const,

  // Enhanced KPIs with more metrics
  kpis: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "kpis", params] as const,

  // Time series with comparison
  timeSeries: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "timeSeries", params] as const,

  // Category performance
  categories: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "categories", params] as const,

  // Product performance (paginated)
  products: (
    tenantId: string,
    params: Partial<AnalyticsQueryParams> & {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ) => [...analyticsKeys.all(tenantId), "products", params] as const,

  // Traffic sources
  traffic: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "traffic", params] as const,

  // Conversion funnel
  funnel: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "funnel", params] as const,

  // Geographic data
  geographic: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "geographic", params] as const,

  // Sales heatmap
  heatmap: (tenantId: string, params: Partial<AnalyticsQueryParams>) =>
    [...analyticsKeys.all(tenantId), "heatmap", params] as const,

  // Real-time metrics (refreshes frequently)
  realTime: (tenantId: string) =>
    [...analyticsKeys.all(tenantId), "realTime"] as const,
};

// ============================================================================
// Server Action Fetchers
// ============================================================================

async function fetchAnalyticsData(
  params: AnalyticsQueryParams
): Promise<AnalyticsData> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
    ...(params.compareEnabled !== undefined && {
      compareEnabled: String(params.compareEnabled),
    }),
  });

  const response = await fetch(`/api/analytics/data?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch analytics data");
  return response.json();
}

async function fetchEnhancedKPIs(
  params: AnalyticsQueryParams
): Promise<EnhancedAnalyticsKPIs> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/kpis?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch KPIs");
  return response.json();
}

async function fetchCategoryPerformance(
  params: AnalyticsQueryParams
): Promise<CategoryPerformance[]> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/categories?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch category performance");
  return response.json();
}

async function fetchProductPerformance(
  params: AnalyticsQueryParams & {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<{ data: ProductPerformanceRow[]; total: number }> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 10),
    ...(params.sortBy && { sortBy: params.sortBy }),
    ...(params.sortOrder && { sortOrder: params.sortOrder }),
  });

  const response = await fetch(`/api/analytics/products?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch product performance");
  return response.json();
}

async function fetchTrafficSources(
  params: AnalyticsQueryParams
): Promise<TrafficSourceData[]> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/traffic?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch traffic sources");
  return response.json();
}

async function fetchConversionFunnel(
  params: AnalyticsQueryParams
): Promise<ConversionFunnelData[]> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/funnel?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch conversion funnel");
  return response.json();
}

async function fetchGeographicData(
  params: AnalyticsQueryParams
): Promise<GeographicData[]> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/geographic?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch geographic data");
  return response.json();
}

async function fetchSalesHeatmap(
  params: AnalyticsQueryParams
): Promise<HeatmapData[]> {
  const searchParams = new URLSearchParams({
    tenantId: params.tenantId,
    timeRange: params.timeRange,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  });

  const response = await fetch(`/api/analytics/heatmap?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch sales heatmap");
  return response.json();
}

async function fetchRealTimeMetrics(
  tenantId: string
): Promise<RealTimeMetrics> {
  const response = await fetch(`/api/analytics/realtime?tenantId=${tenantId}`);
  if (!response.ok) throw new Error("Failed to fetch real-time metrics");
  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook for fetching main analytics data (KPIs, daily data, top products)
 * Used on the analytics page overview
 */
export function useAnalyticsData(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.data(params.tenantId, params),
    queryFn: () => fetchAnalyticsData(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fetching enhanced KPIs with additional metrics
 * Includes conversion rate, cart abandonment, views, items per order
 */
export function useEnhancedKPIs(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.kpis(params.tenantId, params),
    queryFn: () => fetchEnhancedKPIs(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching category performance data
 * Used for donut/pie charts
 */
export function useCategoryPerformance(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.categories(params.tenantId, params),
    queryFn: () => fetchCategoryPerformance(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching product performance with pagination
 * Used in the product performance table
 */
export function useProductPerformance(
  params: AnalyticsQueryParams & {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
) {
  return useQuery({
    queryKey: analyticsKeys.products(params.tenantId, params),
    queryFn: () => fetchProductPerformance(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching traffic source data
 * Used for UTM/referrer analysis
 */
export function useTrafficSources(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.traffic(params.tenantId, params),
    queryFn: () => fetchTrafficSources(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching conversion funnel data
 * Shows drop-off at each stage
 */
export function useConversionFunnel(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.funnel(params.tenantId, params),
    queryFn: () => fetchConversionFunnel(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching geographic sales data
 * Used for geographic breakdown
 */
export function useGeographicData(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.geographic(params.tenantId, params),
    queryFn: () => fetchGeographicData(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching sales heatmap data
 * Shows sales by hour and day of week
 */
export function useSalesHeatmap(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.heatmap(params.tenantId, params),
    queryFn: () => fetchSalesHeatmap(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for fetching real-time metrics
 * Refreshes every 30 seconds when enabled
 */
export function useRealTimeMetrics(tenantId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: analyticsKeys.realTime(tenantId),
    queryFn: () => fetchRealTimeMetrics(tenantId),
    refetchInterval: enabled ? 30 * 1000 : false, // 30 seconds
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 60 * 1000, // 1 minute
    enabled,
  });
}
