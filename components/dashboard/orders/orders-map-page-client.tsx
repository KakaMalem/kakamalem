"use client";

import { useMemo } from "react";
import { OrdersFilters } from "./orders-filters";
import { Map as MapIcon } from "lucide-react";
import type { DashboardOrder, OrderCounts } from "@/lib/db/queries/orders";
import dynamic from "next/dynamic";

import type { OrdersMapProps } from "@/components/dashboard/orders/orders-map-wrapper";

const OrdersMapWrapper = dynamic<OrdersMapProps>(
  () => import("@/components/dashboard/orders/orders-map-wrapper"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-280px)] rounded-xl border bg-muted animate-pulse flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);

interface OrdersMapPageClientProps {
  storeSlug: string;
  currency: string;
  orders: DashboardOrder[];
  orderCounts: OrderCounts;
  searchParams: Record<string, string | undefined>;
}

export function OrdersMapPageClient({
  storeSlug,
  currency,
  orders,
  orderCounts,
  searchParams,
}: OrdersMapPageClientProps) {
  // Filter orders that have coordinates
  const ordersWithLocation = useMemo(() => {
    return orders.filter(
      (order) =>
        order.shippingAddress?.latitude && order.shippingAddress?.longitude
    );
  }, [orders]);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-140px)]">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-zinc-200/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 p-2.5 rounded-xl text-white shadow-lg shadow-zinc-200">
            <MapIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Order Logistics Map
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-zinc-500 text-xs font-medium">
                Monitoring {ordersWithLocation.length} orders
                {orders.length > ordersWithLocation.length && (
                  <span className="ml-1 text-zinc-400 font-normal">
                    ({orders.length - ordersWithLocation.length} pending GPS)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-0.5">
        <OrdersFilters
          orderCounts={orderCounts}
          currentStatus={searchParams.status}
        />
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-2xl border shadow-lg relative map-wrapper overflow-hidden group">
        <OrdersMapWrapper
          orders={ordersWithLocation}
          currency={currency}
          storeSlug={storeSlug}
        />

        {/* Floating Map Legend */}
        <div className="absolute bottom-6 right-6 z-400 bg-white/90 backdrop-blur p-4 rounded-2xl border border-white/50 shadow-2xl space-y-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none sm:pointer-events-auto">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
            Logistics Legend
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute size-4 rounded-full bg-amber-500 opacity-30 animate-ping"></div>
                <div className="size-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
              </div>
              <span className="text-xs font-bold text-zinc-700">Placed</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
              <span className="text-xs font-bold text-zinc-700">Preparing</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute size-4 rounded-full bg-violet-500 opacity-30 animate-ping"></div>
                <div className="size-2.5 rounded-full bg-violet-500 border-2 border-white shadow-sm"></div>
              </div>
              <span className="text-xs font-bold text-zinc-700">
                Out for Delivery
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div>
              <span className="text-xs font-bold text-zinc-700">Completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
