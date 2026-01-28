"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SparklineDataPoint {
  value: number;
}

interface AnalyticsKPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  sparklineData?: SparklineDataPoint[];
  trend?: "up" | "down" | "neutral";
  className?: string;
  valueClassName?: string;
}

export function AnalyticsKPICard({
  title,
  value,
  change,
  changeLabel = "vs previous period",
  icon,
  sparklineData,
  trend,
  className,
  valueClassName,
}: AnalyticsKPICardProps) {
  // Determine trend from change if not provided
  const effectiveTrend =
    trend ||
    (change && change > 0 ? "up" : change && change < 0 ? "down" : "neutral");

  // Get chart color based on trend
  const chartColor =
    effectiveTrend === "up"
      ? "hsl(142.1 76.2% 36.3%)" // green
      : effectiveTrend === "down"
        ? "hsl(0 84.2% 60.2%)" // red
        : "hsl(var(--primary))";

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "text-2xl font-bold tracking-tight",
                valueClassName
              )}
            >
              {value}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {effectiveTrend === "up" ? (
                  <TrendingUp className="size-4 text-green-600" />
                ) : effectiveTrend === "down" ? (
                  <TrendingDown className="size-4 text-red-600" />
                ) : null}
                <span
                  className={cn(
                    effectiveTrend === "up" && "text-green-600",
                    effectiveTrend === "down" && "text-red-600",
                    effectiveTrend === "neutral" && "text-muted-foreground"
                  )}
                >
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                <span className="text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-50">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient
                    id={`gradient-${title}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={chartColor}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={chartColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
