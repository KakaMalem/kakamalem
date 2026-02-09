"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DeliveryZone } from "@/lib/db/schema";

// Fix default marker icon issue with webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type DeliveryZoneMapProps = {
  zones: DeliveryZone[];
  editingZone?: DeliveryZone | null;
  onZoneChange?: (zone: {
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  }) => void;
  onMapClick?: (lat: number, lng: number) => void;
  isEditing?: boolean;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  className?: string;
};

// Default center is Kabul, Afghanistan
const DEFAULT_CENTER = { lat: 34.5553, lng: 69.2075 };
const DEFAULT_ZOOM = 12;

export function DeliveryZoneMap({
  zones,
  editingZone,
  onZoneChange,
  onMapClick,
  isEditing = false,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = DEFAULT_ZOOM,
  className = "",
}: DeliveryZoneMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const editingCircleRef = useRef<L.Circle | null>(null);
  const editingMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(
      [defaultCenter.lat, defaultCenter.lng],
      defaultZoom
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create layers group for zones
    zonesLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [defaultCenter.lat, defaultCenter.lng, defaultZoom]);

  // Draw all zones
  useEffect(() => {
    if (!mapRef.current || !zonesLayerRef.current) return;

    // Clear existing zones
    zonesLayerRef.current.clearLayers();

    // Draw each zone
    zones.forEach((zone) => {
      if (
        zone.zoneType === "circle" &&
        zone.centerLat &&
        zone.centerLng &&
        zone.radiusMeters
      ) {
        // Don't draw the zone that's being edited
        if (editingZone && zone.id === editingZone.id) return;

        const circle = L.circle(
          [parseFloat(zone.centerLat), parseFloat(zone.centerLng)],
          {
            radius: zone.radiusMeters,
            color: zone.color || "#3b82f6",
            fillColor: zone.color || "#3b82f6",
            fillOpacity: zone.isActive ? 0.2 : 0.1,
            weight: zone.isActive ? 2 : 1,
            dashArray: zone.isActive ? undefined : "5, 5",
          }
        );

        // Add popup with zone info
        circle.bindPopup(`
          <div class="font-sans">
            <strong>${zone.name}</strong><br/>
            Radius: ${(zone.radiusMeters / 1000).toFixed(1)} km<br/>
            Fee: ${parseFloat(zone.deliveryFee).toLocaleString()} AFN<br/>
            ${zone.minOrderAmount ? `Min order: ${parseFloat(zone.minOrderAmount).toLocaleString()} AFN` : ""}
          </div>
        `);

        zonesLayerRef.current?.addLayer(circle);
      }
    });
  }, [zones, editingZone]);

  // Handle editing mode
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove existing editing elements
    if (editingCircleRef.current) {
      map.removeLayer(editingCircleRef.current);
      editingCircleRef.current = null;
    }
    if (editingMarkerRef.current) {
      map.removeLayer(editingMarkerRef.current);
      editingMarkerRef.current = null;
    }

    if (isEditing && editingZone) {
      const lat = editingZone.centerLat
        ? parseFloat(editingZone.centerLat)
        : defaultCenter.lat;
      const lng = editingZone.centerLng
        ? parseFloat(editingZone.centerLng)
        : defaultCenter.lng;
      const radius = editingZone.radiusMeters || 3000;

      // Create editable circle
      const circle = L.circle([lat, lng], {
        radius,
        color: editingZone.color || "#ef4444",
        fillColor: editingZone.color || "#ef4444",
        fillOpacity: 0.3,
        weight: 3,
      });
      circle.addTo(map);
      editingCircleRef.current = circle;

      // Create draggable marker for center
      const marker = L.marker([lat, lng], {
        draggable: true,
        autoPan: true,
      });
      marker.addTo(map);
      editingMarkerRef.current = marker;

      // Handle marker drag
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        circle.setLatLng(position);
        onZoneChange?.({
          centerLat: position.lat,
          centerLng: position.lng,
          radiusMeters: circle.getRadius(),
        });
      });

      // Center map on the zone
      map.setView([lat, lng], Math.min(map.getZoom(), 14));
    }

    // Handle map clicks when editing
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isEditing) return;
      onMapClick?.(e.latlng.lat, e.latlng.lng);

      // Move the editing elements to click location
      if (editingCircleRef.current && editingMarkerRef.current) {
        editingCircleRef.current.setLatLng(e.latlng);
        editingMarkerRef.current.setLatLng(e.latlng);
        onZoneChange?.({
          centerLat: e.latlng.lat,
          centerLng: e.latlng.lng,
          radiusMeters: editingCircleRef.current.getRadius(),
        });
      }
    };

    if (isEditing) {
      map.on("click", handleMapClick);
    }

    return () => {
      map.off("click", handleMapClick);
    };
  }, [isEditing, editingZone, onZoneChange, onMapClick, defaultCenter]);

  // Update editing circle radius when editingZone changes
  const updateCircleRadius = useCallback((radiusMeters: number) => {
    if (editingCircleRef.current) {
      editingCircleRef.current.setRadius(radiusMeters);
    }
  }, []);

  // Expose method to update radius from parent
  useEffect(() => {
    if (editingZone?.radiusMeters && editingCircleRef.current) {
      updateCircleRadius(editingZone.radiusMeters);
    }
  }, [editingZone?.radiusMeters, updateCircleRadius]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-100 rounded-lg border map-wrapper ${className}`}
    />
  );
}

// Export a wrapper that handles SSR
export function DeliveryZoneMapWrapper(props: DeliveryZoneMapProps) {
  return <DeliveryZoneMap {...props} />;
}
