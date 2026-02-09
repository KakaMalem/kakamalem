"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Store,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";

interface StoreLocationData {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
  city?: string | null;
  plusCode?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
}

interface StoreInfoSectionProps {
  storeName: string;
  storeDescription?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  /** Single location (legacy support) */
  storeLocation?: {
    lat: number;
    lng: number;
    city?: string | null;
    plusCode?: string | null;
  } | null;
  /** Multiple locations (new multi-location system) */
  locations?: StoreLocationData[];
  className?: string;
}

export function StoreInfoSection({
  storeName,
  storeDescription,
  contactPhone,
  contactEmail,
  storeLocation,
  locations = [],
  className,
}: StoreInfoSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);

  const [leafletLoaded, setLeafletLoaded] = useState(
    () => typeof window !== "undefined" && !!window.L
  );

  // Merge legacy storeLocation with locations array
  const allLocations = useMemo<StoreLocationData[]>(() => {
    if (locations.length > 0) return locations;
    if (storeLocation) return [{ ...storeLocation, isPrimary: true }];
    return [];
  }, [locations, storeLocation]);

  // Get the primary location for display
  const primaryLocation = useMemo(
    () => allLocations.find((l) => l.isPrimary) || allLocations[0],
    [allLocations]
  );

  // Load Leaflet
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      allLocations.length === 0 ||
      leafletLoaded
    )
      return;

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
  }, [allLocations.length, leafletLoaded]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInitializedRef.current) return;
    if (allLocations.length === 0) return;

    const L = window.L;

    // Calculate center and bounds
    const bounds: [number, number][] = allLocations.map((loc) => [
      loc.lat,
      loc.lng,
    ]);
    const center = primaryLocation
      ? [primaryLocation.lat, primaryLocation.lng]
      : bounds[0];

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
      doubleClickZoom: false,
    }).setView(center, 15);

    // Add zoom control to bottom-left
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // Add custom CSS for tooltips
    const style = document.createElement("style");
    style.id = "store-info-map-styles";
    if (!document.getElementById("store-info-map-styles")) {
      style.textContent = `
        .custom-store-marker {
          background: transparent !important;
          border: none !important;
        }
        .location-tooltip {
          background: #ca8a04 !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        .location-tooltip::before {
          border-top-color: #ca8a04 !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Add markers for all locations
    allLocations.forEach((location, index) => {
      const isPrimary = location.isPrimary || index === 0;

      // Create custom store icon (gold/yellow for stores)
      const storeIcon = L.divIcon({
        className: "custom-store-marker",
        html: `
          <div style="
            width: ${isPrimary ? 40 : 32}px;
            height: ${isPrimary ? 40 : 32}px;
            background: ${isPrimary ? "#ca8a04" : "#a16207"};
            border: ${isPrimary ? 3 : 2}px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="${isPrimary ? 20 : 16}" height="${isPrimary ? 20 : 16}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
              <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
            </svg>
          </div>
        `,
        iconSize: [isPrimary ? 40 : 32, isPrimary ? 40 : 32],
        iconAnchor: [isPrimary ? 20 : 16, isPrimary ? 20 : 16],
      });

      // Add marker with tooltip
      const marker = L.marker([location.lat, location.lng], {
        icon: storeIcon,
        zIndexOffset: isPrimary ? 100 : 0,
      }).addTo(map);

      if (location.name) {
        marker.bindTooltip(location.name, {
          permanent: false,
          direction: "top",
          className: "location-tooltip",
        });
      }
    });

    // Fit bounds if multiple locations
    if (allLocations.length > 1) {
      const group = L.latLngBounds(bounds);
      map.fitBounds(group, { padding: [50, 50], maxZoom: 15 });
    }

    mapInstanceRef.current = map;
    mapInitializedRef.current = true;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      mapInitializedRef.current = false;
    };
  }, [leafletLoaded, allLocations, primaryLocation]);

  // Don't render if no location data
  if (allLocations.length === 0) {
    return null;
  }

  return (
    <section className={cn("border-t bg-muted/20", className)}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Map */}
          <div className="relative isolate overflow-hidden rounded-2xl border bg-white shadow-sm">
            {!leafletLoaded ? (
              <div className="flex h-64 sm:h-80 items-center justify-center bg-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="size-4 animate-spin" />
                  Loading map...
                </div>
              </div>
            ) : (
              <div ref={mapRef} className="h-64 sm:h-80 w-full map-wrapper" />
            )}
          </div>

          {/* Store Info */}
          <div className="flex flex-col justify-center space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                <Store className="size-4" />
                <span>Find Us</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Visit {storeName}
              </h2>
              {storeDescription && (
                <p className="mt-3 text-muted-foreground line-clamp-3">
                  {storeDescription}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {/* Locations */}
              {allLocations.map((location, index) => {
                const displayAddress = location.plusCode
                  ? formatPlusCodeForDisplay(location.plusCode, location.city)
                  : `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
                const isPrimary =
                  location.isPrimary ||
                  (index === 0 && allLocations.length === 1);

                return (
                  <div
                    key={location.id || index}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        isPrimary
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      <MapPin className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {location.name || "Location"}
                        </p>
                        {isPrimary && allLocations.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            <Star className="size-3" />
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {displayAddress}
                      </p>
                      {/* Location-specific contact info */}
                      {(location.phone || location.email) && (
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {location.phone && (
                            <a
                              href={`tel:${location.phone}`}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              <Phone className="size-3" />
                              {location.phone}
                            </a>
                          )}
                          {location.email && (
                            <a
                              href={`mailto:${location.email}`}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              <Mail className="size-3" />
                              {location.email}
                            </a>
                          )}
                        </div>
                      )}
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 mt-1"
                      >
                        Get directions
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Store-level contact info (shown if no location-specific contacts) */}
              {!allLocations.some((l) => l.phone || l.email) && (
                <>
                  {/* Phone */}
                  {contactPhone && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Phone className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">Phone</p>
                        <a
                          href={`tel:${contactPhone}`}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {contactPhone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {contactEmail && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mail className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">Email</p>
                        <a
                          href={`mailto:${contactEmail}`}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {contactEmail}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}
