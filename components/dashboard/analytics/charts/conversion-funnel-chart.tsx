"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConversionFunnelData } from "@/lib/db/queries/analytics";

interface ConversionFunnelChartProps {
  data: ConversionFunnelData[];
}

// Colors for funnel stages (progressively darker)
const STAGE_COLORS = [
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/70",
  "bg-primary",
];

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No funnel data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate widths based on counts (first stage = 100%)
  const maxCount = data[0]?.count || 1;
  const stages = data.map((stage, index) => ({
    ...stage,
    widthPercent: Math.max((stage.count / maxCount) * 100, 10), // Minimum 10% width for visibility
    color: STAGE_COLORS[index] || STAGE_COLORS[STAGE_COLORS.length - 1],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.stage} className="space-y-2">
              {/* Stage header */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {stage.count.toLocaleString()}
                  </span>
                  {index > 0 && (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        stage.dropoffPercent > 50
                          ? "bg-red-100 text-red-700"
                          : stage.dropoffPercent > 30
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                      )}
                    >
                      -{stage.dropoffPercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Funnel bar */}
              <div className="relative h-10">
                <div
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 h-full rounded-lg transition-all",
                    stage.color
                  )}
                  style={{ width: `${stage.widthPercent}%` }}
                />
              </div>

              {/* Drop-off indicator (except for last stage) */}
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="h-4 w-px bg-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground">
                    {stage.dropoff.toLocaleString()} dropped off
                  </span>
                  <div className="h-4 w-px bg-muted-foreground/30" />
                </div>
              )}
            </div>
          ))}

          {/* Overall conversion rate */}
          {data.length >= 2 && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Overall Conversion Rate
                </span>
                <span className="text-lg font-bold text-primary">
                  {(
                    (data[data.length - 1].count / data[0].count) *
                    100
                  ).toFixed(2)}
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data[0].label} to {data[data.length - 1].label}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
