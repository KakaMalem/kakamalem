"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HeatmapData } from "@/lib/db/queries/analytics";
import { cn } from "@/lib/utils";

interface SalesHeatmapProps {
  data: HeatmapData[];
  metric?: "orders" | "revenue";
  currency?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getHeatmapColor(value: number, max: number): string {
  if (max === 0) return "bg-muted";
  const intensity = value / max;

  if (intensity === 0) return "bg-muted";
  if (intensity < 0.2) return "bg-primary/20";
  if (intensity < 0.4) return "bg-primary/40";
  if (intensity < 0.6) return "bg-primary/60";
  if (intensity < 0.8) return "bg-primary/80";
  return "bg-primary";
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}${period}`;
}

export function SalesHeatmap({
  data,
  metric = "orders",
  currency = "AFN",
}: SalesHeatmapProps) {
  // Create a lookup map for quick access
  const heatmapLookup = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => {
      map.set(`${d.dayOfWeek}-${d.hour}`, d.value);
    });
    return map;
  }, [data]);

  // Find max value for color scaling
  const maxValue = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map((d) => d.value));
  }, [data]);

  // Get value for a specific cell
  const getValue = (day: number, hour: number): number => {
    return heatmapLookup.get(`${day}-${hour}`) || 0;
  };

  // Format tooltip value
  const formatValue = (value: number): string => {
    if (metric === "revenue") {
      return `${value.toLocaleString()} ${currency}`;
    }
    return `${value} ${value === 1 ? "order" : "orders"}`;
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales by Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No timing data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10" /> {/* Spacer for day labels */}
              {HOURS.filter((_, i) => i % 3 === 0).map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-muted-foreground"
                  style={{ width: `${(3 / 24) * 100}%` }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <TooltipProvider>
              <div className="space-y-1">
                {DAYS.map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-1">
                    <div className="w-10 text-xs text-muted-foreground">
                      {day}
                    </div>
                    <div className="flex flex-1 gap-0.5">
                      {HOURS.map((hour) => {
                        const value = getValue(dayIndex, hour);
                        return (
                          <Tooltip key={hour}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "flex-1 h-6 rounded-sm transition-colors cursor-pointer hover:ring-2 hover:ring-primary/50",
                                  getHeatmapColor(value, maxValue)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {day} {formatHour(hour)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatValue(value)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs text-muted-foreground">Less</span>
              <div className="flex gap-0.5">
                <div className="size-4 rounded-sm bg-muted" />
                <div className="size-4 rounded-sm bg-primary/20" />
                <div className="size-4 rounded-sm bg-primary/40" />
                <div className="size-4 rounded-sm bg-primary/60" />
                <div className="size-4 rounded-sm bg-primary/80" />
                <div className="size-4 rounded-sm bg-primary" />
              </div>
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
