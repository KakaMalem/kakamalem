"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type L from "leaflet";
import {
  getCountryCode,
  getCountryNameFromFeature,
} from "../hooks/use-geojson";

interface CountryLayerProps {
  data: FeatureCollection;
  /** Countries to display (show with fill) */
  selectedCountries: string[];
  onCountryToggle: (code: string, name: string) => void;
  zoneColor?: string;
  /** Whether this entire layer is highlighted (selected zone) */
  isHighlighted?: boolean;
  disabled?: boolean;
  showAllBorders?: boolean;
}

/**
 * Interactive GeoJSON layer for country selection with hover effects
 */
export function CountryLayer({
  data,
  selectedCountries,
  onCountryToggle,
  zoneColor = "#3b82f6",
  isHighlighted = false,
  disabled = false,
  showAllBorders = true,
}: CountryLayerProps) {
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const _map = useMap();

  // Memoize selected countries set for faster lookups
  const selectedSet = useMemo(
    () => new Set(selectedCountries),
    [selectedCountries]
  );

  // Style function for each country feature
  const getStyle = useCallback(
    (feature: Feature | undefined): L.PathOptions => {
      if (!feature?.properties) return {};

      const code = getCountryCode(
        feature.properties as Record<string, unknown>
      );
      const isSelected = selectedSet.has(code);

      if (!isSelected) {
        // Not in this zone - transparent or thin border only
        return {
          fillColor: "transparent",
          fillOpacity: 0,
          color: showAllBorders ? "#94a3b8" : "transparent",
          weight: showAllBorders ? 0.5 : 0,
          opacity: 1,
        };
      }

      // In this zone - style based on whether zone is highlighted
      return {
        fillColor: zoneColor,
        fillOpacity: isHighlighted ? 0.35 : 0.2,
        color: zoneColor,
        weight: isHighlighted ? 2.5 : 1.5,
        opacity: 1,
      };
    },
    [selectedSet, zoneColor, isHighlighted, showAllBorders]
  );

  // Update styles when selection or highlight changes
  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.setStyle(getStyle as L.StyleFunction);
    }
  }, [selectedCountries, isHighlighted, getStyle]);

  // Attach event handlers to each feature
  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const props = feature.properties as Record<string, unknown> | null;
      if (!props) return;

      const code = getCountryCode(props);
      const name = getCountryNameFromFeature(props);

      // Skip if no valid code
      if (!code || code === "-99") return;

      // Tooltip on hover
      (layer as L.Path).bindTooltip(name, {
        sticky: true,
        direction: "top",
        className: "country-tooltip",
        offset: [0, -10],
      });

      // Event handlers
      layer.on({
        mouseover: (e) => {
          if (disabled) return;

          const target = e.target as L.Path;
          const isInZone = selectedSet.has(code);

          if (!isInZone) {
            // Hovering over country not in this zone
            target.setStyle({
              fillColor: "#e2e8f0",
              fillOpacity: 0.4,
              weight: 1.5,
              color: "#64748b",
            });
          } else {
            // Hovering over country in this zone
            target.setStyle({
              fillColor: zoneColor,
              fillOpacity: isHighlighted ? 0.5 : 0.35,
              weight: isHighlighted ? 3 : 2,
              color: zoneColor,
            });
          }
          target.bringToFront();
        },

        mouseout: (e) => {
          if (disabled) return;
          const target = e.target as L.Path;
          // Reset to computed style
          target.setStyle(getStyle(feature));
        },

        click: () => {
          if (disabled) return;
          onCountryToggle(code, name);
        },
      });
    },
    [selectedSet, zoneColor, isHighlighted, onCountryToggle, getStyle, disabled]
  );

  // Filter out invalid features
  const filteredData = useMemo(() => {
    return {
      ...data,
      features: data.features.filter((f: Feature) => {
        const code = getCountryCode(
          (f.properties || {}) as Record<string, unknown>
        );
        return code && code !== "-99";
      }),
    } as FeatureCollection;
  }, [data]);

  return (
    <GeoJSON
      ref={(ref: L.GeoJSON | null) => {
        geoJsonRef.current = ref;
      }}
      key={`countries-${selectedCountries.join(",")}-${isHighlighted}`} // Force re-render on selection/highlight change
      data={filteredData}
      style={getStyle as L.StyleFunction}
      onEachFeature={onEachFeature}
    />
  );
}

/**
 * Zoom map to fit a specific country
 */
export function useZoomToCountry() {
  const map = useMap();

  return useCallback(
    (countryCode: string, data: FeatureCollection) => {
      const feature = data.features.find((f: Feature) => {
        const code = getCountryCode(
          (f.properties || {}) as Record<string, unknown>
        );
        return code === countryCode.toUpperCase();
      });

      if (feature && feature.geometry) {
        try {
          // Create a temporary GeoJSON layer to get bounds
          const tempLayer = window.L.geoJSON(feature);
          const bounds = tempLayer.getBounds();

          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
          }
        } catch (error) {
          console.warn("Failed to zoom to country:", error);
        }
      }
    },
    [map]
  );
}
