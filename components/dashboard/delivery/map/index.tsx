"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountriesGeoJSON } from "../hooks/use-geojson";
import type { UnifiedDeliveryZone } from "@/lib/delivery/types";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/delivery/geojson-config";

// Dynamically import map components to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

// Import our custom layers (also need dynamic import for Leaflet dependency)
const CountryLayerDynamic = dynamic(
  () => import("./country-layer").then((mod) => mod.CountryLayer),
  { ssr: false }
);
const LocalZonesLayerDynamic = dynamic(
  () => import("./local-zones-layer").then((mod) => mod.LocalZonesLayer),
  { ssr: false }
);
const MapControlsDynamic = dynamic(
  () => import("./map-controls").then((mod) => mod.MapControls),
  { ssr: false }
);
const SelectedCountriesPanelDynamic = dynamic(
  () => import("./map-controls").then((mod) => mod.SelectedCountriesPanel),
  { ssr: false }
);

// Country zone data for map display
interface CountryZoneForMap {
  id: string;
  countries: string[];
  color: string;
  isHighlighted: boolean;
}

interface UnifiedDeliveryMapProps {
  // Mode: 'view' for display only, 'select-countries' for country selection
  mode?: "view" | "select-countries" | "select-local";

  // Country zones to display (each with its own color)
  countryZones?: CountryZoneForMap[];
  // Legacy: flat list of selected countries (for select-countries mode)
  selectedCountries?: string[];
  onCountriesChange?: (countries: string[]) => void;

  // Local zones to display
  localZones?: UnifiedDeliveryZone[];
  selectedZoneId?: string | null;
  onZoneSelect?: (zone: UnifiedDeliveryZone) => void;

  // Zone being edited (will be excluded from display)
  editingZoneId?: string | null;

  // Zone color (for select-countries mode)
  zoneColor?: string;

  // Map container class
  className?: string;

  // Height
  height?: string | number;

  // Compact mode - simplified controls for sheet/dialog context
  compact?: boolean;
}

/**
 * Main unified delivery map component
 *
 * Supports:
 * - Country selection with hover effects
 * - Local zone display (radius/polygon)
 * - Layer toggles
 * - Search and bulk selection
 */
export function UnifiedDeliveryMap({
  mode = "view",
  countryZones = [],
  selectedCountries = [],
  onCountriesChange,
  localZones = [],
  selectedZoneId,
  onZoneSelect,
  editingZoneId,
  zoneColor = "#3b82f6",
  className,
  height = 500,
  compact = false,
}: UnifiedDeliveryMapProps) {
  // Check if we have countries to display (from zones or selection mode)
  const hasCountryZones =
    countryZones.length > 0 || selectedCountries.length > 0;

  const {
    data: countriesData,
    isLoading: isLoadingGeoJSON,
    error: geoJSONError,
    refetch,
  } = useCountriesGeoJSON({
    enabled: mode === "select-countries" || hasCountryZones,
  });

  // Layer visibility state (user can toggle these)
  const [layers, setLayers] = useState({
    countries: true,
    localZones: true,
  });

  // Determine if countries layer should be shown (has content to display AND user hasn't hidden it)
  const showCountriesLayer =
    layers.countries && (mode === "select-countries" || hasCountryZones);

  // Leaflet loaded state
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

  // Handle country toggle
  const handleCountryToggle = useCallback(
    (code: string, _name: string) => {
      if (!onCountriesChange) return;

      const newSelection = selectedCountries.includes(code)
        ? selectedCountries.filter((c) => c !== code)
        : [...selectedCountries, code];

      onCountriesChange(newSelection);
    },
    [selectedCountries, onCountriesChange]
  );

  // Handle bulk selection
  const handleBulkSelect = useCallback(
    (countries: string[]) => {
      if (!onCountriesChange) return;

      // Add countries that aren't already selected
      const newSelection = [...new Set([...selectedCountries, ...countries])];
      onCountriesChange(newSelection);
    },
    [selectedCountries, onCountriesChange]
  );

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    onCountriesChange?.([]);
  }, [onCountriesChange]);

  // Handle layer toggle
  const handleToggleLayer = useCallback((layer: "countries" | "localZones") => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Handle country removal from panel
  const handleRemoveCountry = useCallback(
    (code: string) => {
      if (!onCountriesChange) return;
      onCountriesChange(selectedCountries.filter((c) => c !== code));
    },
    [selectedCountries, onCountriesChange]
  );

  // Handle search - zoom to country
  const handleSearch = useCallback((code: string) => {
    // The zoom is handled in MapControls
    console.log("Search for:", code);
  }, []);

  // Loading state
  if (!leafletLoaded) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-xl ${className}`}
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (geoJSONError && mode === "select-countries") {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-muted rounded-xl p-8 ${className}`}
        style={{ height }}
      >
        <MapPinOff className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm mb-4">
          Failed to load map data
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden map-wrapper ${className}`}
      style={{ height }}
    >
      {/* Loading overlay */}
      {isLoadingGeoJSON && (
        <div className="absolute inset-0 bg-background/50 map-control-overlay flex items-center justify-center">
          <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading map data...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className="h-full w-full"
        preferCanvas={true}
        worldCopyJump={true}
        minZoom={2}
        maxZoom={18}
      >
        {/* Base tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Country layers - one per zone with its own color */}
        {showCountriesLayer && countriesData && countryZones.length > 0 && (
          <>
            {countryZones.map((zone) => (
              <CountryLayerDynamic
                key={zone.id}
                data={countriesData}
                selectedCountries={zone.countries}
                onCountryToggle={handleCountryToggle}
                zoneColor={zone.color}
                isHighlighted={zone.isHighlighted}
                disabled={mode === "view"}
              />
            ))}
          </>
        )}

        {/* Country layer for select-countries mode */}
        {showCountriesLayer && countriesData && mode === "select-countries" && (
          <CountryLayerDynamic
            data={countriesData}
            selectedCountries={selectedCountries}
            onCountryToggle={handleCountryToggle}
            zoneColor={zoneColor}
            isHighlighted={true}
            disabled={false}
          />
        )}

        {/* Local zones layer */}
        {layers.localZones && localZones.length > 0 && (
          <LocalZonesLayerDynamic
            zones={localZones}
            selectedZoneId={selectedZoneId}
            onZoneClick={onZoneSelect}
            editingZoneId={editingZoneId}
          />
        )}

        {/* Map controls */}
        {mode === "select-countries" && (
          <MapControlsDynamic
            onSearch={handleSearch}
            onBulkSelect={handleBulkSelect}
            onClearSelection={handleClearSelection}
            selectedCountries={selectedCountries}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            countriesData={countriesData}
            compact={compact}
          />
        )}

        {/* Selected countries panel - hidden in compact mode (shown externally) */}
        {mode === "select-countries" &&
          selectedCountries.length > 0 &&
          !compact && (
            <SelectedCountriesPanelDynamic
              selectedCountries={selectedCountries}
              onRemove={handleRemoveCountry}
            />
          )}
      </MapContainer>
    </div>
  );
}

// Re-export components for individual use
export { CountryLayer } from "./country-layer";
export { LocalZonesLayer, EditingZonePreview } from "./local-zones-layer";
export { MapControls, SelectedCountriesPanel } from "./map-controls";
