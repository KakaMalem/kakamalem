"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, X, Loader2 } from "lucide-react";
import { useLocationPermission } from "@/lib/hooks/use-location-permission";
import { reverseGeocode, computePlusCode } from "@/lib/geo";
import { cn } from "@/lib/utils";

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

export interface LocationValue {
  latitude: number;
  longitude: number;
  city?: string;
  plusCode?: string;
  accuracy?: number;
  source: "gps" | "manual";
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (location: LocationValue | null) => void;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  disabled?: boolean;
  className?: string;
  showGPSButton?: boolean;
  showClearButton?: boolean;
}

// Default center is Kabul, Afghanistan
const DEFAULT_CENTER = { lat: 34.5553, lng: 69.2075 };
const DEFAULT_ZOOM = 12;

export function LocationPicker({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = DEFAULT_ZOOM,
  disabled = false,
  className = "",
  showGPSButton = true,
  showClearButton = true,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const { requestLocation, permissionState } = useLocationPermission();

  // Reverse geocode and update location with Plus Code
  const updateLocationWithCity = useCallback(
    async (
      lat: number,
      lng: number,
      accuracy?: number,
      source: "gps" | "manual" = "manual"
    ) => {
      setIsReverseGeocoding(true);
      // Compute Plus Code immediately (synchronous)
      const plusCode = computePlusCode(lat, lng);
      try {
        const city = await reverseGeocode(lat, lng);
        onChange({
          latitude: lat,
          longitude: lng,
          city: city || undefined,
          plusCode,
          accuracy,
          source,
        });
      } catch {
        // If reverse geocode fails, still update location without city
        onChange({
          latitude: lat,
          longitude: lng,
          plusCode,
          accuracy,
          source,
        });
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [onChange]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Determine initial center
    const initialCenter = value
      ? [value.latitude, value.longitude]
      : [defaultCenter.lat, defaultCenter.lng];

    const map = L.map(mapContainerRef.current).setView(
      initialCenter as [number, number],
      value ? 15 : defaultZoom
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Add initial marker if value exists
    if (value) {
      const marker = L.marker([value.latitude, value.longitude], {
        draggable: !disabled,
        autoPan: true,
      }).addTo(map);

      if (!disabled) {
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          updateLocationWithCity(
            position.lat,
            position.lng,
            undefined,
            "manual"
          );
        });
      }

      markerRef.current = marker;
    }

    // Handle map clicks (only when not disabled)
    if (!disabled) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        // Move or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], {
            draggable: true,
            autoPan: true,
          }).addTo(map);

          marker.on("dragend", () => {
            const position = marker.getLatLng();
            updateLocationWithCity(
              position.lat,
              position.lng,
              undefined,
              "manual"
            );
          });

          markerRef.current = marker;
        }

        updateLocationWithCity(lat, lng, undefined, "manual");
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]); // Only re-run if disabled changes

  // Update marker when value changes externally
  useEffect(() => {
    if (!mapRef.current) return;

    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.latitude, value.longitude]);
      } else {
        const marker = L.marker([value.latitude, value.longitude], {
          draggable: !disabled,
          autoPan: true,
        }).addTo(mapRef.current);

        if (!disabled) {
          marker.on("dragend", () => {
            const position = marker.getLatLng();
            updateLocationWithCity(
              position.lat,
              position.lng,
              undefined,
              "manual"
            );
          });
        }

        markerRef.current = marker;
      }

      mapRef.current.setView([value.latitude, value.longitude], 15);
    } else {
      // Remove marker if value is null
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [value, disabled, updateLocationWithCity]);

  // Handle GPS location request
  const handleGetLocation = async () => {
    if (disabled || isGettingLocation) return;

    setIsGettingLocation(true);
    try {
      const result = await requestLocation();
      if (result.position) {
        const { latitude, longitude, accuracy } = result.position.coords;
        await updateLocationWithCity(latitude, longitude, accuracy, "gps");

        // Center map on location
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
        }
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Handle clear location
  const handleClearLocation = () => {
    if (disabled) return;
    onChange(null);
  };

  const isLoading = isGettingLocation || isReverseGeocoding;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Control buttons */}
      <div className="flex items-center gap-2">
        {showGPSButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetLocation}
            disabled={disabled || isLoading || permissionState === "denied"}
            className="flex-1"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            {isGettingLocation ? "Getting location..." : "Use my location"}
          </Button>
        )}
        {showClearButton && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearLocation}
            disabled={disabled || isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className={cn(
          "w-full h-64 rounded-lg border bg-muted map-wrapper",
          disabled && "opacity-60 pointer-events-none"
        )}
      />

      {/* Location info */}
      {value && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            {isReverseGeocoding ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Getting address...
              </span>
            ) : (
              <>
                {value.plusCode && (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono mr-2">
                    {value.plusCode}
                  </code>
                )}
                {value.city || "Location selected"}
              </>
            )}
          </span>
        </div>
      )}

      {/* Hint text */}
      {!value && !disabled && (
        <p className="text-sm text-muted-foreground">
          Click on the map to select your store location, or use the button
          above to get your current location.
        </p>
      )}
    </div>
  );
}
