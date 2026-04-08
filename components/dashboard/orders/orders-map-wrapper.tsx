"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  DashboardOrder,
  FulfillmentType,
  OrderChannel,
} from "@/lib/db/queries/orders";
import { getOrderStatusInfoWithContext } from "@/lib/utils/order-status";

// Fix default marker icon issue with Leaflet
// @ts-expect-error - Leaflet icon property deletion is not tracked in types
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export interface OrdersMapProps {
  orders: DashboardOrder[];
  currency: string;
  storeSlug: string;
  className?: string;
}

export default function OrdersMap({
  orders,
  currency,
  storeSlug,
  className = "",
}: OrdersMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not already done
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [34.5553, 69.2075], // Default center (Kabul)
        zoom: 12,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      // CartoDB Positron - Premium minimalist look
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      mapRef.current = map;
      markersGroupRef.current = L.featureGroup().addTo(map);
    }

    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;

    if (!map || !markersGroup) return;

    // Clear existing markers
    markersGroup.clearLayers();

    if (orders.length === 0) return;

    const KabulTimezone = "Asia/Kabul";

    const locationGroups = new Map<string, DashboardOrder[]>();
    orders.forEach((order) => {
      if (!order.shippingAddress?.latitude || !order.shippingAddress?.longitude)
        return;
      const lat = Number(order.shippingAddress.latitude);
      const lng = Number(order.shippingAddress.longitude);
      const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
      const existing = locationGroups.get(key) || [];
      locationGroups.set(key, [...existing, order]);
    });

    // Helper to get color based on status
    const getStatusColor = (status: string) => {
      switch (status) {
        case "pending":
          return "#f59e0b"; // amber-500
        case "shipped":
          return "#8b5cf6"; // violet-500
        case "delivered":
          return "#10b981"; // emerald-500
        case "cancelled":
        case "returned":
          return "#ef4444"; // red-500
        case "confirmed":
        case "processing":
          return "#3b82f6"; // blue-500
        default:
          return "#71717a"; // zinc-500
      }
    };

    // Add markers for each group
    locationGroups.forEach((group, key) => {
      const [latStr, lngStr] = key.split(",");
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      // Determine marker behavior based on the group
      // Priority: pending > shipped > processing > others
      const hasPending = group.some((o) => o.status === "pending");
      const hasShipped = group.some((o) => o.status === "shipped");
      const hasProcessing = group.some(
        (o) => o.status === "confirmed" || o.status === "processing"
      );

      let markerColor = "#71717a";
      let shouldPulse = false;

      if (hasPending) {
        markerColor = getStatusColor("pending");
        shouldPulse = true;
      } else if (hasShipped) {
        markerColor = getStatusColor("shipped");
        shouldPulse = true;
      } else if (hasProcessing) {
        markerColor = getStatusColor("processing");
      } else {
        // Use the status of the first order in the group if no priority status found
        markerColor = getStatusColor(group[0].status);
      }

      // Create a premium custom marker
      const customIcon = L.divIcon({
        className: "map-marker-dot",
        html: `
          <div style="--marker-color: ${markerColor}; position: relative; display: flex; align-items: center; justify-content: center;">
            ${shouldPulse ? '<div class="marker-pulse"></div>' : ""}
            <div class="marker-inner"></div>
            ${group.length > 1 ? `<div class="marker-badge">${group.length}</div>` : ""}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Create premium popup content
      const popupContent = L.DomUtil.create("div", "premium-popup-inner");

      if (group.length === 1) {
        const order = group[0];
        const statusInfo = getOrderStatusInfoWithContext(
          order.status,
          order.fulfillmentType as FulfillmentType | null,
          order.channel as OrderChannel | null
        );

        popupContent.innerHTML = `
          <div class="p-4 min-w-60 space-y-3 font-sans">
            <div class="flex items-center justify-between border-b border-zinc-200/50 pb-2 mb-2">
              <div class="flex flex-col">
                <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Order ID</span>
                <span class="font-bold text-base leading-none">#${order.orderNumber}</span>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-black text-white shadow-sm" style="background-color: ${markerColor}">
                ${statusInfo.label}
              </span>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-4">
                <span class="text-zinc-400 text-[11px] font-medium uppercase tracking-tight">Customer</span>
                <span class="font-semibold text-xs truncate max-w-30">${order.customerSnapshot.name}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-zinc-400 text-[11px] font-medium uppercase tracking-tight">Total</span>
                <span class="font-bold text-xs text-zinc-900 px-1.5 py-0.5 bg-zinc-100 rounded">${Number(order.total).toLocaleString()} ${currency}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-zinc-400 text-[11px] font-medium uppercase tracking-tight">Placed On</span>
                <span class="text-xs text-zinc-600">${new Date(order.createdAt).toLocaleString("en-US", { timeZone: KabulTimezone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-zinc-400 text-[11px] font-medium uppercase tracking-tight">Payment</span>
                <span class="text-xs capitalize px-1.5 py-0.5 rounded border ${
                  order.paymentStatus === "paid"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }">${order.paymentStatus}</span>
              </div>
            </div>

            <div class="pt-1.5 overflow-hidden">
              <a href="/dashboard/${storeSlug}/orders/${order.id}" class="group flex items-center justify-center gap-2 bg-zinc-50/50 hover:bg-zinc-100 border border-zinc-200/80 text-zinc-900 py-2.5 rounded-[14px] text-xs font-bold transition-all shadow-sm active:scale-[0.98]">
                View Order Details
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </a>
            </div>
          </div>
        `;
      } else {
        // Multi-order popup
        popupContent.innerHTML = `
          <div class="p-0 min-w-70 max-w-80 font-sans overflow-hidden">
            <div class="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold tracking-tight">${group.length} Active Orders</h3>
                <p class="text-[9px] text-zinc-400 uppercase tracking-widest font-black">Same Location Cluster</p>
              </div>
              <div class="size-8 rounded-full bg-white/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div class="popup-list-container p-2 space-y-2 bg-zinc-100/50">
              ${group
                .map((order) => {
                  const sInfo = getOrderStatusInfoWithContext(
                    order.status,
                    order.fulfillmentType as FulfillmentType | null,
                    order.channel as OrderChannel | null
                  );
                  const mColor = getStatusColor(order.status);
                  return `
                    <div class="p-3 bg-white border border-zinc-200/50 rounded-xl shadow-sm space-y-2">
                       <div class="flex items-center justify-between">
                         <span class="font-bold text-xs text-zinc-900">#${order.orderNumber}</span>
                         <span class="px-2 py-0.5 rounded-full text-[9px] font-black text-white" style="background-color: ${mColor}">
                           ${sInfo.label}
                         </span>
                       </div>
                       <div class="flex items-center justify-between text-[10px]">
                         <span class="text-zinc-500">${order.customerSnapshot.name}</span>
                         <span class="font-bold text-emerald-600">${Number(order.total).toLocaleString()} ${currency}</span>
                       </div>
                       <a href="/dashboard/${storeSlug}/orders/${order.id}" class="block text-center py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 transition-colors">
                         View Details
                       </a>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `;
      }

      marker.bindPopup(popupContent, {
        className: "premium-popup",
        offset: [0, -4],
        closeButton: false,
      });
      markersGroup.addLayer(marker);
    });

    // Fit map to markers
    if (orders.length > 0) {
      map.fitBounds(markersGroup.getBounds(), {
        padding: [50, 50],
        maxZoom: 15,
      });
    }

    return () => {
      // Cleanup is handled by the first initialization check
    };
  }, [orders, currency, storeSlug]);

  return (
    <div
      ref={mapContainerRef}
      className={`h-full w-full ${className} map-wrapper`}
      style={{ minHeight: "500px", zIndex: 0 }}
    />
  );
}
