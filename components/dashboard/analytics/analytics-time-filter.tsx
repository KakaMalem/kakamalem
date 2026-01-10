"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeRange } from "@/lib/db/queries/analytics";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

interface AnalyticsTimeFilterProps {
  storeSlug: string;
  currentRange: TimeRange;
}

export function AnalyticsTimeFilter({
  storeSlug,
  currentRange,
}: AnalyticsTimeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleRangeChange = (range: TimeRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (range === "7d") {
      params.delete("range");
    } else {
      params.set("range", range);
    }

    const queryString = params.toString();
    const url = `/dashboard/${storeSlug}/analytics${queryString ? `?${queryString}` : ""}`;

    startTransition(() => {
      router.push(url);
    });
  };

  return (
    <Select
      value={currentRange}
      onValueChange={(v) => handleRangeChange(v as TimeRange)}
      disabled={isPending}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIME_RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
