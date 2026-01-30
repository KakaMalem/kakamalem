"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryPerformance } from "@/lib/db/queries/analytics";

interface CategoryDistributionChartProps {
  data: CategoryPerformance[];
  currency: string;
}

// Color palette for chart segments
const COLORS = [
  "hsl(var(--primary))",
  "hsl(210 100% 50%)",
  "hsl(280 100% 50%)",
  "hsl(30 100% 50%)",
  "hsl(160 100% 40%)",
  "hsl(350 100% 50%)",
  "hsl(45 100% 50%)",
  "hsl(190 100% 45%)",
];

export function CategoryDistributionChart({
  data,
  currency,
}: CategoryDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No category data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-4">
          {/* Chart */}
          <div className="w-full lg:w-2/3">
            <ResponsiveContainer width="100%" height={280} minHeight={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={activeIndex !== null ? 105 : 100}
                  dataKey="revenue"
                  nameKey="categoryName"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      className="cursor-pointer outline-none transition-all"
                      style={{
                        opacity:
                          activeIndex === null || activeIndex === index
                            ? 1
                            : 0.6,
                        transform:
                          activeIndex === index ? "scale(1.02)" : "scale(1)",
                        transformOrigin: "center",
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as CategoryPerformance;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium">
                          {item.categoryName}
                        </p>
                        <p className="text-sm text-primary">
                          {Number.isFinite(item.revenue)
                            ? item.revenue.toLocaleString()
                            : 0}{" "}
                          {currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Number.isFinite(item.percentOfTotal)
                            ? item.percentOfTotal.toFixed(1)
                            : "0.0"}
                          % of total
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.orders || 0} orders, {item.quantitySold || 0}{" "}
                          units
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="w-full lg:w-1/3 space-y-2">
            {data.map((category, index) => (
              <div
                key={category.categoryId}
                className={`flex items-center justify-between rounded-lg p-2 transition-colors cursor-pointer ${
                  activeIndex === index ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium truncate max-w-32">
                    {category.categoryName}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {Number.isFinite(category.percentOfTotal)
                    ? category.percentOfTotal.toFixed(1)
                    : "0.0"}
                  %
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
