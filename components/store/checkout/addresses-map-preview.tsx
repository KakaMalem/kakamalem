"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import type { DeliveryZone } from "@/lib/db/schema";

interface SavedAddress {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  latitude: string;
  longitude: string;
  plusCode: string | null;
  city: string | null;
  isDefault: boolean;
}

interface AddressesMapPreviewProps {
  addresses: SavedAddress[];
  deliveryZones: DeliveryZone[];
  selectedAddressId: string | null;
  onAddressClick?: (addressId: string) => void;
  className?: string;
  /** Store's physical location - shown as a shop marker on the map */
  storeLocation?: { lat: number; lng: number } | null;
}

interface AddressZoneStatus {
  addressId: string;
  inZone: boolean;
  zoneName?: string;
  deliveryFee?: string;
  freeShippingThreshold?: string;
}

// Check if a point is within any delivery zone (reusing logic from location-picker)
function checkAddressInZones(
  lat: number,
  lng: number,
  zones: DeliveryZone[]
): { inZone: boolean; zone?: DeliveryZone } {
  // Sort by display order (smaller zones checked first)
  const sortedZones = [...zones].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  for (const zone of sortedZones) {
    if (
      !zone.centerLat ||
      !zone.centerLng ||
      !zone.radiusMeters ||
      !zone.isActive
    )
      continue;

    const centerLat = parseFloat(zone.centerLat);
    const centerLng = parseFloat(zone.centerLng);

    // Haversine distance calculation
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat - centerLat) * Math.PI) / 180;
    const dLng = ((lng - centerLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((centerLat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance <= zone.radiusMeters) {
      return { inZone: true, zone };
    }
  }
  return { inZone: false };
}

export function AddressesMapPreview({
  addresses,
  deliveryZones,
  selectedAddressId,
  onAddressClick,
  className,
  storeLocation,
}: AddressesMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneCirclesRef = useRef<any[]>([]);
  const mapInitializedRef = useRef(false);

  const [leafletLoaded, setLeafletLoaded] = useState(
    () => typeof window !== "undefined" && !!window.L
  );

  // Calculate zone status for all addresses
  const addressZoneStatuses = useMemo<AddressZoneStatus[]>(() => {
    return addresses.map((address) => {
      const lat = parseFloat(address.latitude);
      const lng = parseFloat(address.longitude);
      const result = checkAddressInZones(lat, lng, deliveryZones);

      return {
        addressId: address.id,
        inZone: result.inZone,
        zoneName: result.zone?.name,
        deliveryFee: result.zone?.deliveryFee,
        freeShippingThreshold: result.zone?.freeShippingThreshold || undefined,
      };
    });
  }, [addresses, deliveryZones]);

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
    if (addresses.length === 0 && deliveryZones.length === 0) return;

    const L = window.L;

    // Determine initial view based on zones and addresses
    const initialCenter: [number, number] = [34.5553, 69.2075]; // Kabul default
    const initialZoom = 12;

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

    // Draw delivery zones first (so they're below markers)
    zoneCirclesRef.current = [];
    const activeZones = deliveryZones.filter((z) => z.isActive);

    // Sort by radius (largest first) so smaller zones render on top
    const sortedZones = [...activeZones].sort(
      (a, b) => (b.radiusMeters ?? 0) - (a.radiusMeters ?? 0)
    );

    sortedZones.forEach((zone) => {
      if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) return;

      const circle = L.circle(
        [parseFloat(zone.centerLat), parseFloat(zone.centerLng)],
        {
          radius: zone.radiusMeters,
          color: zone.color || "#3b82f6",
          fillColor: zone.color || "#3b82f6",
          fillOpacity: 0.12,
          weight: 2,
          dashArray: "5, 5",
        }
      ).addTo(map);

      // Add tooltip with zone name and delivery price
      const fee = parseFloat(zone.deliveryFee || "0");
      const freeThreshold = zone.freeShippingThreshold
        ? parseFloat(zone.freeShippingThreshold)
        : null;

      let tooltipContent = `<div class="zone-tooltip-content">
        <strong>${zone.name}</strong><br/>`;

      if (fee === 0) {
        tooltipContent += `<span class="text-green-600">Free delivery</span>`;
      } else {
        tooltipContent += `<span>${fee.toLocaleString()} AFN</span>`;
        if (freeThreshold && freeThreshold > 0) {
          tooltipContent += `<br/><span class="text-xs text-gray-500">Free over ${freeThreshold.toLocaleString()} AFN</span>`;
        }
      }

      if (zone.estimatedDeliveryTime) {
        tooltipContent += `<br/><span class="text-xs text-gray-500">${zone.estimatedDeliveryTime}</span>`;
      }

      tooltipContent += `</div>`;

      circle.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "center",
        className: "zone-price-tooltip",
      });

      zoneCirclesRef.current.push(circle);
    });

    // Create custom home icon for addresses
    const createHomeIcon = (isSelected: boolean, inZone: boolean) => {
      const bgColor = inZone ? (isSelected ? "#16a34a" : "#22c55e") : "#ef4444";
      const borderColor = isSelected ? "#fff" : "transparent";
      const size = isSelected ? 36 : 28;

      return L.divIcon({
        className: "custom-home-marker",
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: ${bgColor};
            border: 3px solid ${borderColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    // Add address markers
    markersRef.current = [];
    const bounds: [number, number][] = [];

    addresses.forEach((address) => {
      const lat = parseFloat(address.latitude);
      const lng = parseFloat(address.longitude);
      const isSelected = address.id === selectedAddressId;
      const zoneStatus = addressZoneStatuses.find(
        (s) => s.addressId === address.id
      );

      const marker = L.marker([lat, lng], {
        icon: createHomeIcon(isSelected, zoneStatus?.inZone ?? false),
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(map);

      // Add popup with address info
      const popupContent = `
        <div class="address-popup p-2">
          <div class="font-medium">${address.firstName} ${address.lastName}</div>
          ${address.label ? `<div class="text-xs text-gray-500">${address.label}</div>` : ""}
          <div class="text-xs text-gray-600 font-mono mt-1">
            ${address.plusCode ? formatPlusCodeForDisplay(address.plusCode, address.city) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
          </div>
          <div class="mt-1 text-xs ${zoneStatus?.inZone ? "text-green-600" : "text-red-600"}">
            ${zoneStatus?.inZone ? `✓ ${zoneStatus.zoneName}` : "✗ Outside delivery area"}
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      if (onAddressClick) {
        marker.on("click", () => {
          onAddressClick(address.id);
        });
      }

      markersRef.current.push({ marker, addressId: address.id });
      bounds.push([lat, lng]);
    });

    // Add zone centers to bounds calculation
    activeZones.forEach((zone) => {
      if (zone.centerLat && zone.centerLng) {
        bounds.push([parseFloat(zone.centerLat), parseFloat(zone.centerLng)]);
      }
    });

    // Add store location marker if available
    if (storeLocation) {
      const storeIcon = L.divIcon({
        className: "custom-store-marker",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #8b5cf6;
            border: 2px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
              <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const storeMarker = L.marker([storeLocation.lat, storeLocation.lng], {
        icon: storeIcon,
        zIndexOffset: -100,
      }).addTo(map);

      storeMarker.bindTooltip("Store Location", {
        permanent: false,
        direction: "top",
        className: "store-tooltip",
      });

      bounds.push([storeLocation.lat, storeLocation.lng]);
    }

    // Fit bounds to show all markers and zones
    if (bounds.length > 0) {
      const group = L.latLngBounds(bounds);
      map.fitBounds(group, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(initialCenter, initialZoom);
    }

    mapInstanceRef.current = map;
    mapInitializedRef.current = true;

    // Add custom CSS for tooltips
    const style = document.createElement("style");
    style.textContent = `
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
      .custom-home-marker {
        background: transparent !important;
        border: none !important;
      }
      .custom-store-marker {
        background: transparent !important;
        border: none !important;
      }
      .store-tooltip {
        background: #8b5cf6 !important;
        color: white !important;
        border: none !important;
        border-radius: 6px !important;
        padding: 4px 8px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
      }
      .store-tooltip::before {
        border-top-color: #8b5cf6 !important;
      }
      .address-popup {
        min-width: 150px;
      }
      .leaflet-popup-content-wrapper {
        border-radius: 12px !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
      zoneCirclesRef.current = [];
      mapInitializedRef.current = false;
    };
  }, [
    leafletLoaded,
    addresses,
    deliveryZones,
    selectedAddressId,
    addressZoneStatuses,
    onAddressClick,
    storeLocation,
  ]);

  // Track previous selection to detect changes
  const prevSelectedIdRef = useRef<string | null>(null);

  // Update markers and zoom to selected address when selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    // Update marker icons
    markersRef.current.forEach(({ marker, addressId }) => {
      const isSelected = addressId === selectedAddressId;
      const zoneStatus = addressZoneStatuses.find(
        (s) => s.addressId === addressId
      );
      const inZone = zoneStatus?.inZone ?? false;

      const bgColor = inZone ? (isSelected ? "#16a34a" : "#22c55e") : "#ef4444";
      const borderColor = isSelected ? "#fff" : "transparent";
      const size = isSelected ? 36 : 28;

      marker.setIcon(
        L.divIcon({
          className: "custom-home-marker",
          html: `
            <div style="
              width: ${size}px;
              height: ${size}px;
              background: ${bgColor};
              border: 3px solid ${borderColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              transition: all 0.2s ease;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })
      );

      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });

    // Zoom to selected address (only if selection actually changed)
    if (selectedAddressId && selectedAddressId !== prevSelectedIdRef.current) {
      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
      if (selectedAddress) {
        const lat = parseFloat(selectedAddress.latitude);
        const lng = parseFloat(selectedAddress.longitude);
        map.flyTo([lat, lng], 16, {
          duration: 0.5,
          easeLinearity: 0.5,
        });
      }
    }

    prevSelectedIdRef.current = selectedAddressId;
  }, [selectedAddressId, addressZoneStatuses, leafletLoaded, addresses]);

  // Get status of selected address
  const selectedAddressStatus = useMemo(() => {
    if (!selectedAddressId) return null;
    return addressZoneStatuses.find((s) => s.addressId === selectedAddressId);
  }, [selectedAddressId, addressZoneStatuses]);

  if (addresses.length === 0 && deliveryZones.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Map container - isolate creates a new stacking context to prevent z-index leak to navbar */}
      <div className="relative isolate overflow-hidden rounded-xl border bg-white shadow-sm">
        {!leafletLoaded ? (
          <div className="flex h-48 items-center justify-center bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              Loading map...
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="h-48 sm:h-56 w-full" />
        )}

        {/* Legend */}
        {leafletLoaded && deliveryZones.length > 0 && (
          <div className="absolute bottom-2 right-2 z-1000 rounded-lg bg-white/95 p-2 shadow-md backdrop-blur-sm text-xs">
            <div className="flex items-center gap-3">
              {storeLocation && (
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded-full bg-violet-500" />
                  <span className="text-gray-600">Store</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-green-500" />
                <span className="text-gray-600">In zone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-red-500" />
                <span className="text-gray-600">Outside</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected address zone status */}
      {selectedAddressStatus && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg p-2.5 text-sm",
            selectedAddressStatus.inZone
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          )}
        >
          {selectedAddressStatus.inZone ? (
            <>
              <Check className="size-4 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">
                  Delivery available - {selectedAddressStatus.zoneName}
                </p>
                {selectedAddressStatus.deliveryFee && (
                  <p className="text-xs opacity-80">
                    {parseFloat(selectedAddressStatus.deliveryFee) === 0
                      ? "Free delivery"
                      : `${parseFloat(selectedAddressStatus.deliveryFee).toLocaleString()} AFN delivery fee`}
                    {selectedAddressStatus.freeShippingThreshold &&
                      parseFloat(selectedAddressStatus.freeShippingThreshold) >
                        0 &&
                      parseFloat(selectedAddressStatus.deliveryFee) > 0 && (
                        <span>
                          {" "}
                          (Free over{" "}
                          {parseFloat(
                            selectedAddressStatus.freeShippingThreshold
                          ).toLocaleString()}{" "}
                          AFN)
                        </span>
                      )}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">
                  This address is outside our delivery zones
                </p>
                <p className="text-xs opacity-80">
                  Please select a different address or add a new one within the
                  highlighted areas
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}
