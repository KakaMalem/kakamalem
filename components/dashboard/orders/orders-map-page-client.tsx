"use client";

import { useMemo, useState } from "react";
import { OrdersFilters } from "./orders-filters";
import { Map as MapIcon } from "lucide-react";
import type { DashboardOrder, OrderCounts } from "@/lib/db/queries/orders";
import dynamic from "next/dynamic";
import { hasMapLocation } from "@/lib/geo/address";
import { getCountryCentroid, getCountryName } from "@/lib/geo/countries";
import { Button } from "@/components/ui/button";

import type {
  BuyerOriginPoint,
  OrdersMapProps,
  OrdersMapView,
} from "@/components/dashboard/orders/orders-map-wrapper";

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
  // Only orders with a real map pin can be plotted. Stores that collect a
  // typed address instead of a pin store 0/0 coordinates, so none of their
  // orders appear here.
  const ordersWithLocation = useMemo(
    () => orders.filter((order) => hasMapLocation(order.shippingAddress)),
    [orders]
  );
  const unmappableCount = orders.length - ordersWithLocation.length;

  // Where orders were placed from, one entry per country. This is the useful
  // view for a store whose buyers are abroad and whose deliveries all land in
  // one city.
  const originPoints = useMemo<BuyerOriginPoint[]>(() => {
    const byCountry = new Map<
      string,
      { orders: number; revenue: number; cities: Set<string> }
    >();

    for (const order of orders) {
      const code = order.buyerCountryCode?.toUpperCase();
      if (!code) continue;
      const entry = byCountry.get(code) ?? {
        orders: 0,
        revenue: 0,
        cities: new Set<string>(),
      };
      entry.orders += 1;
      entry.revenue += parseFloat(order.total) || 0;
      if (order.buyerCity) entry.cities.add(order.buyerCity);
      byCountry.set(code, entry);
    }

    return Array.from(byCountry.entries())
      .map(([code, entry]) => {
        const centroid = getCountryCentroid(code);
        return {
          countryCode: code,
          countryName: getCountryName(code) ?? code,
          lat: centroid?.lat ?? null,
          lng: centroid?.lng ?? null,
          orders: entry.orders,
          revenue: entry.revenue,
          cities: Array.from(entry.cities),
        };
      })
      .sort((a, b) => b.orders - a.orders);
  }, [orders]);

  const ordersWithoutOrigin = orders.filter((o) => !o.buyerCountryCode).length;

  // Land on whichever view actually has something to show.
  const [view, setView] = useState<OrdersMapView | null>(null);
  const effectiveView: OrdersMapView =
    view ??
    (ordersWithLocation.length === 0 && originPoints.length > 0
      ? "origin"
      : "delivery");

  const isOrigin = effectiveView === "origin";
  const plottedCount = isOrigin
    ? originPoints.reduce((sum, point) => sum + point.orders, 0)
    : ordersWithLocation.length;
  const missingCount = isOrigin ? ordersWithoutOrigin : unmappableCount;

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
                {plottedCount} order{plottedCount === 1 ? "" : "s"}{" "}
                {isOrigin
                  ? `placed from ${originPoints.length} ${
                      originPoints.length === 1 ? "country" : "countries"
                    }`
                  : "with a delivery location"}
                {missingCount > 0 && (
                  <span className="ml-1 text-zinc-400 font-normal">
                    (
                    {isOrigin
                      ? `${missingCount} of unknown origin`
                      : `${missingCount} without a map pin`}
                    )
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Which question the map answers */}
        <div className="flex items-center gap-1 rounded-xl border bg-white/70 p-1">
          <Button
            type="button"
            size="sm"
            variant={isOrigin ? "ghost" : "secondary"}
            className="h-8 rounded-lg text-xs"
            onClick={() => setView("delivery")}
          >
            Delivering to
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isOrigin ? "secondary" : "ghost"}
            className="h-8 rounded-lg text-xs"
            onClick={() => setView("origin")}
          >
            Ordered from
          </Button>
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
          originPoints={originPoints}
          view={effectiveView}
          currency={currency}
          storeSlug={storeSlug}
        />

        {/* Nothing to plot: explain why instead of showing a blank map */}
        {plottedCount === 0 && (
          <div className="absolute inset-0 z-500 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
            <div className="max-w-md text-center">
              <MapIcon className="mx-auto size-10 text-muted-foreground/50" />
              <p className="mt-3 font-medium">Nothing to plot yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOrigin
                  ? "Customer locations are recorded as orders come in, so orders placed before this was added will not appear here. New ones will."
                  : unmappableCount > 0
                    ? "These orders have a typed delivery address rather than a map pin, so there are no coordinates to place. Switch to the customer view to see where they were ordered from."
                    : "Orders will appear here once you receive one with a delivery location."}
              </p>
            </div>
          </div>
        )}

        {/* Ranked origin list: the answer to where to focus, in words */}
        {isOrigin && originPoints.length > 0 && (
          <div className="absolute left-6 top-6 z-500 max-h-[60%] w-56 overflow-y-auto rounded-2xl border bg-white/90 p-4 shadow-2xl backdrop-blur">
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Top customer countries
            </h3>
            <ol className="space-y-1.5">
              {originPoints.slice(0, 12).map((point, index) => (
                <li
                  key={point.countryCode}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate font-medium text-zinc-700">
                    <span className="mr-1.5 text-zinc-400">{index + 1}</span>
                    {point.countryName}
                  </span>
                  <span className="shrink-0 font-bold text-zinc-900">
                    {point.orders}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

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
