"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Polygon, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import { Undo2, Redo2, RotateCcw } from "lucide-react";
import type L from "leaflet";
import {
  usePolygonDrawingStore,
  type Coordinate,
} from "@/lib/stores/use-polygon-drawing-store";
import { useStore } from "zustand";

interface PolygonPickerProps {
  /** Current polygon coordinates in [lat, lng] format */
  coordinates: Coordinate[];
  /** Called when coordinates change */
  onCoordinatesChange: (coords: Coordinate[]) => void;
  /** Zone color */
  color?: string;
  /** Disable interaction */
  disabled?: boolean;
}

/**
 * Interactive polygon picker for drawing delivery zones.
 * Click on the map to add points, click on first point to close the polygon.
 * Supports undo/redo with Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y).
 */
export function PolygonPicker({
  coordinates: externalCoords,
  onCoordinatesChange,
  color = "#3b82f6",
  disabled = false,
}: PolygonPickerProps) {
  const map = useMap();
  const isInitializedRef = useRef(false);
  const lastExternalCoordsRef = useRef<string>("");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null
  );

  // Get store state and actions
  const coordinates = usePolygonDrawingStore((state) => state.coordinates);
  const isDrawing = usePolygonDrawingStore((state) => state.isDrawing);
  const addPoint = usePolygonDrawingStore((state) => state.addPoint);
  const removePoint = usePolygonDrawingStore((state) => state.removePoint);
  const updatePoint = usePolygonDrawingStore((state) => state.updatePoint);
  const closePolygon = usePolygonDrawingStore((state) => state.closePolygon);
  const reset = usePolygonDrawingStore((state) => state.reset);
  const setCoordinates = usePolygonDrawingStore(
    (state) => state.setCoordinates
  );

  // Get temporal (undo/redo) store
  const temporalStore = usePolygonDrawingStore.temporal;
  const { undo, redo, clear: clearHistory } = useStore(temporalStore);
  const pastStates = useStore(temporalStore, (state) => state.pastStates);
  const futureStates = useStore(temporalStore, (state) => state.futureStates);

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  // Sync external coordinates to store on mount and when they change externally
  useEffect(() => {
    const externalCoordsString = JSON.stringify(externalCoords);
    const currentCoordsString = JSON.stringify(coordinates);

    // Only sync if external coords changed and are different from current
    if (
      externalCoordsString !== lastExternalCoordsRef.current &&
      externalCoordsString !== currentCoordsString
    ) {
      lastExternalCoordsRef.current = externalCoordsString;
      setCoordinates(externalCoords);

      // Clear history on initial load or external change
      if (!isInitializedRef.current) {
        clearHistory();
        isInitializedRef.current = true;
      }
    }
  }, [externalCoords, coordinates, setCoordinates, clearHistory]);

  // Sync store coordinates back to parent when they change
  useEffect(() => {
    const currentCoordsString = JSON.stringify(coordinates);

    // Only notify parent if coordinates actually changed
    if (currentCoordsString !== lastExternalCoordsRef.current) {
      lastExternalCoordsRef.current = currentCoordsString;
      onCoordinatesChange(coordinates);
    }
  }, [coordinates, onCoordinatesChange]);

  const isClosed = coordinates.length >= 3;

  // Handle map clicks to add points
  useMapEvents({
    click: (e) => {
      if (disabled) return;

      if (isDrawing) {
        addPoint([e.latlng.lat, e.latlng.lng] as Coordinate);
      }
    },
  });

  // Handle undo
  const handleUndo = useCallback(() => {
    if (disabled || !canUndo) return;
    undo();
  }, [disabled, canUndo, undo]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (disabled || !canRedo) return;
    redo();
  }, [disabled, canRedo, redo]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (disabled) return;
    reset();
    clearHistory();
  }, [disabled, reset, clearHistory]);

  // Handle point drag
  const handlePointDrag = useCallback(
    (index: number, newPos: L.LatLng) => {
      if (disabled) return;
      updatePoint(index, [newPos.lat, newPos.lng] as Coordinate);
    },
    [disabled, updatePoint]
  );

  // Handle point removal
  const handleRemovePoint = useCallback(
    (index: number) => {
      if (disabled) return;
      removePoint(index);
    },
    [disabled, removePoint]
  );

  // Handle close polygon
  const handleClosePolygon = useCallback(() => {
    if (coordinates.length >= 3) {
      closePolygon();
    }
  }, [coordinates.length, closePolygon]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      // Ctrl+Z or Cmd+Z for undo (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+Y or Cmd+Y for redo (Windows style)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Escape to reset
      if (e.key === "Escape" && isDrawing && coordinates.length > 0) {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    disabled,
    handleUndo,
    handleRedo,
    handleReset,
    isDrawing,
    coordinates.length,
  ]);

  // Create marker icons
  const createPointIcon = (
    index: number,
    isFirst: boolean,
    isHovered: boolean
  ) => {
    if (typeof window === "undefined" || !window.L) return undefined;

    const size = isFirst && isDrawing && coordinates.length >= 3 ? 16 : 12;
    const bgColor = isFirst && isDrawing ? "#22c55e" : "white";
    const borderColor = color;

    return window.L.divIcon({
      className: "polygon-point-marker",
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${bgColor};
          border: 3px solid ${borderColor};
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: ${disabled ? "default" : isFirst && isDrawing ? "pointer" : "move"};
          transform: scale(${isHovered ? 1.2 : 1});
          transition: transform 0.15s ease;
        "></div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Fit bounds when polygon changes significantly
  useEffect(() => {
    if (coordinates.length >= 3 && !isDrawing) {
      try {
        const bounds = window.L.latLngBounds(coordinates);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
      } catch {
        // Ignore bounds errors
      }
    }
  }, [map, coordinates, isDrawing]);

  return (
    <>
      {/* Draw the polygon if closed */}
      {isClosed && !isDrawing && (
        <Polygon
          positions={coordinates}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2,
          }}
        />
      )}

      {/* Draw lines while drawing */}
      {isDrawing && coordinates.length >= 2 && (
        <Polyline
          positions={coordinates}
          pathOptions={{
            color: color,
            weight: 2,
            dashArray: "5, 10",
          }}
        />
      )}

      {/* Draw preview line while drawing */}
      {isDrawing && coordinates.length >= 1 && (
        <Polyline
          positions={[coordinates[coordinates.length - 1], coordinates[0]]}
          pathOptions={{
            color: color,
            weight: 1,
            dashArray: "3, 6",
            opacity: 0.5,
          }}
        />
      )}

      {/* Draw points */}
      {coordinates.map((coord, index) => {
        const isFirst = index === 0;
        const icon = createPointIcon(
          index,
          isFirst,
          hoveredPointIndex === index
        );

        if (!icon) return null;

        return (
          <Marker
            // Include isDrawing in key to force marker recreation when state changes
            // This ensures event handlers are properly updated after undo/redo
            key={`${index}-${isDrawing}`}
            position={coord}
            icon={icon}
            draggable={!disabled && !isDrawing}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                if (isFirst && isDrawing && coordinates.length >= 3) {
                  handleClosePolygon();
                }
              },
              contextmenu: (e) => {
                e.originalEvent.preventDefault();
                handleRemovePoint(index);
              },
              dragend: (e) => {
                const marker = e.target;
                handlePointDrag(index, marker.getLatLng());
              },
              mouseover: () => setHoveredPointIndex(index),
              mouseout: () => setHoveredPointIndex(null),
            }}
          />
        );
      })}

      {/* Instructions and controls overlay */}
      <div
        className="absolute bottom-3 left-3 right-3 pointer-events-none"
        style={{ zIndex: 1000 }}
      >
        <div className="flex items-end gap-2">
          {/* Instructions */}
          <div className="inline-block pointer-events-auto bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-sm max-w-xs">
            {isDrawing ? (
              coordinates.length === 0 ? (
                <p className="font-medium text-foreground">
                  Click on the map to start drawing
                </p>
              ) : coordinates.length < 3 ? (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    Keep clicking
                  </span>{" "}
                  to add points ({coordinates.length}/3 min)
                </p>
              ) : (
                <p className="text-muted-foreground">
                  <span className="text-green-600 font-medium">
                    Click first point
                  </span>{" "}
                  to close, or keep adding
                </p>
              )
            ) : (
              <div className="space-y-1">
                <p className="font-medium text-foreground">Polygon complete</p>
                <p className="text-xs text-muted-foreground">
                  Drag points to adjust • Right-click to remove
                </p>
              </div>
            )}
          </div>

          {/* Undo/Redo/Reset buttons */}
          <div className="flex items-center gap-1 pointer-events-auto">
            {/* Undo button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo || disabled}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Redo button */}
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo || disabled}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Redo</span>
            </button>

            {/* Reset button */}
            {coordinates.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md text-sm font-medium text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50"
                title="Clear all (Escape)"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Re-export utilities from separate file to avoid SSR issues
export { coordinatesToGeoJSON, geoJSONToCoordinates } from "./polygon-utils";
export type { StrictPolygonGeojson } from "./polygon-utils";
