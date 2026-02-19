"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix default marker icon issue with webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface DeliveryLocationMapProps {
  latitude: number;
  longitude: number;
  customerName?: string;
  className?: string;
}

export default function DeliveryLocationMap({
  latitude,
  longitude,
  customerName,
  className = "",
}: DeliveryLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add marker with popup
    const marker = L.marker([latitude, longitude]).addTo(map);
    if (customerName) {
      marker.bindPopup(
        `<strong>${customerName}</strong><br/>Delivery Location`
      );
    }

    // Cleanup on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, customerName]);

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="space-y-3">
      <div
        ref={mapContainerRef}
        className={`w-full h-48 rounded-lg border map-wrapper ${className}`}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 size-4" />
            View in Maps
          </a>
        </Button>
        <Button variant="default" size="sm" className="flex-1" asChild>
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="mr-2 size-4" />
            Get Directions
          </a>
        </Button>
      </div>
    </div>
  );
}
