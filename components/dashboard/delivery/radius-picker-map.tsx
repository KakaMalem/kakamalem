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
const RadiusPicker = dynamic(
  () => import("./map/radius-picker").then((mod) => mod.RadiusPicker),
  { ssr: false }
);

interface RadiusPickerMapProps {
  centerLat?: number;
  centerLng?: number;
  radiusMeters: number;
  color?: string;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (radiusMeters: number) => void;
  disabled?: boolean;
  height?: number | string;
  className?: string;
}

export function RadiusPickerMap({
  centerLat,
  centerLng,
  radiusMeters,
  color = "#3b82f6",
  onCenterChange,
  onRadiusChange,
  disabled = false,
  height = 400,
  className,
}: RadiusPickerMapProps) {
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

  // Default center: Kabul, Afghanistan
  const defaultCenter: [number, number] = [34.5553, 69.2075];
  const initialCenter: [number, number] =
    centerLat !== undefined && centerLng !== undefined
      ? [centerLat, centerLng]
      : defaultCenter;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border map-wrapper ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={centerLat !== undefined ? 12 : 6}
        className="h-full w-full"
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RadiusPicker
          centerLat={centerLat}
          centerLng={centerLng}
          radiusMeters={radiusMeters}
          color={color}
          onCenterChange={onCenterChange}
          onRadiusChange={onRadiusChange}
          disabled={disabled}
        />
      </MapContainer>

      {/* Instructions overlay - positioned outside MapContainer */}
      <div className="absolute bottom-3 left-3 right-3 pointer-events-none z-10">
        <div className="inline-block pointer-events-auto bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-sm">
          {centerLat === undefined ? (
            <p className="font-medium text-foreground">
              Click on the map to set center point
            </p>
          ) : (
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Drag center</span>{" "}
              to move •
              <span className="text-foreground font-medium">
                {" "}
                Drag edge handle
              </span>{" "}
              to resize
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
