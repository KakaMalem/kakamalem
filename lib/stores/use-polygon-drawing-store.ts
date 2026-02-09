"use client";

import { create } from "zustand";
import { temporal } from "zundo";

// =============================================================================
// TYPES
// =============================================================================

export type Coordinate = [number, number]; // [lat, lng]

interface PolygonDrawingState {
  /** Current polygon coordinates */
  coordinates: Coordinate[];
  /** Whether the user is actively drawing (vs editing a closed polygon) */
  isDrawing: boolean;
}

interface PolygonDrawingActions {
  /** Add a point to the polygon */
  addPoint: (coord: Coordinate) => void;
  /** Remove a specific point by index */
  removePoint: (index: number) => void;
  /** Update a point's position (for dragging) */
  updatePoint: (index: number, coord: Coordinate) => void;
  /** Close the polygon (finish drawing) */
  closePolygon: () => void;
  /** Clear all points and start fresh */
  reset: () => void;
  /** Set coordinates from external source (e.g., loading existing polygon) */
  setCoordinates: (coords: Coordinate[]) => void;
  /** Set drawing mode */
  setIsDrawing: (isDrawing: boolean) => void;
}

type PolygonDrawingStore = PolygonDrawingState & PolygonDrawingActions;

// =============================================================================
// STORE
// =============================================================================

const initialState: PolygonDrawingState = {
  coordinates: [],
  isDrawing: true,
};

export const usePolygonDrawingStore = create<PolygonDrawingStore>()(
  temporal(
    (set, get) => ({
      ...initialState,

      addPoint: (coord) => {
        set((state) => ({
          coordinates: [...state.coordinates, coord],
        }));
      },

      removePoint: (index) => {
        set((state) => {
          const newCoords = state.coordinates.filter((_, i) => i !== index);
          return {
            coordinates: newCoords,
            isDrawing: newCoords.length === 0 ? true : state.isDrawing,
          };
        });
      },

      updatePoint: (index, coord) => {
        set((state) => {
          const newCoords = [...state.coordinates];
          newCoords[index] = coord;
          return { coordinates: newCoords };
        });
      },

      closePolygon: () => {
        const { coordinates } = get();
        if (coordinates.length >= 3) {
          set({ isDrawing: false });
        }
      },

      reset: () => {
        set({ coordinates: [], isDrawing: true });
      },

      setCoordinates: (coords) => {
        set({
          coordinates: coords,
          isDrawing: coords.length === 0,
        });
      },

      setIsDrawing: (isDrawing) => {
        set({ isDrawing });
      },
    }),
    {
      // Track both coordinates and isDrawing state in history
      partialize: (state) => ({
        coordinates: state.coordinates,
        isDrawing: state.isDrawing,
      }),
      // Limit history to 50 states to prevent memory issues
      limit: 50,
      // Equality function to prevent duplicate history entries
      equality: (pastState, currentState) =>
        JSON.stringify(pastState.coordinates) ===
          JSON.stringify(currentState.coordinates) &&
        pastState.isDrawing === currentState.isDrawing,
    }
  )
);

// =============================================================================
// TEMPORAL STORE HOOK
// =============================================================================

/**
 * Hook to access undo/redo functionality
 */
export const usePolygonHistory = () => {
  return usePolygonDrawingStore.temporal;
};

/**
 * Type for the temporal store
 */
export type PolygonTemporalStore = typeof usePolygonDrawingStore.temporal;
