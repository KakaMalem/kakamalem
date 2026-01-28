"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeRange } from "@/lib/db/queries/analytics";

// Preset time ranges
const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
] as const;

interface AnalyticsDateRangePickerProps {
  value: TimeRange;
  customStart?: string | null;
  customEnd?: string | null;
  onPresetChange: (preset: TimeRange) => void;
  onCustomRangeChange: (start: string, end: string) => void;
  className?: string;
}

export function AnalyticsDateRangePicker({
  value,
  customStart,
  customEnd,
  onPresetChange,
  onCustomRangeChange,
  className,
}: AnalyticsDateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"presets" | "custom">(
    value === "custom" ? "custom" : "presets"
  );
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    customStart && customEnd
      ? { from: new Date(customStart), to: new Date(customEnd) }
      : undefined
  );

  // Get display label
  const getDisplayLabel = () => {
    if (value === "custom" && customStart && customEnd) {
      const from = new Date(customStart);
      const to = new Date(customEnd);
      return `${format(from, "MMM d")} - ${format(to, "MMM d")}`;
    }
    return PRESETS.find((p) => p.value === value)?.label || "Last 7 days";
  };

  // Handle preset selection
  const handlePresetClick = (preset: (typeof PRESETS)[number]["value"]) => {
    onPresetChange(preset);
    setOpen(false);
  };

  // Handle custom range selection
  const handleRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range);
  };

  // Apply custom range
  const applyCustomRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onCustomRangeChange(
        tempRange.from.toISOString().split("T")[0],
        tempRange.to.toISOString().split("T")[0]
      );
      setOpen(false);
    }
  };

  // Reset temp range when opening
  React.useEffect(() => {
    if (open) {
      setActiveTab(value === "custom" ? "custom" : "presets");
      if (customStart && customEnd) {
        setTempRange({ from: new Date(customStart), to: new Date(customEnd) });
      }
    }
  }, [open, value, customStart, customEnd]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-auto min-w-40 justify-between text-left font-normal",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="truncate">{getDisplayLabel()}</span>
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
        align="end"
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "presets" | "custom")}
        >
          <div className="border-b px-3 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="presets" className="flex-1">
                Presets
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                Custom
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Presets tab */}
          <TabsContent value="presets" className="m-0">
            <div className="grid grid-cols-2 gap-1 p-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={value === preset.value ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => handlePresetClick(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Custom tab */}
          <TabsContent value="custom" className="m-0">
            <div className="p-3">
              {/* Selected range display */}
              {tempRange?.from && (
                <div className="mb-3 rounded-md bg-muted px-3 py-2 text-center text-sm">
                  {tempRange.from && format(tempRange.from, "MMM d, yyyy")}
                  {tempRange.to && ` – ${format(tempRange.to, "MMM d, yyyy")}`}
                </div>
              )}

              {/* Calendar - 1 month on mobile, 2 on larger screens */}
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={handleRangeSelect}
                numberOfMonths={1}
                disabled={{ after: new Date() }}
                defaultMonth={
                  tempRange?.from ||
                  new Date(new Date().setMonth(new Date().getMonth() - 1))
                }
                className="sm:hidden"
              />
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                defaultMonth={
                  tempRange?.from ||
                  new Date(new Date().setMonth(new Date().getMonth() - 1))
                }
                className="hidden sm:block"
              />

              {/* Actions */}
              <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTempRange(undefined)}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={applyCustomRange}
                  disabled={!tempRange?.from || !tempRange?.to}
                >
                  Apply
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
