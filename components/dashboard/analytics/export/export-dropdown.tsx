"use client";

import { Download, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportToCSV,
  exportToExcel,
  exportChartToPNG,
  generateAnalyticsFilename,
} from "./export-utils";
import type { AnalyticsData } from "@/lib/db/queries/analytics";

interface ExportDropdownProps {
  data: AnalyticsData;
  storeSlug: string;
  currency: string;
}

export function ExportDropdown({
  data,
  storeSlug,
  currency,
}: ExportDropdownProps) {
  const handleExportKPIsCSV = () => {
    const kpiData = [
      {
        metric: "Total Revenue",
        value: `${data.kpis.totalRevenue} ${currency}`,
        change: `${data.kpis.revenueChange}%`,
      },
      {
        metric: "Total Orders",
        value: data.kpis.totalOrders,
        change: `${data.kpis.ordersChange}%`,
      },
      {
        metric: "Average Order Value",
        value: `${data.kpis.averageOrderValue} ${currency}`,
        change: `${data.kpis.aovChange}%`,
      },
      {
        metric: "Total Customers",
        value: data.kpis.totalCustomers,
        change: `${data.kpis.customersChange}%`,
      },
      {
        metric: "New Customers",
        value: data.kpis.newCustomers,
        change: "-",
      },
      {
        metric: "Returning Customers",
        value: data.kpis.returningCustomers,
        change: "-",
      },
    ];

    exportToCSV(kpiData, generateAnalyticsFilename("kpis", storeSlug), [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
      { key: "change", label: "Change vs Previous" },
    ]);
  };

  const handleExportDailyDataCSV = () => {
    const dailyData = data.dailyData.map((d) => ({
      date: d.date,
      revenue: d.revenue || 0,
      orders: d.orders || 0,
      averageOrderValue: Number.isFinite(d.averageOrderValue)
        ? d.averageOrderValue.toFixed(2)
        : "0.00",
      newCustomers: d.newCustomers || 0,
      returningCustomers: d.returningCustomers || 0,
    }));

    exportToCSV(dailyData, generateAnalyticsFilename("daily", storeSlug), [
      { key: "date", label: "Date" },
      { key: "revenue", label: "Revenue" },
      { key: "orders", label: "Orders" },
      { key: "averageOrderValue", label: "AOV" },
      { key: "newCustomers", label: "New Customers" },
      { key: "returningCustomers", label: "Returning Customers" },
    ]);
  };

  const handleExportTopProductsCSV = () => {
    const productData = data.topProducts.map((p) => ({
      product: p.name,
      unitsSold: p.quantitySold || 0,
      revenue: p.revenue || 0,
      ordersContaining: p.ordersContaining || 0,
      percentOfTotal: `${Number.isFinite(p.percentOfTotal) ? p.percentOfTotal.toFixed(1) : "0.0"}%`,
    }));

    exportToCSV(productData, generateAnalyticsFilename("products", storeSlug), [
      { key: "product", label: "Product" },
      { key: "unitsSold", label: "Units Sold" },
      { key: "revenue", label: "Revenue" },
      { key: "ordersContaining", label: "Orders" },
      { key: "percentOfTotal", label: "% of Total" },
    ]);
  };

  const handleExportAllExcel = () => {
    // Combine all data into a single export
    const combinedData = {
      kpis: [
        { metric: "Total Revenue", value: data.kpis.totalRevenue },
        { metric: "Total Orders", value: data.kpis.totalOrders },
        { metric: "Average Order Value", value: data.kpis.averageOrderValue },
        { metric: "Total Customers", value: data.kpis.totalCustomers },
      ],
      daily: data.dailyData,
      products: data.topProducts,
    };

    exportToExcel(
      combinedData.daily,
      generateAnalyticsFilename("analytics", storeSlug),
      "Daily Data"
    );
  };

  const handleExportChartPNG = async (chartId: string, name: string) => {
    await exportChartToPNG(chartId, generateAnalyticsFilename(name, storeSlug));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="size-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Data</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportKPIsCSV}>
          <FileSpreadsheet className="mr-2 size-4" />
          KPIs (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportDailyDataCSV}>
          <FileSpreadsheet className="mr-2 size-4" />
          Daily Data (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportTopProductsCSV}>
          <FileSpreadsheet className="mr-2 size-4" />
          Top Products (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportAllExcel}>
          <FileSpreadsheet className="mr-2 size-4" />
          All Data (Excel)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export Charts</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => handleExportChartPNG("revenue-chart", "revenue-chart")}
        >
          <ImageIcon className="mr-2 size-4" />
          Revenue Chart (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExportChartPNG("orders-chart", "orders-chart")}
        >
          <ImageIcon className="mr-2 size-4" />
          Orders Chart (PNG)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
