/**
 * GeoJSON Polygon utilities
 * Separated from polygon-picker.tsx to avoid SSR issues with react-leaflet imports
 */

/** GeoJSON Polygon type with strict coordinate typing */
export type StrictPolygonGeojson = {
  type: "Polygon";
  coordinates: [number, number][][];
};

/**
 * Convert [lat, lng] coordinates to GeoJSON format [lng, lat]
 */
export function coordinatesToGeoJSON(
  coordinates: [number, number][]
): StrictPolygonGeojson | null {
  if (coordinates.length < 3) return null;

  // GeoJSON requires the polygon to be closed (first point === last point)
  const geoJsonCoords: [number, number][] = coordinates.map(([lat, lng]) => [
    lng,
    lat,
  ]);

  // Close the ring if not already closed
  const first = geoJsonCoords[0];
  const last = geoJsonCoords[geoJsonCoords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    geoJsonCoords.push([first[0], first[1]]);
  }

  return {
    type: "Polygon",
    coordinates: [geoJsonCoords],
  };
}

/**
 * Convert GeoJSON polygon to [lat, lng] coordinates
 */
export function geoJSONToCoordinates(
  geojson: StrictPolygonGeojson | GeoJSON.Polygon | null
): [number, number][] {
  if (!geojson?.coordinates?.[0]) return [];

  // Convert [lng, lat] to [lat, lng] and remove the closing point
  const coords: [number, number][] = geojson.coordinates[0].map((coord) => {
    const [lng, lat] = coord as [number, number];
    return [lat, lng];
  });

  // Remove the last point if it's the same as the first (closing point)
  if (coords.length > 1) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      coords.pop();
    }
  }

  return coords;
}
