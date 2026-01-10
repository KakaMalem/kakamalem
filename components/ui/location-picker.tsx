"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computePlusCode } from "@/lib/geo";

// Default center: Kabul, Afghanistan
const DEFAULT_CENTER = { lat: 34.5553, lng: 69.2075 };
const DEFAULT_ZOOM = 13;

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "gps" | "manual";
  plusCode: string;
}

interface LocationPickerProps {
  value?: { latitude: number; longitude: number } | null;
  onChange: (location: LocationData) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function LocationPicker({
  value,
  onChange,
  error,
  disabled,
  className,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet dynamically (only on client)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    const center = value
      ? [value.latitude, value.longitude]
      : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

    const map = L.map(mapRef.current).setView(
      center as [number, number],
      DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add marker if value exists
    if (value) {
      markerRef.current = L.marker([value.latitude, value.longitude]).addTo(
        map
      );
    }

    // Click handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", (e: any) => {
      if (disabled) return;

      const { lat, lng } = e.latlng;

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }

      // Emit full location data with source='manual'
      const plusCode = computePlusCode(lat, lng);
      onChange({
        latitude: lat,
        longitude: lng,
        source: "manual",
        plusCode,
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [leafletLoaded, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker when value changes externally
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.latitude, value.longitude]);
      } else {
        markerRef.current = L.marker([value.latitude, value.longitude]).addTo(
          map
        );
      }
      map.setView([value.latitude, value.longitude], map.getZoom());
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value, leafletLoaded]);

  // Get current location from browser GPS
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Emit full location data with source='gps' and accuracy
        const plusCode = computePlusCode(latitude, longitude);
        onChange({
          latitude,
          longitude,
          accuracy: accuracy || undefined,
          source: "gps",
          plusCode,
        });

        // Center map on new location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }

        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError(
              "Location permission denied. Please allow location access."
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("Location unavailable. Please try again.");
            break;
          case err.TIMEOUT:
            setGpsError("Location request timed out. Please try again.");
            break;
          default:
            setGpsError("Failed to get location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onChange]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Map Container */}
      <div
        className={cn(
          "relative h-64 w-full rounded-lg border bg-muted overflow-hidden",
          error && "border-destructive",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {!leafletLoaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={mapRef} className="h-full w-full" />
        )}

        {/* Instructions overlay when no location selected */}
        {leafletLoaded && !value && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-none">
            <div className="text-center p-4">
              <MapPin className="mx-auto size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click on the map to select your location
              </p>
            </div>
          </div>
        )}
      </div>

      {/* GPS Button and Location Info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Navigation className="mr-2 size-4" />
            )}
            Use my current location
          </Button>
        </div>
      </div>

      {/* Errors */}
      {(gpsError || error) && (
        <p className="text-sm text-destructive">{gpsError || error}</p>
      )}
    </div>
  );
}

// Extend Window interface for Leaflet
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}
