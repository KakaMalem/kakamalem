"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface OrdersListSkeletonProps {
  count?: number;
}

/**
 * Skeleton loading state for orders list
 * Matches the layout of OrderCard from orders-list.tsx
 */
export function OrdersListSkeleton({ count = 6 }: OrdersListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

function OrderCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Order info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Order number and date */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Customer name */}
            <Skeleton className="h-4 w-40" />

            {/* Items count and total */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Right side - badges and amount */}
          <div className="flex flex-col items-end gap-2">
            {/* Status badge */}
            <Skeleton className="h-5 w-20 rounded-full" />
            {/* Channel badge */}
            <Skeleton className="h-5 w-16 rounded-full" />
            {/* Total amount */}
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for the filters section
 */
export function OrdersFiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search input */}
      <Skeleton className="h-9 flex-1 min-w-50 sm:max-w-sm" />
      {/* Date range */}
      <Skeleton className="h-9 w-36" />
      {/* Status */}
      <Skeleton className="h-9 w-40" />
      {/* Sort */}
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

/**
 * Full page skeleton (header + filters + list)
 */
export function OrdersPageSkeleton({ itemCount = 6 }: { itemCount?: number }) {
  return (
    <div className="space-y-4 pb-36">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-35" />
      </div>

      {/* Filters */}
      <OrdersFiltersSkeleton />

      {/* Orders List */}
      <OrdersListSkeleton count={itemCount} />
    </div>
  );
}
