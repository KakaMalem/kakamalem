"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { parseDate, safeFormat } from "@/lib/utils/safe-date";
import type { DateRange } from "react-day-picker";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  History,
  Search,
  X,
  CalendarIcon,
  Filter,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { StockMovementChart, MovementTypeChart } from "./stock-movement-chart";
import { HistoryExport } from "./inventory-export";

import type {
  InventoryMovementWithDetails,
  StockMovementTrend,
  MovementsByType,
} from "@/lib/db/queries/inventory";

const movementTypeLabels: Record<string, string> = {
  adjustment: "Manual Adjustment",
  sale: "Sale",
  return: "Return",
  restock: "Restock",
  reserved: "Reserved",
  released: "Released",
};

const movementTypeColors: Record<string, string> = {
  adjustment: "bg-blue-100 text-blue-800",
  sale: "bg-red-100 text-red-800",
  return: "bg-green-100 text-green-800",
  restock: "bg-green-100 text-green-800",
  reserved: "bg-yellow-100 text-yellow-800",
  released: "bg-gray-100 text-gray-800",
};

interface InventoryHistoryClientProps {
  storeSlug: string;
  storeName: string;
  movements: InventoryMovementWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stockTrends: StockMovementTrend[];
  movementsByType: MovementsByType[];
  currentFilters: {
    type?: string;
    productId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  };
}

export function InventoryHistoryClient({
  storeSlug,
  storeName,
  movements,
  pagination,
  stockTrends,
  movementsByType,
  currentFilters,
}: InventoryHistoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (currentFilters.startDate && currentFilters.endDate) {
      return {
        from: new Date(currentFilters.startDate),
        to: new Date(currentFilters.endDate),
      };
    }
    return undefined;
  });

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page"); // Reset to page 1
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const applyDateRange = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (dateRange?.from) {
      params.set("startDate", startOfDay(dateRange.from).toISOString());
    } else {
      params.delete("startDate");
    }
    if (dateRange?.to) {
      params.set("endDate", endOfDay(dateRange.to).toISOString());
    } else {
      params.delete("endDate");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [dateRange, router, pathname, searchParams]);

  const clearDateRange = useCallback(() => {
    setDateRange(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("startDate");
    params.delete("endDate");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const setQuickDateRange = useCallback(
    (days: number) => {
      const to = new Date();
      const from = subDays(to, days);
      setDateRange({ from, to });
      const params = new URLSearchParams(searchParams.toString());
      params.set("startDate", startOfDay(from).toISOString());
      params.set("endDate", endOfDay(to).toISOString());
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const formatDate = (date: string) => {
    const d = parseDate(date);
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const hasActiveFilters =
    currentFilters.type ||
    currentFilters.productId ||
    currentFilters.search ||
    currentFilters.startDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventory History
          </h1>
          <p className="text-muted-foreground">
            Track all stock changes and movements.
          </p>
        </div>
        <div className="flex gap-2">
          <HistoryExport movements={movements} storeName={storeName} />
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${storeSlug}/inventory`}>
              <ChevronLeft className="mr-2 size-4" />
              Back to Inventory
            </Link>
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StockMovementChart
            data={stockTrends}
            movementsByType={movementsByType}
          />
        </div>
        <MovementTypeChart data={movementsByType} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-50 flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search product..."
                defaultValue={currentFilters.search || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  const timeoutId = setTimeout(() => {
                    updateFilter("search", value);
                  }, 300);
                  return () => clearTimeout(timeoutId);
                }}
                className="pl-9"
              />
            </div>

            {/* Type Filter */}
            <Select
              value={currentFilters.type || "all"}
              onValueChange={(value) => updateFilter("type", value)}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Movement Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(movementTypeLabels).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-50">
                  <CalendarIcon className="size-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} -{" "}
                        {format(dateRange.to, "MMM d")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex gap-2 border-b p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickDateRange(7)}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickDateRange(30)}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickDateRange(90)}
                  >
                    Last 90 days
                  </Button>
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                />
                <div className="flex justify-end gap-2 border-t p-2">
                  <Button variant="ghost" size="sm" onClick={clearDateRange}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={applyDateRange}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Clear All */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(pathname)}
              >
                <X className="mr-1 size-4" />
                Clear All
              </Button>
            )}
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Active filters:
              </span>
              {currentFilters.type && (
                <Badge variant="secondary" className="gap-1">
                  Type: {movementTypeLabels[currentFilters.type]}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 size-4 p-0 hover:bg-transparent"
                    onClick={() => updateFilter("type", null)}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              {currentFilters.search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {currentFilters.search}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 size-4 p-0 hover:bg-transparent"
                    onClick={() => updateFilter("search", null)}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              {currentFilters.startDate && (
                <Badge variant="secondary" className="gap-1">
                  Date: {safeFormat(currentFilters.startDate, "MMM d")}
                  {currentFilters.endDate &&
                    ` - ${safeFormat(currentFilters.endDate, "MMM d")}`}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 size-4 p-0 hover:bg-transparent"
                    onClick={clearDateRange}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movements List */}
      {movements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No inventory movements</h3>
            <p className="text-center text-muted-foreground">
              {hasActiveFilters
                ? "No movements match your current filters."
                : "Stock changes will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movements.map((movement) => (
            <Card key={movement.id}>
              <CardContent className="flex items-center gap-4 p-4">
                {/* Movement Icon */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    movement.quantity > 0
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {movement.quantity > 0 ? (
                    <ArrowUp className="size-5" />
                  ) : (
                    <ArrowDown className="size-5" />
                  )}
                </div>

                {/* Movement Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/${storeSlug}/products/${movement.productId}`}
                      className="font-medium hover:underline"
                    >
                      {movement.productName}
                    </Link>
                    {movement.variantDisplayName && (
                      <Badge variant="outline" className="text-xs">
                        {movement.variantDisplayName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                        movementTypeColors[movement.type] || "bg-gray-100"
                      }`}
                    >
                      {movementTypeLabels[movement.type] || movement.type}
                    </span>
                    {movement.reason && <span>{movement.reason}</span>}
                    {movement.userName && <span>by {movement.userName}</span>}
                  </div>
                </div>

                {/* Stock Change */}
                <div className="shrink-0 text-right">
                  <p
                    className={`text-lg font-bold ${
                      movement.quantity > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movement.previousStock} → {movement.newStock}
                  </p>
                </div>

                {/* Date */}
                <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                  {formatDate(movement.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} movements
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page - 1));
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page + 1));
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
