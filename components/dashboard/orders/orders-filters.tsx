"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useState,
  useTransition,
  useSyncExternalStore,
  useEffect,
  useCallback,
} from "react";
import { Search, X, Calendar, ArrowUpDown } from "lucide-react";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  OrderCounts,
  OrderStatus,
  OrderChannel,
} from "@/lib/db/queries/orders";

interface OrdersFiltersProps {
  storeSlug: string;
  orderCounts: OrderCounts;
  currentStatus?: string;
  currentDateRange?: string;
  currentSort?: string;
  currentOrder?: string;
}

type StatusOption = "all" | OrderStatus;
type ChannelOption = "all" | OrderChannel;
type DateRangeOption =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month";
type SortOption = "newest" | "oldest" | "highest" | "lowest";

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

const CHANNEL_OPTIONS: { value: ChannelOption; label: string }[] = [
  { value: "all", label: "All Channels" },
  { value: "online", label: "Online" },
  { value: "pos", label: "In-Store" },
];

const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest value" },
  { value: "lowest", label: "Lowest value" },
];

/**
 * Get date range (dateFrom, dateTo) for a given range option
 */
function getDateRange(range: DateRangeOption): {
  dateFrom?: string;
  dateTo?: string;
} {
  const now = new Date();

  switch (range) {
    case "today":
      return {
        dateFrom: format(startOfDay(now), "yyyy-MM-dd"),
        dateTo: format(endOfDay(now), "yyyy-MM-dd"),
      };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return {
        dateFrom: format(startOfDay(yesterday), "yyyy-MM-dd"),
        dateTo: format(endOfDay(yesterday), "yyyy-MM-dd"),
      };
    }
    case "7d":
      return {
        dateFrom: format(startOfDay(subDays(now, 6)), "yyyy-MM-dd"),
        dateTo: format(endOfDay(now), "yyyy-MM-dd"),
      };
    case "30d":
      return {
        dateFrom: format(startOfDay(subDays(now, 29)), "yyyy-MM-dd"),
        dateTo: format(endOfDay(now), "yyyy-MM-dd"),
      };
    case "this_month":
      return {
        dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
        dateTo: format(endOfDay(now), "yyyy-MM-dd"),
      };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return {
        dateFrom: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        dateTo: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    default:
      return {};
  }
}

/**
 * Get sort params (sort, order) for a given sort option
 */
function getSortParams(sortOption: SortOption): {
  sort: string;
  order: string;
} {
  switch (sortOption) {
    case "newest":
      return { sort: "createdAt", order: "desc" };
    case "oldest":
      return { sort: "createdAt", order: "asc" };
    case "highest":
      return { sort: "total", order: "desc" };
    case "lowest":
      return { sort: "total", order: "asc" };
    default:
      return { sort: "createdAt", order: "desc" };
  }
}

/**
 * Determine current sort option from URL params
 */
function getCurrentSortOption(sort?: string, order?: string): SortOption {
  if (sort === "total" && order === "desc") return "highest";
  if (sort === "total" && order === "asc") return "lowest";
  if (sort === "createdAt" && order === "asc") return "oldest";
  return "newest"; // default
}

export function OrdersFilters({
  storeSlug,
  orderCounts,
  currentStatus,
  currentDateRange,
  currentSort,
  currentOrder,
}: OrdersFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Hydration fix: only render Select after mount
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeStatus = (currentStatus as StatusOption) || "all";
  const activeDateRange = (currentDateRange as DateRangeOption) || "all";
  const activeSort = getCurrentSortOption(currentSort, currentOrder);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Update URL when debounced search changes
  useEffect(() => {
    const currentSearch = searchParams.get("search") || "";
    if (debouncedSearch !== currentSearch) {
      updateParams({ search: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.set("page", "1");

      // Preserve limit if set
      const currentLimit = searchParams.get("limit");
      if (currentLimit && currentLimit !== "25") {
        params.set("limit", currentLimit);
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      startTransition(() => {
        router.push(`/dashboard/${storeSlug}/orders?${params.toString()}`);
      });
    },
    [searchParams, storeSlug, router]
  );

  const handleStatusChange = (status: StatusOption) => {
    updateParams({ status: status === "all" ? undefined : status });
  };

  const handleDateRangeChange = (range: DateRangeOption) => {
    const { dateFrom, dateTo } = getDateRange(range);
    updateParams({
      dateRange: range === "all" ? undefined : range,
      dateFrom,
      dateTo,
    });
  };

  const handleSortChange = (sortOption: SortOption) => {
    const { sort, order } = getSortParams(sortOption);
    // Only add to URL if not the default (newest)
    updateParams({
      sort: sortOption === "newest" ? undefined : sort,
      order: sortOption === "newest" ? undefined : order,
    });
  };

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    updateParams({ search: undefined });
  };

  const getStatusCount = (status: StatusOption): number => {
    if (status === "all") return orderCounts.total;
    return orderCounts[status as keyof OrderCounts] || 0;
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="flex-1 min-w-50 sm:max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
              onClick={clearSearch}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Select */}
      {mounted ? (
        <Select
          value={activeDateRange}
          onValueChange={(value) =>
            handleDateRangeChange(value as DateRangeOption)
          }
          disabled={isPending}
        >
          <SelectTrigger className="w-36">
            <Calendar className="size-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Skeleton className="h-9 w-36" />
      )}

      {/* Status Select */}
      {mounted ? (
        <Select
          value={activeStatus}
          onValueChange={(value) => handleStatusChange(value as StatusOption)}
          disabled={isPending}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} ({getStatusCount(option.value)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Skeleton className="h-9 w-40" />
      )}

      {/* Sort Select */}
      {mounted ? (
        <Select
          value={activeSort}
          onValueChange={(value) => handleSortChange(value as SortOption)}
          disabled={isPending}
        >
          <SelectTrigger className="w-36">
            <ArrowUpDown className="size-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Skeleton className="h-9 w-36" />
      )}
    </div>
  );
}

// Export channel filter as separate component for use in header
export function OrdersChannelFilter({
  storeSlug,
  orderCounts,
  currentChannel,
}: {
  storeSlug: string;
  orderCounts: OrderCounts;
  currentChannel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeChannel = (currentChannel as ChannelOption) || "all";

  const handleChannelChange = (channel: ChannelOption) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    const currentLimit = searchParams.get("limit");
    if (currentLimit && currentLimit !== "25") {
      params.set("limit", currentLimit);
    }

    if (channel === "all") {
      params.delete("channel");
    } else {
      params.set("channel", channel);
    }

    startTransition(() => {
      router.push(`/dashboard/${storeSlug}/orders?${params.toString()}`);
    });
  };

  const getChannelCount = (channel: ChannelOption): number => {
    if (channel === "all") return orderCounts.total;
    return orderCounts[channel as keyof OrderCounts] || 0;
  };

  if (!mounted) {
    return <Skeleton className="h-9 w-35" />;
  }

  return (
    <Select
      value={activeChannel}
      onValueChange={(value) => handleChannelChange(value as ChannelOption)}
      disabled={isPending}
    >
      <SelectTrigger className="w-35">
        <SelectValue placeholder="Channel" />
      </SelectTrigger>
      <SelectContent>
        {CHANNEL_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label} ({getChannelCount(option.value)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
