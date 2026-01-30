"use client";

import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  Eye,
  ShoppingBag,
  XCircle,
  Package,
} from "lucide-react";
import { AnalyticsKPICard } from "./analytics-kpi-card";
import type {
  EnhancedAnalyticsKPIs,
  DailyAnalyticsPoint,
} from "@/lib/db/queries/analytics";

interface EnhancedAnalyticsKPICardsProps {
  kpis: EnhancedAnalyticsKPIs;
  dailyData: DailyAnalyticsPoint[];
  currency: string;
}

function formatCurrency(value: number, currency: string): string {
  if (!Number.isFinite(value)) return `0 ${currency}`;
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M ${currency}`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K ${currency}`;
  }
  return `${value.toLocaleString()} ${currency}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export function EnhancedAnalyticsKPICards({
  kpis,
  dailyData,
  currency,
}: EnhancedAnalyticsKPICardsProps) {
  // Prepare sparkline data from daily data
  const revenueSparkline = dailyData.map((d) => ({ value: d.revenue }));
  const ordersSparkline = dailyData.map((d) => ({ value: d.orders }));
  const customersSparkline = dailyData.map((d) => ({
    value: d.newCustomers + d.returningCustomers,
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Row 1: Core metrics */}
      <AnalyticsKPICard
        title="Total Revenue"
        value={formatCurrency(kpis.totalRevenue, currency)}
        change={kpis.revenueChange}
        icon={<DollarSign className="size-5" />}
        sparklineData={revenueSparkline}
      />
      <AnalyticsKPICard
        title="Total Orders"
        value={formatNumber(kpis.totalOrders)}
        change={kpis.ordersChange}
        icon={<ShoppingCart className="size-5" />}
        sparklineData={ordersSparkline}
      />
      <AnalyticsKPICard
        title="Avg Order Value"
        value={formatCurrency(kpis.averageOrderValue, currency)}
        change={kpis.aovChange}
        icon={<TrendingUp className="size-5" />}
      />
      <AnalyticsKPICard
        title="Customers"
        value={formatNumber(kpis.totalCustomers)}
        change={kpis.customersChange}
        changeLabel={`${kpis.newCustomers} new, ${kpis.returningCustomers} returning`}
        icon={<Users className="size-5" />}
        sparklineData={customersSparkline}
      />

      {/* Row 2: Conversion & engagement metrics */}
      <AnalyticsKPICard
        title="Conversion Rate"
        value={formatPercent(kpis.conversionRate)}
        change={kpis.conversionRateChange}
        icon={<ShoppingBag className="size-5" />}
        trend={
          kpis.conversionRateChange > 0
            ? "up"
            : kpis.conversionRateChange < 0
              ? "down"
              : "neutral"
        }
      />
      <AnalyticsKPICard
        title="Cart Abandonment"
        value={formatPercent(kpis.cartAbandonmentRate)}
        change={kpis.cartAbandonmentChange}
        icon={<XCircle className="size-5" />}
        // For abandonment, down is good
        trend={
          kpis.cartAbandonmentChange < 0
            ? "up"
            : kpis.cartAbandonmentChange > 0
              ? "down"
              : "neutral"
        }
      />
      <AnalyticsKPICard
        title="Items per Order"
        value={
          Number.isFinite(kpis.averageItemsPerOrder)
            ? kpis.averageItemsPerOrder.toFixed(1)
            : "0.0"
        }
        change={kpis.itemsPerOrderChange}
        icon={<Package className="size-5" />}
      />
      <AnalyticsKPICard
        title="Product Views"
        value={formatNumber(kpis.productViews)}
        change={kpis.productViewsChange}
        icon={<Eye className="size-5" />}
      />
    </div>
  );
}
