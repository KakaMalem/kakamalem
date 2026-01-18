"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, MapPin, Navigation, X, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { computePlusCode } from "@/lib/geo";
import {
  useLocationPermission,
  type LocationErrorType,
} from "@/lib/hooks/use-location-permission";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "gps" | "manual";
  plusCode: string;
}

// Simplified delivery zone type for display purposes
interface DeliveryZoneDisplay {
  id: string;
  name: string;
  centerLat: string | null;
  centerLng: string | null;
  radiusMeters: number | null;
  color: string | null;
}

interface LocationPickerProps {
  value?: { latitude: number; longitude: number } | null;
  onChange: (location: LocationData) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  deliveryZones?: DeliveryZoneDisplay[];
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
          {/* Building body */}
          <polygon points="0,90 0,20 30,0 60,20 60,90 30,90" fill="#3b82f6" />
          <polygon points="60,20 60,90 90,70 90,0 30,0" fill="#2563eb" />
          {/* Windows */}
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
          {/* Awning */}
          <polygon points="-5,25 45,25 40,35 0,35" fill="#fda4af" />
          {/* Door */}
          <rect x="12" y="35" width="16" height="20" fill="#7f1d1d" />
        </g>

        {/* Building 3 - Tall yellow building */}
        <g transform="translate(280, 50)">
          <polygon points="0,100 0,25 25,5 50,25 50,100" fill="#fbbf24" />
          <polygon points="50,25 50,100 75,80 75,5 25,5" fill="#d97706" />
          {/* Windows */}
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

        {/* Tree 1 */}
        <g transform="translate(155, 120)">
          <rect x="8" y="20" width="6" height="15" fill="#854d0e" />
          <ellipse cx="11" cy="12" rx="14" ry="16" fill="#22c55e" />
          <ellipse cx="8" cy="8" rx="10" ry="12" fill="#4ade80" />
        </g>

        {/* Tree 2 */}
        <g transform="translate(240, 115)">
          <rect x="6" y="18" width="5" height="12" fill="#854d0e" />
          <ellipse cx="8" cy="10" rx="12" ry="14" fill="#22c55e" />
          <ellipse cx="6" cy="6" rx="8" ry="10" fill="#4ade80" />
        </g>

        {/* Car 1 - Red car (animated) */}
        <g
          style={{
            animation: isLoading ? "drive-right 4s linear infinite" : "none",
          }}
        >
          <g transform="translate(50, 155)">
            {/* Body */}
            <rect x="0" y="8" width="40" height="14" rx="3" fill="#ef4444" />
            <rect x="5" y="2" width="25" height="10" rx="2" fill="#ef4444" />
            {/* Windows */}
            <rect x="8" y="4" width="8" height="6" rx="1" fill="#bfdbfe" />
            <rect x="19" y="4" width="8" height="6" rx="1" fill="#bfdbfe" />
            {/* Wheels */}
            <circle cx="10" cy="22" r="5" fill="#1f2937" />
            <circle cx="10" cy="22" r="2" fill="#6b7280" />
            <circle cx="30" cy="22" r="5" fill="#1f2937" />
            <circle cx="30" cy="22" r="2" fill="#6b7280" />
            {/* Headlight */}
            <rect x="36" y="12" width="4" height="4" rx="1" fill="#fef08a" />
          </g>
        </g>

        {/* Car 2 - Blue car */}
        <g transform="translate(300, 158)">
          <rect x="0" y="6" width="35" height="12" rx="2" fill="#3b82f6" />
          <rect x="4" y="0" width="22" height="8" rx="2" fill="#3b82f6" />
          <rect x="6" y="2" width="7" height="5" rx="1" fill="#bfdbfe" />
          <rect x="15" y="2" width="7" height="5" rx="1" fill="#bfdbfe" />
          <circle cx="8" cy="18" r="4" fill="#1f2937" />
          <circle cx="8" cy="18" r="1.5" fill="#6b7280" />
          <circle cx="27" cy="18" r="4" fill="#1f2937" />
          <circle cx="27" cy="18" r="1.5" fill="#6b7280" />
        </g>

        {/* Motorcycle (animated when loading) */}
        <g
          style={{
            animation: isLoading ? "drive-left 3s linear infinite" : "none",
          }}
        >
          <g transform="translate(250, 160)">
            {/* Body */}
            <ellipse cx="12" cy="12" rx="8" ry="5" fill="#7c3aed" />
            <rect x="6" y="8" width="14" height="6" fill="#7c3aed" />
            {/* Handlebar */}
            <rect x="16" y="4" width="2" height="8" fill="#374151" />
            <rect x="14" y="3" width="6" height="2" rx="1" fill="#374151" />
            {/* Rider (simple) */}
            <circle cx="10" cy="2" r="4" fill="#fbbf24" />
            <rect x="7" y="4" width="6" height="6" fill="#1f2937" />
            {/* Wheels */}
            <circle cx="4" cy="16" r="4" fill="#1f2937" />
            <circle cx="4" cy="16" r="1.5" fill="#9ca3af" />
            <circle cx="20" cy="16" r="4" fill="#1f2937" />
            <circle cx="20" cy="16" r="1.5" fill="#9ca3af" />
          </g>
        </g>

        {/* Bicycle */}
        <g transform="translate(170, 135)">
          {/* Frame */}
          <line
            x1="5"
            y1="10"
            x2="15"
            y2="3"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <line
            x1="15"
            y1="3"
            x2="20"
            y2="10"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="10"
            x2="20"
            y2="10"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <line
            x1="15"
            y1="3"
            x2="15"
            y2="0"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <line
            x1="13"
            y1="0"
            x2="17"
            y2="0"
            stroke="#374151"
            strokeWidth="1.5"
          />
          {/* Wheels */}
          <circle
            cx="5"
            cy="12"
            r="4"
            fill="none"
            stroke="#374151"
            strokeWidth="1.5"
          />
          <circle
            cx="20"
            cy="12"
            r="4"
            fill="none"
            stroke="#374151"
            strokeWidth="1.5"
          />
          {/* Basket */}
          <rect x="17" y="-2" width="6" height="4" fill="#d97706" />
        </g>

        {/* Delivery scooter with box */}
        <g
          transform="translate(350, 158)"
          style={{
            animation: isLoading ? "wobble 0.5s ease-in-out infinite" : "none",
          }}
        >
          <rect x="0" y="4" width="12" height="10" rx="1" fill="#22c55e" />
          <rect x="10" y="6" width="18" height="8" rx="1" fill="#16a34a" />
          {/* Delivery box */}
          <rect x="2" y="-4" width="10" height="8" fill="#ea580c" />
          <text x="4" y="2" fontSize="4" fill="white" fontWeight="bold">
            KM
          </text>
          {/* Wheels */}
          <circle cx="4" cy="16" r="3" fill="#1f2937" />
          <circle cx="24" cy="16" r="3" fill="#1f2937" />
        </g>

        {/* Location Pin (bouncing when loading) */}
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

      {/* CSS Animations */}
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
        @keyframes drive-left {
          0% {
            transform: translateX(150px);
          }
          100% {
            transform: translateX(-100px);
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
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneCirclesRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Initialize with true if Leaflet is already loaded (e.g., from a previous render)
  const [leafletLoaded, setLeafletLoaded] = useState(
    () => typeof window !== "undefined" && !!window.L
  );

  const { permissionState, isCheckingPermission, requestLocation } =
    useLocationPermission();

  // Show map if we have a value OR if we have delivery zones to display
  const hasDeliveryZones = deliveryZones.length > 0;
  const showMap = !!value || hasDeliveryZones;

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

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    // Need either a value or delivery zones to show the map
    if (!value && deliveryZones.length === 0) return;

    const L = window.L;

    // Determine initial map center and zoom
    let initialCenter: [number, number];
    let initialZoom = 16;

    if (value) {
      // Center on the selected location
      initialCenter = [value.latitude, value.longitude];
    } else if (deliveryZones.length > 0) {
      // Center on the first delivery zone
      const firstZone = deliveryZones.find(
        (z) => z.centerLat && z.centerLng && z.radiusMeters
      );
      if (firstZone && firstZone.centerLat && firstZone.centerLng) {
        initialCenter = [
          parseFloat(firstZone.centerLat),
          parseFloat(firstZone.centerLng),
        ];
        // Adjust zoom based on radius (larger radius = smaller zoom)
        const radius = firstZone.radiusMeters || 3000;
        if (radius > 10000) initialZoom = 11;
        else if (radius > 5000) initialZoom = 12;
        else if (radius > 2000) initialZoom = 13;
        else initialZoom = 14;
      } else {
        // Fallback to Kabul
        initialCenter = [34.5553, 69.2075];
        initialZoom = 12;
      }
    } else {
      initialCenter = [34.5553, 69.2075];
      initialZoom = 12;
    }

    const map = L.map(mapRef.current).setView(initialCenter, initialZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Draw delivery zones as circles
    zoneCirclesRef.current = [];
    deliveryZones.forEach((zone) => {
      if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters) return;

      const circle = L.circle(
        [parseFloat(zone.centerLat), parseFloat(zone.centerLng)],
        {
          radius: zone.radiusMeters,
          color: zone.color || "#3b82f6",
          fillColor: zone.color || "#3b82f6",
          fillOpacity: 0.1,
          weight: 2,
        }
      ).addTo(map);

      // Add tooltip with zone name
      circle.bindTooltip(zone.name, {
        permanent: false,
        direction: "center",
        className: "zone-tooltip",
      });

      zoneCirclesRef.current.push(circle);
    });

    // Fit bounds to show all zones if we have zones and no selected value
    if (!value && zoneCirclesRef.current.length > 0) {
      const group = L.featureGroup(zoneCirclesRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    // Add marker if we have a selected value
    if (value) {
      markerRef.current = L.marker([value.latitude, value.longitude]).addTo(
        map
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", (e: any) => {
      if (disabled) return;
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      const plusCode = computePlusCode(lat, lng);
      onChange({ latitude: lat, longitude: lng, source: "manual", plusCode });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      zoneCirclesRef.current = [];
    };
  }, [leafletLoaded, value, disabled, onChange, deliveryZones]);

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
    map.setView([value.latitude, value.longitude], map.getZoom());
  }, [value, leafletLoaded]);

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
      const plusCode = computePlusCode(latitude, longitude);
      onChange({
        latitude,
        longitude,
        accuracy: accuracy || undefined,
        source: "gps",
        plusCode,
      });
    }

    setIsLoading(false);
  }, [onChange, requestLocation]);

  const handleButtonClick = useCallback(() => {
    if (isLoading) {
      setIsLoading(false);
    } else {
      handleGetCurrentLocation();
    }
  }, [isLoading, handleGetCurrentLocation]);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border bg-white shadow-sm",
          error && "border-destructive",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {!showMap ? (
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={disabled}
            className="group relative block w-full min-h-72 cursor-pointer text-left transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {/* 3D City Illustration */}
            <CityIllustration isLoading={isLoading} />

            {/* Top text overlay with gradient fade */}
            <div className="absolute inset-x-0 top-0 z-10 bg-linear-to-b from-white/90 via-white/70 to-transparent pb-12 pt-5 px-5">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  {isLoading
                    ? "Finding your location..."
                    : "Where should we deliver?"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isLoading
                    ? "Please allow access when prompted"
                    : "Tap to share your location"}
                </p>
              </div>
            </div>

            {/* Bottom CTA hint with gradient fade */}
            <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-white/95 via-white/80 to-transparent pt-12 pb-5 px-5">
              <div
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-3 px-4 transition-all duration-200 mx-auto max-w-xs",
                  isLoading || isCheckingPermission
                    ? "bg-gray-100 text-gray-600"
                    : permissionState === "denied"
                      ? "bg-red-50 text-red-600"
                      : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                )}
              >
                {isLoading || isCheckingPermission ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm font-medium">
                      {isCheckingPermission
                        ? "Checking permissions..."
                        : "Tap to cancel"}
                    </span>
                  </>
                ) : permissionState === "denied" ? (
                  <>
                    <MapPinOff className="size-4" />
                    <span className="text-sm font-medium">
                      Location blocked - tap to retry
                    </span>
                  </>
                ) : (
                  <>
                    <Navigation className="size-4" />
                    <span className="text-sm font-medium">Use my location</span>
                  </>
                )}
              </div>
            </div>
          </button>
        ) : !leafletLoaded ? (
          <div className="relative min-h-72">
            <CityIllustration isLoading={true} />
            <div className="relative z-10 flex min-h-72 flex-col items-center justify-center gap-4">
              <div className="rounded-xl bg-white/90 px-6 py-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Loading map...
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div ref={mapRef} className="h-72 w-full" />
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-gray-600 shadow-lg backdrop-blur-sm">
                <MapPin className="size-3.5 text-primary" />
                {value
                  ? "Tap to adjust location"
                  : hasDeliveryZones
                    ? "Tap within highlighted area to select"
                    : "Tap to select your location"}
              </div>
              {!value && !disabled && (
                <button
                  type="button"
                  onClick={handleButtonClick}
                  disabled={isLoading}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Navigation className="size-3.5" />
                  )}
                  {isLoading ? "Getting..." : "Use GPS"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {(gpsError || error) && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-sm text-red-600">
          <X className="mt-0.5 size-4 shrink-0" />
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
