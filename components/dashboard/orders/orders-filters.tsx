"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  SalesChannel,
} from "@/lib/db/queries/orders";

interface OrdersFiltersProps {
  storeSlug: string;
  orderCounts: OrderCounts;
  currentStatus?: string;
}

type StatusOption = "all" | OrderStatus;
type ChannelOption = "all" | SalesChannel;

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const CHANNEL_OPTIONS: { value: ChannelOption; label: string }[] = [
  { value: "all", label: "All Channels" },
  { value: "online", label: "Online" },
  { value: "offline", label: "In-Store" },
  { value: "phone", label: "Phone" },
];

export function OrdersFilters({
  storeSlug,
  orderCounts,
  currentStatus,
}: OrdersFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  // Hydration fix: only render Select after mount
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeStatus = (currentStatus as StatusOption) || "all";

  const updateParams = (updates: Record<string, string | undefined>) => {
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
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: search || undefined });
  };

  const handleStatusChange = (status: StatusOption) => {
    updateParams({ status: status === "all" ? undefined : status });
  };

  const getStatusCount = (status: StatusOption): number => {
    if (status === "all") return orderCounts.total;
    return orderCounts[status as keyof OrderCounts] || 0;
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 min-w-50 sm:max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </form>

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
