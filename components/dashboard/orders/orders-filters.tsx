"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  useState,
  useTransition,
  useSyncExternalStore,
  useEffect,
  useCallback,
} from "react";
import { Search, X } from "lucide-react";
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
import type { OrderCounts, OrderStatus } from "@/lib/db/queries/orders";

interface OrdersFiltersProps {
  orderCounts: OrderCounts;
  currentStatus?: string;
}

type StatusOption = "all" | OrderStatus;

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Preparing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Completed" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

export function OrdersFilters({
  orderCounts,
  currentStatus,
}: OrdersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
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
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname]
  );

  const handleStatusChange = (status: StatusOption) => {
    updateParams({ status: status === "all" ? undefined : status });
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
    <div className="flex flex-row gap-3 w-full">
      {/* Search */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8 w-full"
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

      {/* Status Select */}
      <div className="w-[140px] sm:w-[180px] shrink-0">
        {mounted ? (
          <Select
            value={activeStatus}
            onValueChange={(value) => handleStatusChange(value as StatusOption)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
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
          <Skeleton className="h-9 w-full" />
        )}
      </div>
    </div>
  );
}
