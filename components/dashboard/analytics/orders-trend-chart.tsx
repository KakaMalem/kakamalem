"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyAnalyticsPoint } from "@/lib/db/queries/analytics";

interface OrdersTrendChartProps {
  data: DailyAnalyticsPoint[];
}

export function OrdersTrendChart({ data }: OrdersTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const hasData = data.length > 0 && data.some((d) => d.orders > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-75 items-center justify-center text-muted-foreground">
            No orders for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="displayDate"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <p className="text-sm font-medium">{d.displayDate}</p>
                      <p className="text-sm text-primary">Orders: {d.orders}</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="orders"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
