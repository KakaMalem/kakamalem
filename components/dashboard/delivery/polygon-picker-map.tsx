"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic imports for Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const PolygonPicker = dynamic(
  () => import("./map/polygon-picker").then((mod) => mod.PolygonPicker),
  { ssr: false }
);

interface PolygonPickerMapProps {
  /** Polygon coordinates in [lat, lng] format */
  coordinates: [number, number][];
  /** Called when coordinates change */
  onCoordinatesChange: (coords: [number, number][]) => void;
  /** Zone color */
  color?: string;
  /** Disable interaction */
  disabled?: boolean;
  /** Map height */
  height?: number | string;
  /** Additional class name */
  className?: string;
}

export function PolygonPickerMap({
  coordinates,
  onCoordinatesChange,
  color = "#3b82f6",
  disabled = false,
  height = 400,
  className,
}: PolygonPickerMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet CSS on mount
  useEffect(() => {
    const existingLink = document.querySelector('link[href*="leaflet"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeafletLoaded(true);
  }, []);

  if (!leafletLoaded) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-xl ${className}`}
        style={{ height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate initial center from coordinates or use default (Kabul)
  const getInitialCenter = (): [number, number] => {
    if (coordinates.length > 0) {
      const lats = coordinates.map((c) => c[0]);
      const lngs = coordinates.map((c) => c[1]);
      return [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ];
    }
    return [34.5553, 69.2075]; // Kabul, Afghanistan
  };

  const initialCenter = getInitialCenter();
  const initialZoom = coordinates.length > 0 ? 12 : 6;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border map-wrapper ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PolygonPicker
          coordinates={coordinates}
          onCoordinatesChange={onCoordinatesChange}
          color={color}
          disabled={disabled}
        />
      </MapContainer>
    </div>
  );
}
