"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  MapPin,
  Navigation,
  X,
  MapPinOff,
  Search,
  Check,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computePlusCode, formatPlusCodeForDisplay } from "@/lib/geo";
import {
  useLocationPermission,
  type LocationErrorType,
} from "@/lib/hooks/use-location-permission";

// Location data with history for accuracy analysis
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "gps" | "manual";
  plusCode: string;
  // Reverse geocoded city name (for shipping zone matching)
  city?: string;
  // Location history for accuracy analysis
  locationHistory?: {
    gps?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp: number;
    };
    manual?: { latitude: number; longitude: number; timestamp: number };
  };
}

// Simplified delivery zone type for display purposes (compatible with CheckoutDeliveryZone)
interface DeliveryZoneDisplay {
  id: string;
  name: string;
  zoneType?: "radius" | "polygon" | "country" | "worldwide";
  centerLat: string | null;
  centerLng: string | null;
  radiusMeters: number | null;
  polygonGeojson?: unknown | null;
  color: string | null;
  deliveryFee?: string | null;
  freeShippingThreshold?: string | null;
  estimatedDeliveryTime?: string | null;
  isActive?: boolean;
}

interface LocationPickerProps {
  value?: { latitude: number; longitude: number } | null;
  onChange: (location: LocationData) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  deliveryZones?: DeliveryZoneDisplay[];
  /** Store's physical location - shown as a shop marker on the map */
  storeLocation?: { lat: number; lng: number } | null;
}

// Search result type from Nominatim
interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// Check if a point is within any delivery zone
interface ZoneCheckResult {
  inZone: boolean;
  zoneName?: string;
  deliveryFee?: string | null;
  freeShippingThreshold?: string | null;
  isWorldwide?: boolean;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  coordinates: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const xi = coordinates[i][0];
    const yi = coordinates[i][1];
    const xj = coordinates[j][0];
    const yj = coordinates[j][1];

    if (
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointInDeliveryZones(
  lat: number,
  lng: number,
  zones: DeliveryZoneDisplay[]
): ZoneCheckResult {
  // If no zones configured, allow anywhere
  if (zones.length === 0) {
    return { inZone: true, isWorldwide: true };
  }

  // Check specific zones first
  for (const zone of zones) {
    if (zone.isActive === false) continue;

    // Worldwide zone matches everything
    if (zone.zoneType === "worldwide") {
      return {
        inZone: true,
        zoneName: zone.name,
        deliveryFee: zone.deliveryFee,
        freeShippingThreshold: zone.freeShippingThreshold,
        isWorldwide: true,
      };
    }

    // Radius zone check
    if (
      zone.zoneType === "radius" ||
      (!zone.zoneType && zone.centerLat && zone.centerLng && zone.radiusMeters)
    ) {
      if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) continue;

      const centerLat = parseFloat(zone.centerLat);
      const centerLng = parseFloat(zone.centerLng);

      // Haversine distance calculation
      const R = 6371000; // Earth's radius in meters
      const dLat = ((lat - centerLat) * Math.PI) / 180;
      const dLng = ((lng - centerLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((centerLat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance <= zone.radiusMeters) {
        return {
          inZone: true,
          zoneName: zone.name,
          deliveryFee: zone.deliveryFee,
          freeShippingThreshold: zone.freeShippingThreshold,
        };
      }
    }

    // Polygon zone check
    if (zone.zoneType === "polygon" && zone.polygonGeojson) {
      try {
        const geojson = zone.polygonGeojson as {
          type: string;
          coordinates: [number, number][][];
        };
        if (geojson.type === "Polygon" && geojson.coordinates?.[0]) {
          // GeoJSON uses [lng, lat] order, convert to [lat, lng] for our function
          const coords = geojson.coordinates[0].map(
            (c) => [c[1], c[0]] as [number, number]
          );
          if (isPointInPolygon(lat, lng, coords)) {
            return {
              inZone: true,
              zoneName: zone.name,
              deliveryFee: zone.deliveryFee,
              freeShippingThreshold: zone.freeShippingThreshold,
            };
          }
        }
      } catch {
        // Invalid polygon, skip
      }
    }
  }

  // Check if there's a worldwide fallback
  const worldwideZone = zones.find(
    (z) => z.zoneType === "worldwide" && z.isActive !== false
  );
  if (worldwideZone) {
    return {
      inZone: true,
      zoneName: worldwideZone.name,
      deliveryFee: worldwideZone.deliveryFee,
      freeShippingThreshold: worldwideZone.freeShippingThreshold,
      isWorldwide: true,
    };
  }

  return { inZone: false };
}

// Isometric 3D City Illustration Component
function CityIllustration({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-sky-100 via-sky-50 to-amber-50/30" />

      {/* Animated clouds */}
      <svg
        className="absolute top-4 left-0 w-full h-16 opacity-60"
        viewBox="0 0 400 60"
      >
        <g style={{ animation: "float-cloud 20s linear infinite" }}>
          <ellipse cx="50" cy="30" rx="25" ry="12" fill="white" />
          <ellipse cx="70" cy="28" rx="20" ry="10" fill="white" />
          <ellipse cx="35" cy="32" rx="15" ry="8" fill="white" />
        </g>
        <g
          style={{
            animation: "float-cloud 25s linear infinite",
            animationDelay: "-10s",
          }}
        >
          <ellipse cx="250" cy="25" rx="30" ry="14" fill="white" />
          <ellipse cx="275" cy="22" rx="22" ry="11" fill="white" />
          <ellipse cx="230" cy="28" rx="18" ry="9" fill="white" />
        </g>
      </svg>

      {/* Isometric City Scene */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMax slice"
        style={{ height: "75%" }}
      >
        <defs>
          {/* Road pattern */}
          <pattern
            id="road-lines"
            patternUnits="userSpaceOnUse"
            width="20"
            height="4"
          >
            <rect width="12" height="2" y="1" fill="white" opacity="0.8" />
          </pattern>
        </defs>

        {/* Ground/grass */}
        <rect x="0" y="140" width="400" height="60" fill="#86efac" />

        {/* Main road - horizontal */}
        <rect x="0" y="150" width="400" height="35" fill="#475569" />
        <rect x="0" y="166" width="400" height="3" fill="url(#road-lines)" />

        {/* Crosswalk */}
        <g>
          <rect
            x="180"
            y="150"
            width="8"
            height="35"
            fill="white"
            opacity="0.9"
          />
          <rect
            x="192"
            y="150"
            width="8"
            height="35"
            fill="white"
            opacity="0.9"
          />
          <rect
            x="204"
            y="150"
            width="8"
            height="35"
            fill="white"
            opacity="0.9"
          />
          <rect
            x="216"
            y="150"
            width="8"
            height="35"
            fill="white"
            opacity="0.9"
          />
        </g>

        {/* Building 1 - Tall blue building */}
        <g transform="translate(30, 60)">
          <polygon points="0,90 0,20 30,0 60,20 60,90 30,90" fill="#3b82f6" />
          <polygon points="60,20 60,90 90,70 90,0 30,0" fill="#2563eb" />
          <rect x="8" y="30" width="8" height="10" fill="#bfdbfe" />
          <rect x="22" y="30" width="8" height="10" fill="#bfdbfe" />
          <rect x="8" y="50" width="8" height="10" fill="#bfdbfe" />
          <rect x="22" y="50" width="8" height="10" fill="#bfdbfe" />
          <rect x="8" y="70" width="8" height="10" fill="#fef08a" />
          <rect x="22" y="70" width="8" height="10" fill="#bfdbfe" />
        </g>

        {/* Building 2 - Pink/red shop */}
        <g transform="translate(100, 95)">
          <polygon points="0,55 0,15 20,0 40,15 40,55 0,55" fill="#fb7185" />
          <polygon points="40,15 40,55 55,45 55,5 20,0" fill="#e11d48" />
          <polygon points="-5,25 45,25 40,35 0,35" fill="#fda4af" />
          <rect x="12" y="35" width="16" height="20" fill="#7f1d1d" />
        </g>

        {/* Building 3 - Tall yellow building */}
        <g transform="translate(280, 50)">
          <polygon points="0,100 0,25 25,5 50,25 50,100" fill="#fbbf24" />
          <polygon points="50,25 50,100 75,80 75,5 25,5" fill="#d97706" />
          <rect x="8" y="35" width="10" height="12" fill="#fef3c7" />
          <rect x="25" y="35" width="10" height="12" fill="#fef3c7" />
          <rect x="8" y="55" width="10" height="12" fill="#fef3c7" />
          <rect x="25" y="55" width="10" height="12" fill="#fef3c7" />
          <rect x="8" y="75" width="10" height="12" fill="#fef3c7" />
          <rect
            x="25"
            y="75"
            width="10"
            height="12"
            fill="#fbbf24"
            opacity="0.6"
          />
        </g>

        {/* Trees */}
        <g transform="translate(155, 120)">
          <rect x="8" y="20" width="6" height="15" fill="#854d0e" />
          <ellipse cx="11" cy="12" rx="14" ry="16" fill="#22c55e" />
          <ellipse cx="8" cy="8" rx="10" ry="12" fill="#4ade80" />
        </g>
        <g transform="translate(240, 115)">
          <rect x="6" y="18" width="5" height="12" fill="#854d0e" />
          <ellipse cx="8" cy="10" rx="12" ry="14" fill="#22c55e" />
          <ellipse cx="6" cy="6" rx="8" ry="10" fill="#4ade80" />
        </g>

        {/* Animated vehicles */}
        <g
          style={{
            animation: isLoading ? "drive-right 4s linear infinite" : "none",
          }}
        >
          <g transform="translate(50, 155)">
            <rect x="0" y="8" width="40" height="14" rx="3" fill="#ef4444" />
            <rect x="5" y="2" width="25" height="10" rx="2" fill="#ef4444" />
            <rect x="8" y="4" width="8" height="6" rx="1" fill="#bfdbfe" />
            <rect x="19" y="4" width="8" height="6" rx="1" fill="#bfdbfe" />
            <circle cx="10" cy="22" r="5" fill="#1f2937" />
            <circle cx="30" cy="22" r="5" fill="#1f2937" />
          </g>
        </g>

        {/* Delivery scooter */}
        <g
          transform="translate(350, 158)"
          style={{
            animation: isLoading ? "wobble 0.5s ease-in-out infinite" : "none",
          }}
        >
          <rect x="0" y="4" width="12" height="10" rx="1" fill="#22c55e" />
          <rect x="10" y="6" width="18" height="8" rx="1" fill="#16a34a" />
          <rect x="2" y="-4" width="10" height="8" fill="#ea580c" />
          <text x="4" y="2" fontSize="4" fill="white" fontWeight="bold">
            KM
          </text>
          <circle cx="4" cy="16" r="3" fill="#1f2937" />
          <circle cx="24" cy="16" r="3" fill="#1f2937" />
        </g>

        {/* Location Pin */}
        <g
          transform="translate(190, 95)"
          style={{
            animation: isLoading
              ? "bounce-pin 1s ease-in-out infinite"
              : "none",
          }}
        >
          <ellipse cx="15" cy="50" rx="10" ry="4" fill="rgba(0,0,0,0.2)" />
          <path
            d="M15 0C8 0 2 6 2 13.5C2 24 15 40 15 40S28 24 28 13.5C28 6 22 0 15 0Z"
            fill="#ef4444"
          />
          <circle cx="15" cy="13" r="5" fill="white" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes float-cloud {
          0% {
            transform: translateX(-100px);
          }
          100% {
            transform: translateX(500px);
          }
        }
        @keyframes drive-right {
          0% {
            transform: translateX(-80px);
          }
          100% {
            transform: translateX(400px);
          }
        }
        @keyframes bounce-pin {
          0%,
          100% {
            transform: translate(190px, 95px);
          }
          50% {
            transform: translate(190px, 85px);
          }
        }
        @keyframes wobble {
          0%,
          100% {
            transform: rotate(-2deg);
          }
          50% {
            transform: rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}

function getErrorMessage(errorType: LocationErrorType): string {
  switch (errorType) {
    case "permission_denied":
      return "Location access denied. Please enable location permissions in your browser settings.";
    case "android_silent_deny":
      return "Location permission needed. On Android: tap the lock icon (🔒) in the address bar → Site settings → Location → Allow, then try again.";
    case "position_unavailable":
      return "Unable to determine location. Please check that location services are enabled on your device.";
    case "timeout":
      return "Location request timed out. Please try again.";
    default:
      return "Failed to get location. Please try again or select manually on the map.";
  }
}

export function LocationPicker({
  value,
  onChange,
  error,
  disabled,
  className,
  deliveryZones = [],
  storeLocation,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accuracyCircleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneCirclesRef = useRef<any[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapInitializedRef = useRef(false);
  const isSelectingResultRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(
    () => typeof window !== "undefined" && !!window.L
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Location history for accuracy tracking
  const [locationHistory, setLocationHistory] = useState<{
    gps?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp: number;
    };
    manual?: { latitude: number; longitude: number; timestamp: number };
  }>({});

  // City name for Plus Code display
  const [cityName, setCityName] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(false);

  // Zone validation
  const [zoneStatus, setZoneStatus] = useState<ZoneCheckResult | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  const { permissionState, isCheckingPermission, requestLocation } =
    useLocationPermission();

  const hasDeliveryZones = deliveryZones.length > 0;
  const showMap = !!value || hasDeliveryZones;

  // Load Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !showMap || leafletLoaded) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, [showMap, leafletLoaded]);

  // Search for locations using Nominatim
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=af&accept-language=en`,
        { headers: { "User-Agent": "KakaMalem/1.0 (delivery-platform)" } }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        setShowSearchResults(true);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(query);
      }, 300);
    },
    [searchLocations]
  );

  // Store current location data for city update callback
  const currentLocationRef = useRef<{
    lat: number;
    lng: number;
    accuracy?: number;
    source: "gps" | "manual";
    plusCode: string;
    locationHistory: typeof locationHistory;
  } | null>(null);

  // Fetch city name for Plus Code display AND shipping zone matching
  const fetchCityName = useCallback(
    async (lat: number, lng: number) => {
      setIsFetchingCity(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`,
          { headers: { "User-Agent": "KakaMalem/1.0 (delivery-platform)" } }
        );

        if (response.ok) {
          const data = await response.json();
          const address = data.address;
          const city =
            address?.city ||
            address?.town ||
            address?.village ||
            address?.municipality ||
            null;
          setCityName(city);

          // Update parent with city data for shipping zone matching
          if (city && currentLocationRef.current) {
            const loc = currentLocationRef.current;
            // Only update if this is still the current location
            if (loc.lat === lat && loc.lng === lng) {
              onChange({
                latitude: loc.lat,
                longitude: loc.lng,
                accuracy: loc.accuracy,
                source: loc.source,
                plusCode: loc.plusCode,
                city,
                locationHistory: loc.locationHistory,
              });
            }
          }
        }
      } catch {
        // Silently fail
      } finally {
        setIsFetchingCity(false);
      }
    },
    [onChange]
  );

  // Handle location selection (auto-confirm)
  const handleLocationSelect = useCallback(
    (lat: number, lng: number, source: "gps" | "manual", accuracy?: number) => {
      // Update location history
      const newHistory = { ...locationHistory };
      if (source === "gps") {
        newHistory.gps = {
          latitude: lat,
          longitude: lng,
          accuracy,
          timestamp: Date.now(),
        };
      } else {
        newHistory.manual = {
          latitude: lat,
          longitude: lng,
          timestamp: Date.now(),
        };
      }
      setLocationHistory(newHistory);

      // Check zone status
      if (hasDeliveryZones) {
        const status = isPointInDeliveryZones(lat, lng, deliveryZones);
        setZoneStatus(status);
      }

      // Auto-confirm - call onChange immediately (without city initially)
      const plusCode = computePlusCode(lat, lng);

      // Store current location for city update callback
      currentLocationRef.current = {
        lat,
        lng,
        accuracy,
        source,
        plusCode,
        locationHistory: newHistory,
      };

      onChange({
        latitude: lat,
        longitude: lng,
        accuracy,
        source,
        plusCode,
        locationHistory: newHistory,
      });

      // Fetch city name (will call onChange again with city once fetched)
      fetchCityName(lat, lng);
    },
    [locationHistory, hasDeliveryZones, deliveryZones, fetchCityName, onChange]
  );

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (result: SearchResult) => {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      setSearchQuery("");
      setSearchResults([]);
      setShowSearchResults(false);

      // Update marker on existing map
      if (mapInstanceRef.current && markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.setView([lat, lng], 17);
      }

      handleLocationSelect(lat, lng, "manual");
    },
    [handleLocationSelect]
  );

  // Copy Plus Code to clipboard
  const handleCopyPlusCode = useCallback(async () => {
    if (!value) return;
    const plusCode = computePlusCode(value.latitude, value.longitude);
    try {
      await navigator.clipboard.writeText(
        formatPlusCodeForDisplay(plusCode, cityName)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [value, cityName]);

  // Store initial value ref for map initialization only
  const initialValueRef = useRef(value);

  // Initialize map (only once)
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInitializedRef.current) return;
    if (!showMap) return;

    const L = window.L;

    // Determine initial center - use the ref to avoid re-running on value changes
    const initialValue = initialValueRef.current;
    let initialCenter: [number, number];
    let initialZoom = 14;

    if (initialValue) {
      initialCenter = [initialValue.latitude, initialValue.longitude];
      initialZoom = 16;
    } else if (deliveryZones.length > 0) {
      // Try to find a zone with center coordinates (radius zones)
      const radiusZone = deliveryZones.find(
        (z) => z.zoneType === "radius" && z.centerLat && z.centerLng
      );
      // Or try to find a polygon zone
      const polygonZone = deliveryZones.find(
        (z) => z.zoneType === "polygon" && z.polygonGeojson
      );

      if (radiusZone && radiusZone.centerLat && radiusZone.centerLng) {
        initialCenter = [
          parseFloat(radiusZone.centerLat),
          parseFloat(radiusZone.centerLng),
        ];
        const radius = radiusZone.radiusMeters || 3000;
        if (radius > 10000) initialZoom = 11;
        else if (radius > 5000) initialZoom = 12;
        else if (radius > 2000) initialZoom = 13;
      } else if (polygonZone && polygonZone.polygonGeojson) {
        // Get center of polygon from first coordinate
        try {
          const geojson = polygonZone.polygonGeojson as {
            type: string;
            coordinates: [number, number][][];
          };
          if (geojson.type === "Polygon" && geojson.coordinates?.[0]?.[0]) {
            // Calculate centroid from first few vertices
            const coords = geojson.coordinates[0];
            const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
            const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
            initialCenter = [sumLat / coords.length, sumLng / coords.length];
            initialZoom = 13;
          } else {
            initialCenter = [34.5553, 69.2075]; // Kabul
            initialZoom = 12;
          }
        } catch {
          initialCenter = [34.5553, 69.2075]; // Kabul
          initialZoom = 12;
        }
      } else {
        // Fallback to legacy zones with centerLat/centerLng
        const legacyZone = deliveryZones.find(
          (z) => z.centerLat && z.centerLng
        );
        if (legacyZone && legacyZone.centerLat && legacyZone.centerLng) {
          initialCenter = [
            parseFloat(legacyZone.centerLat),
            parseFloat(legacyZone.centerLng),
          ];
          const radius = legacyZone.radiusMeters || 3000;
          if (radius > 10000) initialZoom = 11;
          else if (radius > 5000) initialZoom = 12;
          else if (radius > 2000) initialZoom = 13;
        } else {
          initialCenter = [34.5553, 69.2075]; // Kabul
          initialZoom = 12;
        }
      }
    } else {
      initialCenter = [34.5553, 69.2075];
      initialZoom = 12;
    }

    // Create map with zoom control in bottom-left
    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(initialCenter, initialZoom);

    // Add zoom control to bottom-left
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Draw delivery zones - sort by specificity: polygons first, then radius (largest to smallest)
    zoneCirclesRef.current = [];
    const sortedZones = [...deliveryZones]
      .filter((z) => z.isActive !== false)
      .sort((a, b) => {
        // Polygon zones first
        if (a.zoneType === "polygon" && b.zoneType !== "polygon") return 1;
        if (a.zoneType !== "polygon" && b.zoneType === "polygon") return -1;
        // Then by radius (largest first)
        return (b.radiusMeters ?? 0) - (a.radiusMeters ?? 0);
      });

    sortedZones.forEach((zone) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let layer: any = null;

      // Render radius zones as circles
      if (
        zone.zoneType === "radius" ||
        (!zone.zoneType &&
          zone.centerLat &&
          zone.centerLng &&
          zone.radiusMeters)
      ) {
        if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) return;

        layer = L.circle(
          [parseFloat(zone.centerLat), parseFloat(zone.centerLng)],
          {
            radius: zone.radiusMeters,
            color: zone.color || "#3b82f6",
            fillColor: zone.color || "#3b82f6",
            fillOpacity: 0.12,
            weight: 2,
            dashArray: "5, 5",
          }
        ).addTo(map);
      }

      // Render polygon zones
      if (zone.zoneType === "polygon" && zone.polygonGeojson) {
        try {
          const geojson = zone.polygonGeojson as {
            type: string;
            coordinates: [number, number][][];
          };
          if (geojson.type === "Polygon" && geojson.coordinates?.[0]) {
            // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
            const latLngs = geojson.coordinates[0].map(
              (c) => [c[1], c[0]] as [number, number]
            );
            layer = L.polygon(latLngs, {
              color: zone.color || "#3b82f6",
              fillColor: zone.color || "#3b82f6",
              fillOpacity: 0.12,
              weight: 2,
              dashArray: "5, 5",
            }).addTo(map);
          }
        } catch {
          // Invalid polygon, skip
        }
      }

      if (!layer) return;

      // Continue with tooltip (replaces the old circle variable)

      // Build tooltip with zone name and delivery price
      const fee = parseFloat(zone.deliveryFee || "0");
      const freeThreshold = zone.freeShippingThreshold
        ? parseFloat(zone.freeShippingThreshold)
        : null;

      let tooltipContent = `<div class="zone-tooltip-content">
        <strong>${zone.name}</strong><br/>`;

      if (fee === 0) {
        tooltipContent += `<span style="color: #16a34a;">Free delivery</span>`;
      } else {
        tooltipContent += `<span>${fee.toLocaleString()} AFN</span>`;
        if (freeThreshold && freeThreshold > 0) {
          tooltipContent += `<br/><span style="font-size: 11px; color: #6b7280;">Free over ${freeThreshold.toLocaleString()} AFN</span>`;
        }
      }

      if (zone.estimatedDeliveryTime) {
        tooltipContent += `<br/><span style="font-size: 11px; color: #6b7280;">${zone.estimatedDeliveryTime}</span>`;
      }

      tooltipContent += `</div>`;

      layer.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "center",
        className: "zone-price-tooltip",
      });

      zoneCirclesRef.current.push(layer);
    });

    // Add custom tooltip styles
    const tooltipStyle = document.createElement("style");
    tooltipStyle.id = "zone-tooltip-styles";
    if (!document.getElementById("zone-tooltip-styles")) {
      tooltipStyle.textContent = `
        .zone-price-tooltip {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          font-size: 13px !important;
        }
        .zone-price-tooltip::before {
          display: none !important;
        }
        .zone-tooltip-content {
          line-height: 1.4;
        }
        .custom-store-marker {
          background: transparent !important;
          border: none !important;
        }
        .store-tooltip {
          background: #ca8a04 !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        .store-tooltip::before {
          border-top-color: #ca8a04 !important;
        }
      `;
      document.head.appendChild(tooltipStyle);
    }

    // Add store location marker if available (gold/yellow for stores)
    if (storeLocation) {
      const storeIcon = L.divIcon({
        className: "custom-store-marker",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #ca8a04;
            border: 2px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
              <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const storeMarker = L.marker([storeLocation.lat, storeLocation.lng], {
        icon: storeIcon,
        zIndexOffset: -100,
      }).addTo(map);

      storeMarker.bindTooltip("Store Location", {
        permanent: false,
        direction: "top",
        className: "store-tooltip",
      });
    }

    // Fit to zones if no initial value
    if (!initialValue && zoneCirclesRef.current.length > 0) {
      const group = L.featureGroup(zoneCirclesRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    // Add marker if we have an initial value
    if (initialValue) {
      markerRef.current = L.marker([
        initialValue.latitude,
        initialValue.longitude,
      ]).addTo(map);
    }

    mapInstanceRef.current = map;
    mapInitializedRef.current = true;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
      zoneCirclesRef.current = [];
      mapInitializedRef.current = false;
    };
    // Only depend on leafletLoaded, showMap, deliveryZones, and storeLocation - NOT value
  }, [leafletLoaded, showMap, deliveryZones, storeLocation]);

  // Separate effect for map click handler to avoid stale closures
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const map = mapInstanceRef.current;
    const L = window.L;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapClick = (e: any) => {
      if (disabled) return;
      const { lat, lng } = e.latlng;

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }

      // Remove old accuracy circle
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }

      handleLocationSelect(lat, lng, "manual");
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [leafletLoaded, disabled, handleLocationSelect]);

  // Update marker position when value changes (without recreating map)
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded || !value) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.latitude, value.longitude]);
    } else {
      markerRef.current = L.marker([value.latitude, value.longitude]).addTo(
        map
      );
    }
  }, [value, leafletLoaded]);

  // Handle GPS location request
  const handleGetCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    setGpsError(null);

    const result = await requestLocation();

    if (result.error) {
      setGpsError(getErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    if (result.position) {
      const { latitude, longitude, accuracy } = result.position.coords;

      // Update marker on existing map
      if (mapInstanceRef.current) {
        const L = window.L;
        const map = mapInstanceRef.current;

        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          markerRef.current = L.marker([latitude, longitude]).addTo(map);
        }

        // Add accuracy circle
        if (accuracy && accuracy > 10) {
          if (accuracyCircleRef.current) {
            map.removeLayer(accuracyCircleRef.current);
          }
          accuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 1,
            dashArray: "5, 5",
          }).addTo(map);
        }

        map.setView([latitude, longitude], 17);
      }

      handleLocationSelect(latitude, longitude, "gps", accuracy || undefined);
    }

    setIsLoading(false);
  }, [requestLocation, handleLocationSelect]);

  const handleButtonClick = useCallback(() => {
    if (isLoading) {
      setIsLoading(false);
    } else {
      handleGetCurrentLocation();
    }
  }, [isLoading, handleGetCurrentLocation]);

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {/* Search Bar - Outside map to avoid zoom button collision */}
      {showMap && leafletLoaded && (
        <div className="relative">
          <Search className="absolute left-3.5 sm:left-4 top-1/2 size-4 sm:size-5 -translate-y-1/2 text-gray-400 z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() =>
              searchResults.length > 0 && setShowSearchResults(true)
            }
            onBlur={() => {
              // Delay hiding to allow click events on results to fire
              // Use a longer timeout and check if user is selecting a result
              setTimeout(() => {
                if (!isSelectingResultRef.current) {
                  setShowSearchResults(false);
                }
              }, 300);
            }}
            placeholder="Search landmark, mosque, university..."
            className="w-full rounded-xl border bg-white py-3 sm:py-3.5 pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={disabled}
          />
          {isSearching && (
            <Loader2 className="absolute right-3.5 sm:right-4 top-1/2 size-4 sm:size-5 -translate-y-1/2 animate-spin text-gray-400" />
          )}

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 max-h-56 sm:max-h-64 overflow-y-auto rounded-xl bg-white shadow-lg border z-1000">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  onMouseDown={() => {
                    // Prevent the blur timeout from hiding results
                    isSelectingResultRef.current = true;
                  }}
                  onClick={() => {
                    handleSearchResultSelect(result);
                    // Reset the ref after selection
                    isSelectingResultRef.current = false;
                  }}
                  className="flex w-full items-start gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 text-left text-sm sm:text-base hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl border-b border-gray-100 last:border-b-0"
                >
                  <MapPin className="mt-0.5 size-4 sm:size-5 shrink-0 text-gray-400" />
                  <span className="line-clamp-2">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Container - isolate creates a new stacking context to prevent z-index leak to navbar */}
      <div
        className={cn(
          "relative isolate w-full overflow-hidden rounded-2xl border bg-white shadow-sm",
          error && "border-destructive",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {!showMap ? (
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={disabled}
            className="group relative block w-full h-72 sm:h-80 md:h-96 lg:h-105 cursor-pointer text-left transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <CityIllustration isLoading={isLoading} />

            <div className="absolute inset-x-0 top-0 z-10 bg-linear-to-b from-white/90 via-white/70 to-transparent pb-16 pt-6 px-4 sm:px-6 md:pt-8 md:pb-20">
              <div className="text-center">
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                  {isLoading
                    ? "Finding your location..."
                    : "Where should we deliver?"}
                </h3>
                <p className="text-sm sm:text-base text-gray-500 mt-1">
                  {isLoading
                    ? "Please allow access when prompted"
                    : "Tap to share your location"}
                </p>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-white/95 via-white/80 to-transparent pt-16 pb-5 px-4 sm:px-6 md:pb-6">
              <div
                className={cn(
                  "flex items-center justify-center gap-2.5 rounded-xl py-3.5 px-5 transition-all duration-200 mx-auto max-w-xs sm:max-w-sm md:py-4",
                  isLoading || isCheckingPermission
                    ? "bg-gray-100 text-gray-600"
                    : permissionState === "denied"
                      ? "bg-red-50 text-red-600"
                      : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                )}
              >
                {isLoading || isCheckingPermission ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-sm sm:text-base font-medium">
                      {isCheckingPermission
                        ? "Checking permissions..."
                        : "Tap to cancel"}
                    </span>
                  </>
                ) : permissionState === "denied" ? (
                  <>
                    <MapPinOff className="size-5" />
                    <span className="text-sm sm:text-base font-medium">
                      Location blocked - tap to retry
                    </span>
                  </>
                ) : (
                  <>
                    <Navigation className="size-5" />
                    <span className="text-sm sm:text-base font-medium">
                      Use my location
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        ) : !leafletLoaded ? (
          <div className="relative h-72 sm:h-80 md:h-96 lg:h-105">
            <CityIllustration isLoading={true} />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
              <div className="rounded-xl bg-white/90 px-6 py-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2.5 text-sm sm:text-base font-medium text-gray-600">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  Loading map...
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Map - Responsive height: 288px mobile, 320px sm, 360px md/iPad, 400px lg+ */}
            <div
              ref={mapRef}
              className="h-72 sm:h-80 md:h-96 lg:h-105 w-full map-wrapper"
            />

            {/* Bottom Controls - improved spacing and touch targets */}
            <div className="pointer-events-none absolute bottom-3 sm:bottom-4 left-12 sm:left-14 right-3 sm:right-4 z-1000 flex items-end justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-gray-600 shadow-lg backdrop-blur-sm">
                <MapPin className="size-4 text-primary" />
                <span className="hidden xs:inline">
                  {value
                    ? "Tap to adjust"
                    : hasDeliveryZones
                      ? "Tap within highlighted area"
                      : "Tap to select"}
                </span>
                <span className="xs:hidden">
                  {value ? "Tap to adjust" : "Tap to select"}
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleButtonClick}
                  disabled={isLoading}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium text-white shadow-lg transition-colors hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Navigation className="size-4" />
                  )}
                  {isLoading ? "Getting..." : "Use GPS"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Location Info Panel - shows after selection */}
      {value && (
        <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3">
          {/* GPS Accuracy Notice */}
          {locationHistory.gps?.accuracy &&
            locationHistory.gps.accuracy > 50 && (
              <div className="flex items-start gap-2.5 sm:gap-3 rounded-lg bg-amber-50 p-3 sm:p-3.5 text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 sm:size-5 shrink-0" />
                <div>
                  <p className="font-medium text-xs sm:text-sm">
                    GPS accuracy: ~{Math.round(locationHistory.gps.accuracy)}m
                  </p>
                  <p className="text-xs sm:text-sm mt-0.5 opacity-80">
                    Tap on the map to refine your exact location
                  </p>
                </div>
              </div>
            )}

          {/* Zone Status */}
          {hasDeliveryZones && zoneStatus && (
            <div
              className={cn(
                "flex items-center gap-2.5 sm:gap-3 rounded-lg p-3 sm:p-3.5",
                zoneStatus.inZone
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {zoneStatus.inZone ? (
                <>
                  <Check className="size-4 sm:size-5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium">
                      Delivery available - {zoneStatus.zoneName}
                    </p>
                    {zoneStatus.deliveryFee !== undefined && (
                      <p className="text-xs sm:text-sm opacity-80">
                        {parseFloat(zoneStatus.deliveryFee || "0") === 0
                          ? "Free delivery"
                          : `${parseFloat(zoneStatus.deliveryFee || "0").toLocaleString()} AFN delivery fee`}
                        {zoneStatus.freeShippingThreshold &&
                          parseFloat(zoneStatus.freeShippingThreshold) > 0 &&
                          parseFloat(zoneStatus.deliveryFee || "0") > 0 && (
                            <span>
                              {" "}
                              (Free over{" "}
                              {parseFloat(
                                zoneStatus.freeShippingThreshold
                              ).toLocaleString()}{" "}
                              AFN)
                            </span>
                          )}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4 sm:size-5 shrink-0" />
                  <p className="text-xs sm:text-sm">
                    Outside delivery zones. Please select within highlighted
                    areas.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Plus Code Display */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3.5 sm:px-4 py-2.5 sm:py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500">Location Code</p>
              <p className="font-mono text-sm sm:text-base font-medium truncate">
                {isFetchingCity ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  formatPlusCodeForDisplay(
                    computePlusCode(value.latitude, value.longitude),
                    cityName
                  )
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPlusCode}
              className="ml-2 rounded-lg p-2.5 sm:p-3 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors shrink-0"
              title="Copy location code"
            >
              {copied ? (
                <Check className="size-4 sm:size-5 text-green-600" />
              ) : (
                <Copy className="size-4 sm:size-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {(gpsError || error) && (
        <div className="flex items-start gap-2.5 sm:gap-3 rounded-xl bg-red-50 p-3.5 sm:p-4 text-sm sm:text-base text-red-600">
          <X className="mt-0.5 size-4 sm:size-5 shrink-0" />
          <p>{gpsError || error}</p>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}
