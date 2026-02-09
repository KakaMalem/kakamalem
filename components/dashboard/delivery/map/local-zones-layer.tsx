"use client";

import { useMemo } from "react";
import { Circle, Polygon, Popup } from "react-leaflet";
import type { UnifiedDeliveryZone } from "@/lib/delivery/types";
import { formatRadius } from "@/lib/delivery/geojson-config";

interface LocalZonesLayerProps {
  zones: UnifiedDeliveryZone[];
  selectedZoneId?: string | null;
  onZoneClick?: (zone: UnifiedDeliveryZone) => void;
  showPopups?: boolean;
  editingZoneId?: string | null;
}

/**
 * Layer for rendering local delivery zones (radius and polygon types)
 */
export function LocalZonesLayer({
  zones,
  selectedZoneId,
  onZoneClick,
  showPopups = true,
  editingZoneId,
}: LocalZonesLayerProps) {
  // Filter to only local zones (radius and polygon)
  const localZones = useMemo(() => {
    return zones.filter(
      (z) =>
        (z.zoneType === "radius" || z.zoneType === "polygon") &&
        z.id !== editingZoneId
    );
  }, [zones, editingZoneId]);

  return (
    <>
      {localZones.map((zone) => {
        const isSelected = zone.id === selectedZoneId;
        const isActive = zone.isActive;

        if (
          zone.zoneType === "radius" &&
          zone.centerLat &&
          zone.centerLng &&
          zone.radiusMeters
        ) {
          return (
            <Circle
              key={zone.id}
              center={[Number(zone.centerLat), Number(zone.centerLng)]}
              radius={zone.radiusMeters}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: isSelected ? 0.35 : isActive ? 0.2 : 0.1,
                weight: isSelected ? 3 : 2,
                dashArray: isActive ? undefined : "5, 10",
                opacity: isActive ? 1 : 0.5,
              }}
              eventHandlers={{
                click: () => onZoneClick?.(zone),
              }}
            >
              {showPopups && (
                <Popup>
                  <ZonePopupContent zone={zone} />
                </Popup>
              )}
            </Circle>
          );
        }

        if (zone.zoneType === "polygon" && zone.polygonGeojson) {
          // Convert GeoJSON coordinates to Leaflet format
          const positions = convertGeoJSONToLatLng(zone.polygonGeojson);

          if (!positions.length) return null;

          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: isSelected ? 0.35 : isActive ? 0.2 : 0.1,
                weight: isSelected ? 3 : 2,
                dashArray: isActive ? undefined : "5, 10",
                opacity: isActive ? 1 : 0.5,
              }}
              eventHandlers={{
                click: () => onZoneClick?.(zone),
              }}
            >
              {showPopups && (
                <Popup>
                  <ZonePopupContent zone={zone} />
                </Popup>
              )}
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
}

/**
 * Popup content for zones
 */
function ZonePopupContent({ zone }: { zone: UnifiedDeliveryZone }) {
  return (
    <div className="min-w-37.5">
      <div className="font-semibold text-sm">{zone.name}</div>
      {zone.zoneType === "radius" && zone.radiusMeters && (
        <div className="text-xs text-muted-foreground mt-1">
          Radius: {formatRadius(zone.radiusMeters)}
        </div>
      )}
      {!zone.isActive && (
        <div className="text-xs text-amber-600 mt-1">Inactive</div>
      )}
    </div>
  );
}

/**
 * Convert GeoJSON polygon coordinates to Leaflet LatLng format
 */
function convertGeoJSONToLatLng(
  geojson: GeoJSON.Polygon
): [number, number][][] {
  if (!geojson.coordinates || !geojson.coordinates.length) {
    return [];
  }

  // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
  return geojson.coordinates.map((ring) =>
    ring.map((coord) => [coord[1], coord[0]] as [number, number])
  );
}

/**
 * Component for rendering an editing zone preview (while creating/editing)
 */
interface EditingZonePreviewProps {
  zoneType: "radius" | "polygon";
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  polygonCoordinates?: [number, number][];
  color?: string;
}

export function EditingZonePreview({
  zoneType,
  centerLat,
  centerLng,
  radiusMeters,
  polygonCoordinates,
  color = "#3b82f6",
}: EditingZonePreviewProps) {
  if (zoneType === "radius" && centerLat && centerLng && radiusMeters) {
    return (
      <Circle
        center={[centerLat, centerLng]}
        radius={radiusMeters}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2,
          dashArray: "10, 10",
        }}
      />
    );
  }

  if (
    zoneType === "polygon" &&
    polygonCoordinates &&
    polygonCoordinates.length >= 3
  ) {
    return (
      <Polygon
        positions={polygonCoordinates}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2,
          dashArray: "10, 10",
        }}
      />
    );
  }

  return null;
}
