import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

// Dynamic import for LocationPicker (Leaflet doesn't work with SSR)
export const LocationPicker = dynamic(
  () => import("./location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="h-9 w-full bg-muted rounded-md animate-pulse" />
        <div className="w-full h-64 rounded-lg border bg-muted animate-pulse flex items-center justify-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    ),
  }
);

export type { LocationValue } from "./location-picker";
