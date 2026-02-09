"use client";

import { useEffect, useRef, useCallback } from "react";
import { Circle, useMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";

interface RadiusPickerProps {
  centerLat?: number;
  centerLng?: number;
  radiusMeters: number;
  color?: string;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (radiusMeters: number) => void;
  disabled?: boolean;
}

export function RadiusPicker({
  centerLat,
  centerLng,
  radiusMeters,
  color = "#3b82f6",
  onCenterChange,
  onRadiusChange,
  disabled = false,
}: RadiusPickerProps) {
  const map = useMap();
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const edgeMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const isDraggingRef = useRef(false);

  const hasCenter = centerLat !== undefined && centerLng !== undefined;

  // Calculate edge position (east of center)
  const getEdgePosition = useCallback(
    (lat: number, lng: number, radius: number): [number, number] => {
      const edgeLng = lng + radius / 111320 / Math.cos((lat * Math.PI) / 180);
      return [lat, edgeLng];
    },
    []
  );

  // Handle map clicks to set initial center
  useMapEvents({
    click: (e) => {
      if (disabled || hasCenter) return;
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
  });

  // Create and manage all elements
  useEffect(() => {
    if (!hasCenter || typeof window === "undefined" || !window.L) return;

    const L = window.L;

    // Create circle
    const circle = L.circle([centerLat!, centerLng!], {
      radius: radiusMeters,
      color: color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    // Create center marker icon
    const centerIcon = L.divIcon({
      className: "radius-center-marker",
      html: `<div style="
        width: 18px;
        height: 18px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: ${disabled ? "default" : "grab"};
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    // Create center marker
    const centerMarker = L.marker([centerLat!, centerLng!], {
      icon: centerIcon,
      draggable: !disabled,
    }).addTo(map);
    centerMarkerRef.current = centerMarker;

    // Create edge marker icon
    const edgeIcon = L.divIcon({
      className: "radius-edge-marker",
      html: `<div style="
        width: 16px;
        height: 16px;
        background: white;
        border: 3px solid ${color};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: ${disabled ? "default" : "ew-resize"};
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    // Create edge marker
    const edgePos = getEdgePosition(centerLat!, centerLng!, radiusMeters);
    const edgeMarker = L.marker(edgePos, {
      icon: edgeIcon,
      draggable: !disabled,
    }).addTo(map);
    edgeMarkerRef.current = edgeMarker;

    // Center marker drag handlers
    centerMarker.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
    });

    centerMarker.on("drag", () => {
      const pos = centerMarker.getLatLng();
      // Move circle with center
      circle.setLatLng(pos);
      // Move edge marker to maintain radius
      const newEdgePos = getEdgePosition(pos.lat, pos.lng, circle.getRadius());
      edgeMarker.setLatLng(newEdgePos);
    });

    centerMarker.on("dragend", () => {
      isDraggingRef.current = false;
      map.dragging.enable();
      const pos = centerMarker.getLatLng();
      onCenterChange(pos.lat, pos.lng);
    });

    // Edge marker drag handlers
    edgeMarker.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
    });

    edgeMarker.on("drag", () => {
      const centerPos = circle.getLatLng();
      const edgePos = edgeMarker.getLatLng();

      // Calculate new radius
      const newRadius = map.distance(centerPos, edgePos);
      const clampedRadius = Math.max(100, Math.min(100000, newRadius));

      // Update circle radius
      circle.setRadius(clampedRadius);

      // Snap edge marker to circle edge (east side)
      const snappedPos = getEdgePosition(
        centerPos.lat,
        centerPos.lng,
        clampedRadius
      );
      edgeMarker.setLatLng(snappedPos);
    });

    edgeMarker.on("dragend", () => {
      isDraggingRef.current = false;
      map.dragging.enable();

      const centerPos = circle.getLatLng();
      const finalRadius = circle.getRadius();
      const clampedRadius = Math.max(100, Math.min(100000, finalRadius));

      // Ensure final position is correct
      const finalEdgePos = getEdgePosition(
        centerPos.lat,
        centerPos.lng,
        clampedRadius
      );
      edgeMarker.setLatLng(finalEdgePos);

      onRadiusChange(Math.round(clampedRadius));
    });

    return () => {
      centerMarker.remove();
      edgeMarker.remove();
      circle.remove();
      centerMarkerRef.current = null;
      edgeMarkerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasCenter, disabled, color, getEdgePosition]);

  // Update positions when props change (but not during drag)
  useEffect(() => {
    if (!hasCenter || isDraggingRef.current) return;
    if (
      !circleRef.current ||
      !centerMarkerRef.current ||
      !edgeMarkerRef.current
    )
      return;

    const circle = circleRef.current;
    const centerMarker = centerMarkerRef.current;
    const edgeMarker = edgeMarkerRef.current;

    // Update center
    circle.setLatLng([centerLat!, centerLng!]);
    centerMarker.setLatLng([centerLat!, centerLng!]);

    // Update radius and edge position
    circle.setRadius(radiusMeters);
    const edgePos = getEdgePosition(centerLat!, centerLng!, radiusMeters);
    edgeMarker.setLatLng(edgePos);
  }, [centerLat, centerLng, radiusMeters, hasCenter, getEdgePosition]);

  // Update colors
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setStyle({ color, fillColor: color });
    }
  }, [color]);

  return null;
}

export function RadiusPreview({
  centerLat,
  centerLng,
  radiusMeters,
  color = "#3b82f6",
}: {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  color?: string;
}) {
  return (
    <Circle
      center={[centerLat, centerLng]}
      radius={radiusMeters}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "10, 10",
      }}
    />
  );
}
