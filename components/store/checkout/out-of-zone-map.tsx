"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DeliveryZone } from "@/lib/db/schema";

interface OutOfZoneMapProps {
  userAddress: {
    latitude: number;
    longitude: number;
  };
  deliveryZones: DeliveryZone[];
  className?: string;
}

export function OutOfZoneMap({
  userAddress,
  deliveryZones,
  className,
}: OutOfZoneMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);

  const [leafletLoaded, setLeafletLoaded] = useState(
    () => typeof window !== "undefined" && !!window.L
  );

  // Load Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || leafletLoaded) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, [leafletLoaded]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInitializedRef.current) return;

    const L = window.L;

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      tap: false,
    });

    // Add zoom control to bottom-left
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // Collect all bounds
    const bounds: [number, number][] = [];

    // Draw delivery zones first (so they're below markers)
    // Sort by radius (largest first) so smaller zones render on top
    const activeZones = deliveryZones.filter((z) => z.isActive);
    const sortedZones = [...activeZones].sort(
      (a, b) => (b.radiusMeters ?? 0) - (a.radiusMeters ?? 0)
    );

    sortedZones.forEach((zone) => {
      if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) return;

      const centerLat = parseFloat(zone.centerLat);
      const centerLng = parseFloat(zone.centerLng);

      const circle = L.circle([centerLat, centerLng], {
        radius: zone.radiusMeters,
        color: zone.color || "#22c55e",
        fillColor: zone.color || "#22c55e",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map);

      // Add tooltip with zone name and price
      const fee = parseFloat(zone.deliveryFee || "0");
      let tooltipContent = `<strong>${zone.name}</strong><br/>`;
      if (fee === 0) {
        tooltipContent += `<span style="color: #16a34a;">Free delivery</span>`;
      } else {
        tooltipContent += `<span>${fee.toLocaleString()} AFN</span>`;
      }

      circle.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "center",
        className: "zone-price-tooltip",
      });

      bounds.push([centerLat, centerLng]);
    });

    // Add user's address marker (with red X icon)
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #ef4444;
          border: 3px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5);
          animation: pulse-marker 2s ease-in-out infinite;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const userMarker = L.marker([userAddress.latitude, userAddress.longitude], {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    userMarker.bindPopup(
      `<div class="text-center p-1">
        <p class="font-medium text-red-600">Your Address</p>
        <p class="text-xs text-gray-500">Outside delivery area</p>
      </div>`
    );

    bounds.push([userAddress.latitude, userAddress.longitude]);

    // Fit bounds to show all zones and user's address
    if (bounds.length > 0) {
      const group = L.latLngBounds(bounds);
      map.fitBounds(group, { padding: [40, 40], maxZoom: 14 });
    }

    // Add pulse animation style
    const style = document.createElement("style");
    style.id = "out-of-zone-map-styles";
    if (!document.getElementById("out-of-zone-map-styles")) {
      style.textContent = `
        @keyframes pulse-marker {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 2px 20px rgba(239, 68, 68, 0.7);
          }
        }
        .custom-user-marker {
          background: transparent !important;
          border: none !important;
        }
        .zone-price-tooltip {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          font-size: 13px !important;
        }
        .zone-price-tooltip::before {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    mapInstanceRef.current = map;
    mapInitializedRef.current = true;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      mapInitializedRef.current = false;
    };
  }, [leafletLoaded, userAddress, deliveryZones]);

  return (
    <div className={className}>
      {/* isolate creates a new stacking context to prevent z-index leak to navbar */}
      <div className="relative isolate overflow-hidden rounded-xl border bg-white shadow-sm">
        {!leafletLoaded ? (
          <div className="flex h-56 items-center justify-center bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              Loading map...
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="h-56 w-full" />
        )}

        {/* Legend */}
        {leafletLoaded && (
          <div className="absolute bottom-2 right-2 z-1000 rounded-lg bg-white/95 p-2 shadow-md backdrop-blur-sm text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-green-500 opacity-60 border border-green-600" />
                <span className="text-gray-600">Delivery zone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-red-500" />
                <span className="text-gray-600">Your address</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        The green areas show where we deliver. Your address (red marker) is
        outside these zones.
      </p>
    </div>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}
