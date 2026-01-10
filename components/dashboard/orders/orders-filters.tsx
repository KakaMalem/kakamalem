"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderCounts, OrderStatus } from "@/lib/db/queries/orders";

interface OrdersFiltersProps {
  storeSlug: string;
  orderCounts: OrderCounts;
  currentStatus?: string;
}

type StatusOption = "all" | OrderStatus;

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
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

  const getCount = (status: StatusOption): number => {
    if (status === "all") return orderCounts.total;
    return orderCounts[status as keyof OrderCounts] || 0;
  };

  return (
    <div className="flex gap-4 items-center justify-between">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 sm:max-w-sm">
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
      <Select
        value={activeStatus}
        onValueChange={(value) => handleStatusChange(value as StatusOption)}
        disabled={isPending}
      >
        <SelectTrigger className="">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label} ({getCount(option.value)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
