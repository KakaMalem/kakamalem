"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { LocationPicker, type LocationValue } from "@/components/shared";

interface StepLocationProps {
  location: LocationValue | null;
  onLocationChange: (location: LocationValue | null) => void;
  disabled?: boolean;
}

export function StepLocation({
  location,
  onLocationChange,
  disabled,
}: StepLocationProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-medium">Where is your store located?</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add your store&apos;s physical location. This helps customers find you
          and can be used for local delivery calculations.
        </p>
      </div>

      <LocationPicker
        value={location}
        onChange={onLocationChange}
        disabled={disabled}
        showGPSButton={true}
        showClearButton={true}
      />

      <p className="text-xs text-muted-foreground">
        You can skip this step and set your location later in store settings.
      </p>
    </motion.div>
  );
}
