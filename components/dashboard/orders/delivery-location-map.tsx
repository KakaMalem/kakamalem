"use client";

import dynamic from "next/dynamic";

export const DeliveryLocationMapWrapper = dynamic(
  () => import("./delivery-location-map-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 rounded-lg border bg-muted animate-pulse flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);
