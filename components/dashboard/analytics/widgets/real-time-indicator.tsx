"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealTimeMetrics } from "@/lib/db/queries/analytics";

interface RealTimeIndicatorProps {
  data?: RealTimeMetrics;
  isLoading?: boolean;
  isError?: boolean;
  currency?: string;
}

export function RealTimeIndicator({
  data,
  isLoading = false,
  isError = false,
  currency = "AFN",
}: RealTimeIndicatorProps) {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "No orders yet";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background p-3">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex size-3">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              isError ? "bg-red-400" : "bg-green-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex size-3 rounded-full",
              isError ? "bg-red-500" : "bg-green-500"
            )}
          />
        </span>
        <span className="text-sm font-medium">Live</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Loading...</span>
        </div>
      ) : isError ? (
        <div className="text-sm text-red-500">Connection error</div>
      ) : data ? (
        <>
          {/* Today's orders */}
          <div className="flex items-center gap-1.5 border-l pl-4">
            <Activity className="size-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{data.ordersToday}</span>
              <span className="text-muted-foreground"> orders today</span>
            </span>
          </div>

          {/* Today's revenue */}
          <div className="hidden sm:flex items-center gap-1.5 border-l pl-4">
            <span className="text-sm">
              <span className="font-medium">
                {(data.revenueToday || 0).toLocaleString()} {currency}
              </span>
              <span className="text-muted-foreground"> revenue</span>
            </span>
          </div>

          {/* Last order time */}
          <div className="hidden md:flex items-center gap-1.5 border-l pl-4 text-sm text-muted-foreground">
            Last order: {formatTime(data.lastOrderAt)}
          </div>
        </>
      ) : null}
    </div>
  );
}
