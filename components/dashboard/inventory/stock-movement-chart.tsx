"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  StockMovementTrend,
  MovementsByType,
} from "@/lib/db/queries/inventory";

interface StockMovementChartProps {
  data: StockMovementTrend[];
  movementsByType?: MovementsByType[];
  dateRange?: "7d" | "30d" | "90d";
  onDateRangeChange?: (range: "7d" | "30d" | "90d") => void;
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  try {
    // Handle different date formats
    if (dateStr.includes("-IW")) {
      // Week format: YYYY-IW (e.g., 2024-W05)
      const [year, week] = dateStr.split("-");
      return `Week ${week}, ${year}`;
    }
    if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Month format: YYYY-MM
      const date = parseISO(`${dateStr}-01`);
      return format(date, "MMM yyyy");
    }
    // Day format: YYYY-MM-DD
    const date = parseISO(dateStr);
    return format(date, "MMM d");
  } catch {
    return dateStr;
  }
}

const movementTypeLabels: Record<string, string> = {
  adjustment: "Adjustments",
  sale: "Sales",
  return: "Returns",
  restock: "Restocks",
  reserved: "Reserved",
  released: "Released",
};

const movementTypeColors: Record<string, string> = {
  adjustment: "#3b82f6",
  sale: "#ef4444",
  return: "#22c55e",
  restock: "#22c55e",
  reserved: "#f59e0b",
  released: "#6b7280",
};

export function StockMovementChart({
  data,
  movementsByType,
  dateRange = "30d",
  onDateRangeChange,
  isLoading = false,
}: StockMovementChartProps) {
  // Calculate summary stats
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalAdditions: 0,
        totalReductions: 0,
        netChange: 0,
        trend: "neutral" as const,
      };
    }

    const totalAdditions = data.reduce((sum, d) => sum + d.additions, 0);
    const totalReductions = data.reduce((sum, d) => sum + d.reductions, 0);
    const netChange = data.reduce((sum, d) => sum + d.netChange, 0);

    // Calculate trend by comparing first half to second half
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);

    const firstHalfNet = firstHalf.reduce((sum, d) => sum + d.netChange, 0);
    const secondHalfNet = secondHalf.reduce((sum, d) => sum + d.netChange, 0);

    let trend: "up" | "down" | "neutral" = "neutral";
    if (secondHalfNet > firstHalfNet + 10) trend = "up";
    else if (secondHalfNet < firstHalfNet - 10) trend = "down";

    return { totalAdditions, totalReductions, netChange, trend };
  }, [data]);

  // Format chart data
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      formattedDate: formatDate(d.date),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stock Movement Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-75 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Main Chart */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Stock Movement Trends</CardTitle>
            <div className="flex items-center gap-2">
              {stats.trend === "up" && (
                <Badge
                  variant="outline"
                  className="gap-1 border-green-500 text-green-600"
                >
                  <TrendingUp className="size-3" />
                  Trending Up
                </Badge>
              )}
              {stats.trend === "down" && (
                <Badge
                  variant="outline"
                  className="gap-1 border-red-500 text-red-600"
                >
                  <TrendingDown className="size-3" />
                  Trending Down
                </Badge>
              )}
              {stats.trend === "neutral" && (
                <Badge variant="outline" className="gap-1">
                  <Minus className="size-3" />
                  Stable
                </Badge>
              )}
            </div>
          </div>
          {onDateRangeChange && (
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger className="w-32.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex h-62.5 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ArrowUpDown className="mx-auto mb-2 size-8" />
                <p>No stock movements in this period</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="colorAdditions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorReductions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <p className="mb-2 font-medium">{label}</p>
                        {payload.map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-4 text-sm"
                          >
                            <span style={{ color: entry.color }}>
                              {entry.name === "additions" ? "Added" : "Removed"}
                            </span>
                            <span className="font-medium">{entry.value}</span>
                          </div>
                        ))}
                        <div className="mt-1 border-t pt-1 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span>Net Change</span>
                            <span
                              className={`font-medium ${
                                (payload[0]?.payload?.netChange || 0) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {(payload[0]?.payload?.netChange || 0) >= 0
                                ? "+"
                                : ""}
                              {payload[0]?.payload?.netChange || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="additions"
                  name="additions"
                  stroke="#22c55e"
                  fill="url(#colorAdditions)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="reductions"
                  name="reductions"
                  stroke="#ef4444"
                  fill="url(#colorReductions)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="space-y-4">
        {/* Summary Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Added</span>
              <span className="font-medium text-green-600">
                +{stats.totalAdditions.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total Removed
              </span>
              <span className="font-medium text-red-600">
                -{stats.totalReductions.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Net Change</span>
                <span
                  className={`text-lg font-bold ${
                    stats.netChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stats.netChange >= 0 ? "+" : ""}
                  {stats.netChange.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Movement Types Breakdown */}
        {movementsByType && movementsByType.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {movementsByType.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor:
                            movementTypeColors[item.type] || "#6b7280",
                        }}
                      />
                      <span>{movementTypeLabels[item.type] || item.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{item.count}</span>
                      <span className="ml-2 text-muted-foreground">
                        ({item.totalQuantity.toLocaleString()} units)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface MovementTypeChartProps {
  data: MovementsByType[];
  isLoading?: boolean;
}

export function MovementTypeChart({
  data,
  isLoading = false,
}: MovementTypeChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: movementTypeLabels[d.type] || d.type,
      fill: movementTypeColors[d.type] || "#6b7280",
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Movements by Type</CardTitle>
        </CardHeader>
        <CardContent className="flex h-50 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Movements by Type</CardTitle>
        </CardHeader>
        <CardContent className="flex h-50 items-center justify-center text-muted-foreground">
          No movement data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movements by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              horizontal={false}
            />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12 }}
              width={100}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-lg">
                    <p className="font-medium">{data.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {data.count} movements
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.totalQuantity.toLocaleString()} total units
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
