"use client";

import {
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { useMemo } from "react";
import type { TimeRange } from "@/lib/db/queries/analytics";

// ============================================================================
// Filter Parsers
// ============================================================================

const timeRangeValues: string[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "this_year",
  "custom",
];

const tabValues: string[] = [
  "overview",
  "products",
  "customers",
  "conversions",
];

const granularityValues: string[] = ["hour", "day", "week", "month"];

export const analyticsFilterParsers = {
  // Time range preset
  range: parseAsStringEnum(timeRangeValues).withDefault("7d"),

  // Custom date range (ISO date strings)
  start: parseAsString,
  end: parseAsString,

  // Data granularity
  granularity: parseAsStringEnum(granularityValues).withDefault("day"),

  // Active tab
  tab: parseAsStringEnum(tabValues).withDefault("overview"),

  // Product filter
  product: parseAsString,

  // Category filter
  category: parseAsString,
};

// Serializer for creating URLs with filters
export const analyticsFilterSerializer = createSerializer(
  analyticsFilterParsers
);

// ============================================================================
// Types
// ============================================================================

export type AnalyticsFilters = {
  range: TimeRange | "custom";
  start: string | null;
  end: string | null;
  granularity: "hour" | "day" | "week" | "month";
  tab: "overview" | "products" | "customers" | "conversions";
  product: string | null;
  category: string | null;
};

export type AnalyticsFilterSetters = {
  setRange: (value: TimeRange | "custom") => void;
  setDateRange: (start: string, end: string) => void;
  setGranularity: (value: "hour" | "day" | "week" | "month") => void;
  setTab: (
    value: "overview" | "products" | "customers" | "conversions"
  ) => void;
  setProduct: (value: string | null) => void;
  setCategory: (value: string | null) => void;
  resetFilters: () => void;
};

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for managing analytics page filters via URL state
 * Uses nuqs for type-safe URL query parameter management
 *
 * @example
 * ```tsx
 * const { filters, setRange, setTab } = useAnalyticsFilters();
 *
 * // Access current filters
 * console.log(filters.range); // "7d"
 *
 * // Update filters (automatically updates URL)
 * setRange("30d");
 * setTab("products");
 * ```
 */
export function useAnalyticsFilters(): {
  filters: AnalyticsFilters;
} & AnalyticsFilterSetters {
  const [state, setState] = useQueryStates(analyticsFilterParsers, {
    shallow: false, // Trigger server component re-render
  });

  // Memoized setters to prevent unnecessary re-renders
  const setters = useMemo<AnalyticsFilterSetters>(
    () => ({
      setRange: (value) => {
        if (value === "custom") {
          setState({ range: value });
        } else {
          // When selecting a preset, clear custom dates
          setState({ range: value, start: null, end: null });
        }
      },

      setDateRange: (start, end) => {
        setState({ range: "custom", start, end });
      },

      setGranularity: (value) => {
        setState({ granularity: value });
      },

      setTab: (value) => {
        setState({ tab: value });
      },

      setProduct: (value) => {
        setState({ product: value });
      },

      setCategory: (value) => {
        setState({ category: value });
      },

      resetFilters: () => {
        setState({
          range: "7d",
          start: null,
          end: null,
          granularity: "day",
          tab: "overview",
          product: null,
          category: null,
        });
      },
    }),
    [setState]
  );

  return {
    filters: state as AnalyticsFilters,
    ...setters,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the effective date range from filters
 * Returns start and end dates based on preset or custom range
 */
export function getEffectiveDateRange(filters: AnalyticsFilters): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Handle custom range
  if (filters.range === "custom" && filters.start && filters.end) {
    return {
      start: new Date(filters.start),
      end: new Date(filters.end),
    };
  }

  // Handle presets
  switch (filters.range) {
    case "today":
      return { start: today, end: now };

    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }

    case "7d": {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: now };
    }

    case "30d": {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { start: monthAgo, end: now };
    }

    case "90d": {
      const quarterAgo = new Date(today);
      quarterAgo.setDate(quarterAgo.getDate() - 90);
      return { start: quarterAgo, end: now };
    }

    case "this_month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart, end: now };
    }

    case "last_month": {
      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: lastMonthStart, end: thisMonthStart };
    }

    case "this_year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { start: yearStart, end: now };
    }

    default:
      // Default to 7d
      const defaultStart = new Date(today);
      defaultStart.setDate(defaultStart.getDate() - 7);
      return { start: defaultStart, end: now };
  }
}

/**
 * Format a date range for display
 */
export function formatDateRangeDisplay(filters: AnalyticsFilters): string {
  if (filters.range === "custom" && filters.start && filters.end) {
    const start = new Date(filters.start);
    const end = new Date(filters.end);
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  const labels: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    this_month: "This month",
    last_month: "Last month",
    this_year: "This year",
  };

  return labels[filters.range] || "Last 7 days";
}

/**
 * Check if filters have any active non-default values
 */
export function hasActiveFilters(filters: AnalyticsFilters): boolean {
  return (
    filters.range !== "7d" ||
    filters.product !== null ||
    filters.category !== null
  );
}
