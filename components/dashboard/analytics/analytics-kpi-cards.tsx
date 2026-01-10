"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import type { AnalyticsKPIs } from "@/lib/db/queries/analytics";

interface AnalyticsKPICardsProps {
  kpis: AnalyticsKPIs;
  currency: string;
}

export function AnalyticsKPICards({ kpis, currency }: AnalyticsKPICardsProps) {
  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} ${currency}`;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Revenue"
        value={formatCurrency(kpis.totalRevenue)}
        change={kpis.revenueChange}
        subtitle="vs previous period"
        icon={<DollarSign className="size-4" />}
      />
      <StatsCard
        title="Total Orders"
        value={kpis.totalOrders}
        change={kpis.ordersChange}
        subtitle="vs previous period"
        icon={<ShoppingCart className="size-4" />}
      />
      <StatsCard
        title="Avg Order Value"
        value={formatCurrency(kpis.averageOrderValue)}
        change={kpis.aovChange}
        subtitle="vs previous period"
        icon={<TrendingUp className="size-4" />}
      />
      <StatsCard
        title="Customers"
        value={kpis.totalCustomers}
        change={kpis.customersChange}
        subtitle={`${kpis.newCustomers} new, ${kpis.returningCustomers} returning`}
        icon={<Users className="size-4" />}
      />
    </div>
  );
}
