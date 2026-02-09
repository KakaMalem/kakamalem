"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Polygon } from "geojson";
import { Loader2, Clock, Truck, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoneList } from "./zone-list";
import { DeliveryOptionWizard } from "./delivery-option-wizard";
import type { UnifiedZoneWithMethods } from "@/lib/actions/unified-delivery";

// Dynamic import for the map to avoid SSR issues
const UnifiedDeliveryMap = dynamic(
  () => import("./map").then((mod) => mod.UnifiedDeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-125 bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface UnifiedDeliveryManagerProps {
  tenantId: string;
  zones: UnifiedZoneWithMethods[];
}

export function UnifiedDeliveryManager({
  tenantId,
  zones,
}: UnifiedDeliveryManagerProps) {
  // Selected zone state
  const [selectedZone, setSelectedZone] =
    useState<UnifiedZoneWithMethods | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<UnifiedZoneWithMethods | null>(
    null
  );

  // Handlers
  const handleAddZone = useCallback(() => {
    setEditingZone(null);
    setWizardOpen(true);
  }, []);

  const handleEditZone = useCallback((zone: UnifiedZoneWithMethods) => {
    setEditingZone(zone);
    setWizardOpen(true);
  }, []);

  // Prepare zones for map display (cast to match UnifiedDeliveryZone type)
  const localZonesForMap = zones
    .filter((z) => z.zoneType === "radius" || z.zoneType === "polygon")
    .map((z) => ({
      id: z.id,
      tenantId: z.tenantId,
      name: z.name,
      zoneType: z.zoneType as "radius" | "polygon",
      countries: (z.countries as string[]) || [],
      regions: (z.regions as string[]) || [],
      cities: (z.cities as string[]) || [],
      postalCodes: (z.postalPatterns as string[]) || [],
      centerLat: z.centerLat ? Number(z.centerLat) : null,
      centerLng: z.centerLng ? Number(z.centerLng) : null,
      radiusMeters: z.radiusMeters ?? null,
      polygonGeojson: (z.polygonGeojson as Polygon) ?? null,
      color: z.color || "#3b82f6",
      priority: z.specificityScore,
      displayOrder: z.displayOrder,
      isActive: z.isActive,
      createdAt: new Date(z.createdAt),
      updatedAt: new Date(z.updatedAt),
    }));

  // Get all country zones with their colors for map display
  const countryZonesForMap = zones
    .filter((z) => z.zoneType === "country" && z.isActive)
    .map((z) => ({
      id: z.id,
      countries: (z.countries as string[]) || [],
      color: z.color || "#3b82f6",
      isHighlighted: selectedZone?.id === z.id,
    }));

  // Empty state when no zones
  if (zones.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Globe className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Delivery Options</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Create your first delivery option to define where and how you
            deliver.
          </p>
          <Button onClick={handleAddZone} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Delivery Option
          </Button>
        </div>

        {/* Delivery Option Wizard */}
        <DeliveryOptionWizard
          tenantId={tenantId}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          zone={editingZone}
          method={editingZone?.methods?.[0] || null}
          onSuccess={(zone) => {
            const updated = zones.find((z) => z.id === zone.id);
            if (updated) setSelectedZone(updated);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zone List */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4">
          <ZoneList
            tenantId={tenantId}
            zones={zones}
            selectedZoneId={selectedZone?.id}
            onSelectZone={setSelectedZone}
            onEditZone={handleEditZone}
            onAddZone={handleAddZone}
          />
        </div>
      </div>

      {/* Map container */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <UnifiedDeliveryMap
          mode="view"
          countryZones={countryZonesForMap}
          localZones={localZonesForMap}
          selectedZoneId={selectedZone?.id}
          onZoneSelect={(z) => {
            const zone = zones.find((zone) => zone.id === z.id);
            if (zone) setSelectedZone(zone);
          }}
          height={400}
        />
      </div>

      {/* Selected zone details panel */}
      {selectedZone && (
        <SelectedZoneDetails
          zone={selectedZone}
          onEdit={() => handleEditZone(selectedZone)}
        />
      )}

      {/* Delivery Option Wizard */}
      <DeliveryOptionWizard
        tenantId={tenantId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        zone={editingZone}
        method={editingZone?.methods?.[0] || null}
        onSuccess={(zone) => {
          const updated = zones.find((z) => z.id === zone.id);
          if (updated) setSelectedZone(updated);
        }}
      />
    </div>
  );
}

// =============================================================================
// SELECTED ZONE DETAILS
// =============================================================================

import { Button as ButtonComponent } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  getCountryName,
  getCountryFlag,
  formatRadius,
} from "@/lib/delivery/geojson-config";

function SelectedZoneDetails({
  zone,
  onEdit,
}: {
  zone: UnifiedZoneWithMethods;
  onEdit: () => void;
}) {
  const method = zone.methods[0]; // One zone = one method

  const getZoneTypeLabel = () => {
    switch (zone.zoneType) {
      case "radius":
        return "Local Delivery (Radius)";
      case "polygon":
        return "Local Delivery (Custom Area)";
      case "country":
        return "Shipping (Countries)";
      case "worldwide":
        return "Worldwide Shipping";
      default:
        return zone.zoneType;
    }
  };

  const getCoverageDetails = () => {
    const countries = zone.countries as string[] | null;

    switch (zone.zoneType) {
      case "radius":
        return zone.radiusMeters ? formatRadius(zone.radiusMeters) : "";
      case "country":
        if (countries && countries.length <= 3) {
          return countries
            .map((c) => `${getCountryFlag(c)} ${getCountryName(c)}`)
            .join(", ");
        }
        return countries ? `${countries.length} countries` : "";
      case "worldwide":
        return "All locations";
      case "polygon":
        return "Custom drawn area";
      default:
        return "";
    }
  };

  const getPricingText = () => {
    if (!method) return "Not configured";
    const rate = parseFloat(method.baseRate);
    if (method.rateType === "free" || rate === 0) return "Free";
    if (method.rateType === "flat") return `${rate.toLocaleString()} AFN`;
    if (method.rateType === "per_item") {
      const perItem = method.perItemRate ? parseFloat(method.perItemRate) : 0;
      return `${rate.toLocaleString()} AFN + ${perItem}/item`;
    }
    if (method.rateType === "weight_based") {
      const perKg = method.perKgRate ? parseFloat(method.perKgRate) : 0;
      return `${rate.toLocaleString()} AFN + ${perKg}/kg`;
    }
    return `${rate.toLocaleString()} AFN`;
  };

  const getTimingText = () => {
    if (!method) return null;
    if (method.estimatedTime) return method.estimatedTime;
    if (method.minDeliveryDays && method.maxDeliveryDays) {
      return `${method.minDeliveryDays}-${method.maxDeliveryDays} days`;
    }
    if (method.minDeliveryDays) return `${method.minDeliveryDays}+ days`;
    if (method.maxDeliveryDays) return `Up to ${method.maxDeliveryDays} days`;
    return null;
  };

  const Icon = Truck;
  const deliveryTime = getTimingText();

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: zone.color || "#3b82f6" }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{zone.name}</h3>
            <p className="text-sm text-muted-foreground">
              {getZoneTypeLabel()}
            </p>
          </div>
        </div>
        <ButtonComponent variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </ButtonComponent>
      </div>

      {/* Details grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Coverage */}
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Coverage
            </dt>
            <dd className="font-medium text-sm">{getCoverageDetails()}</dd>
          </div>

          {/* Pricing */}
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Pricing
            </dt>
            <dd className="font-medium text-sm text-primary">
              {getPricingText()}
            </dd>
            {method?.freeShippingThreshold && (
              <p className="text-xs text-green-600 mt-0.5">
                Free above{" "}
                {parseFloat(method.freeShippingThreshold).toLocaleString()} AFN
              </p>
            )}
          </div>

          {/* Timing */}
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Timing
            </dt>
            <dd className="font-medium text-sm flex items-center gap-1">
              {deliveryTime ? (
                <>
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {deliveryTime}
                </>
              ) : (
                <span className="text-muted-foreground">Not specified</span>
              )}
            </dd>
          </div>

          {/* Status */}
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Status
            </dt>
            <dd className="font-medium text-sm">
              {zone.isActive ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-amber-600">Inactive</span>
              )}
            </dd>
          </div>

          {/* Description if applicable */}
          {method?.description && (
            <div className="col-span-full">
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Description
              </dt>
              <dd className="text-sm text-muted-foreground">
                {method.description}
              </dd>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
