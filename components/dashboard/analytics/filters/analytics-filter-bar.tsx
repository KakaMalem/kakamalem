"use client";

import { AnalyticsDateRangePicker } from "./analytics-date-range-picker";
import type { TimeRange } from "@/lib/db/queries/analytics";

interface AnalyticsFilterBarProps {
  timeRange: TimeRange;
  customStart?: string | null;
  customEnd?: string | null;
  onTimeRangeChange: (range: TimeRange) => void;
  onCustomRangeChange: (start: string, end: string) => void;
  children?: React.ReactNode;
}

export function AnalyticsFilterBar({
  timeRange,
  customStart,
  customEnd,
  onTimeRangeChange,
  onCustomRangeChange,
  children,
}: AnalyticsFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <AnalyticsDateRangePicker
          value={timeRange}
          customStart={customStart}
          customEnd={customEnd}
          onPresetChange={onTimeRangeChange}
          onCustomRangeChange={onCustomRangeChange}
        />
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
