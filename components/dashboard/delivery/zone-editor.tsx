"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  X,
  Globe,
  Palette,
  Truck,
  Zap,
  Clock,
  MapPin,
  Package,
  Sparkles,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ZoneTypeSelector, getZoneTypeInfo } from "./zone-type-selector";
import {
  ZONE_COLORS,
  getCountryName,
  getCountryFlag,
} from "@/lib/delivery/geojson-config";
import {
  createDeliveryOption,
  updateDeliveryOption,
  type UnifiedZone,
  type UnifiedMethod,
} from "@/lib/actions/unified-delivery";
import type {
  UnifiedZoneType,
  DeliveryMethodType,
  RateCalculationType,
} from "@/lib/validations/unified-delivery";
import { toast } from "sonner";

// Dynamic imports for map components
const UnifiedDeliveryMap = dynamic(
  () => import("./map").then((mod) => mod.UnifiedDeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-100 bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const RadiusPickerMap = dynamic(
  () => import("./radius-picker-map").then((mod) => mod.RadiusPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-100 bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const PolygonPickerMap = dynamic(
  () => import("./polygon-picker-map").then((mod) => mod.PolygonPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-100 bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Import polygon coordinate conversion functions (from separate file to avoid SSR issues)
import {
  coordinatesToGeoJSON,
  geoJSONToCoordinates,
} from "./map/polygon-utils";

// =============================================================================
// DELIVERY TYPE PRESETS
// =============================================================================

interface DeliveryTypePreset {
  id: DeliveryMethodType;
  title: string;
  description: string;
  icon: typeof Truck;
  suggestedZoneTypes: UnifiedZoneType[];
  defaults: {
    rateType: RateCalculationType;
    baseRate: number;
    freeShippingThreshold?: number;
    minDeliveryDays?: number;
    maxDeliveryDays?: number;
    estimatedTime?: string;
    includesTracking: boolean;
  };
}

const DELIVERY_TYPE_PRESETS: DeliveryTypePreset[] = [
  {
    id: "local_delivery",
    title: "Local Delivery",
    description: "Same-day or next-day delivery within your local area",
    icon: Zap,
    suggestedZoneTypes: ["radius", "polygon"],
    defaults: {
      rateType: "flat",
      baseRate: 50, // 50 AFN
      minDeliveryDays: 0,
      maxDeliveryDays: 1,
      estimatedTime: "30-60 minutes",
      includesTracking: true,
    },
  },
  {
    id: "standard",
    title: "Standard Shipping",
    description: "Regular delivery, typically 3-7 business days",
    icon: Truck,
    suggestedZoneTypes: ["country", "region", "worldwide"],
    defaults: {
      rateType: "flat",
      baseRate: 150, // 150 AFN
      freeShippingThreshold: 2000, // Free above 2000 AFN
      minDeliveryDays: 3,
      maxDeliveryDays: 7,
      includesTracking: true,
    },
  },
  {
    id: "express",
    title: "Express Shipping",
    description: "Priority delivery, 1-3 business days",
    icon: Sparkles,
    suggestedZoneTypes: ["country", "region"],
    defaults: {
      rateType: "flat",
      baseRate: 300, // 300 AFN
      minDeliveryDays: 1,
      maxDeliveryDays: 3,
      includesTracking: true,
    },
  },
  {
    id: "pickup",
    title: "Store Pickup",
    description: "Customer picks up from your store or location",
    icon: MapPin,
    suggestedZoneTypes: ["radius", "polygon", "worldwide"],
    defaults: {
      rateType: "free",
      baseRate: 0,
      minDeliveryDays: 0,
      maxDeliveryDays: 0,
      estimatedTime: "Ready in 1-2 hours",
      includesTracking: false,
    },
  },
  {
    id: "custom",
    title: "Custom",
    description: "Configure your own delivery option",
    icon: Package,
    suggestedZoneTypes: ["polygon", "radius", "country", "worldwide"],
    defaults: {
      rateType: "flat",
      baseRate: 0,
      includesTracking: true,
    },
  },
];

// =============================================================================
// EDITOR STEPS
// =============================================================================

type EditorStep =
  | "delivery_type"
  | "area_type"
  | "location"
  | "pricing"
  | "details";

const STEPS: { id: EditorStep; title: string }[] = [
  { id: "delivery_type", title: "Delivery Type" },
  { id: "area_type", title: "Area Type" },
  { id: "location", title: "Location" },
  { id: "pricing", title: "Pricing" },
  { id: "details", title: "Details" },
];

// =============================================================================
// ZONE EDITOR PROPS
// =============================================================================

interface ZoneEditorProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: UnifiedZone | null; // For editing existing zone
  method?: UnifiedMethod | null; // For editing existing method
  onSuccess?: (zone: UnifiedZone) => void;
}

export function ZoneEditor({
  tenantId,
  open,
  onOpenChange,
  zone,
  method,
  onSuccess,
}: ZoneEditorProps) {
  const isEditing = !!zone;
  const [isPending, startTransition] = useTransition();

  // =========================================================================
  // FORM STATE - Delivery Type
  // =========================================================================
  const [deliveryType, setDeliveryType] = useState<DeliveryMethodType | null>(
    method?.methodType as DeliveryMethodType | null
  );

  // =========================================================================
  // FORM STATE - Zone
  // =========================================================================
  const [step, setStep] = useState<EditorStep>(
    isEditing ? "location" : "delivery_type"
  );
  const [zoneType, setZoneType] = useState<UnifiedZoneType | null>(
    zone?.zoneType as UnifiedZoneType | null
  );
  const [name, setName] = useState(zone?.name || "");
  const [color, setColor] = useState(zone?.color || ZONE_COLORS[0]);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);

  // Location data
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    (zone?.countries as string[]) || []
  );

  // Radius zone data
  const [centerLat, setCenterLat] = useState<number | undefined>(
    zone?.centerLat ? parseFloat(zone.centerLat) : undefined
  );
  const [centerLng, setCenterLng] = useState<number | undefined>(
    zone?.centerLng ? parseFloat(zone.centerLng) : undefined
  );
  const [radiusMeters, setRadiusMeters] = useState<number>(
    zone?.radiusMeters || 5000
  );

  // Polygon zone data
  const [polygonCoordinates, setPolygonCoordinates] = useState<
    [number, number][]
  >(
    zone?.polygonGeojson
      ? geoJSONToCoordinates(zone.polygonGeojson as GeoJSON.Polygon)
      : []
  );

  // =========================================================================
  // FORM STATE - Method (Pricing & Timing)
  // =========================================================================
  const [rateType, setRateType] = useState<RateCalculationType>(
    (method?.rateType as RateCalculationType) || "flat"
  );
  const [baseRate, setBaseRate] = useState<number>(
    method?.baseRate ? parseFloat(method.baseRate) : 0
  );
  const [perItemRate, setPerItemRate] = useState<number | undefined>(
    method?.perItemRate ? parseFloat(method.perItemRate) : undefined
  );
  const [perKgRate, setPerKgRate] = useState<number | undefined>(
    method?.perKgRate ? parseFloat(method.perKgRate) : undefined
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<
    number | undefined
  >(
    method?.freeShippingThreshold
      ? parseFloat(method.freeShippingThreshold)
      : undefined
  );
  const [minDeliveryDays, setMinDeliveryDays] = useState<number | undefined>(
    method?.minDeliveryDays ?? undefined
  );
  const [maxDeliveryDays, setMaxDeliveryDays] = useState<number | undefined>(
    method?.maxDeliveryDays ?? undefined
  );
  const [estimatedTime, setEstimatedTime] = useState<string>(
    method?.estimatedTime || ""
  );
  const [includesTracking, setIncludesTracking] = useState<boolean>(
    method?.includesTracking ?? true
  );
  const [methodDescription, setMethodDescription] = useState<string>(
    method?.description || ""
  );

  // Pickup location (for pickup type)
  const [pickupLocationName, setPickupLocationName] = useState<string>(
    method?.pickupLocationName || ""
  );
  const [pickupLocationAddress, setPickupLocationAddress] = useState<string>(
    method?.pickupLocationAddress || ""
  );

  // =========================================================================
  // GET CURRENT PRESET
  // =========================================================================
  const currentPreset = useMemo(
    () => DELIVERY_TYPE_PRESETS.find((p) => p.id === deliveryType),
    [deliveryType]
  );

  // =========================================================================
  // APPLY PRESET DEFAULTS
  // =========================================================================
  const applyPresetDefaults = useCallback((preset: DeliveryTypePreset) => {
    setRateType(preset.defaults.rateType);
    setBaseRate(preset.defaults.baseRate);
    setFreeShippingThreshold(preset.defaults.freeShippingThreshold);
    setMinDeliveryDays(preset.defaults.minDeliveryDays);
    setMaxDeliveryDays(preset.defaults.maxDeliveryDays);
    setEstimatedTime(preset.defaults.estimatedTime || "");
    setIncludesTracking(preset.defaults.includesTracking);
  }, []);

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const canGoNext = useCallback(() => {
    switch (step) {
      case "delivery_type":
        return !!deliveryType;
      case "area_type":
        return !!zoneType;
      case "location":
        if (!zoneType) return false;
        switch (zoneType) {
          case "country":
            return selectedCountries.length > 0;
          case "worldwide":
            return true;
          case "radius":
            return centerLat !== undefined && centerLng !== undefined;
          case "polygon":
            return polygonCoordinates.length >= 3;
          default:
            return false;
        }
      case "pricing":
        if (rateType === "free") return true;
        return baseRate >= 0;
      case "details":
        return name.trim().length > 0;
      default:
        return false;
    }
  }, [
    step,
    deliveryType,
    zoneType,
    selectedCountries,
    centerLat,
    centerLng,
    polygonCoordinates,
    rateType,
    baseRate,
    name,
  ]);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].id);
    }
  };

  // =========================================================================
  // HANDLE SAVE
  // =========================================================================
  const handleSave = async () => {
    if (!zoneType || !deliveryType) return;

    const zoneInput = {
      name,
      zoneType,
      color,
      isActive,
      displayOrder: 0,
      countries: selectedCountries,
      regions: [],
      cities: [],
      postalPatterns: [],
      centerLat,
      centerLng,
      radiusMeters: zoneType === "radius" ? radiusMeters : undefined,
      polygonGeojson:
        zoneType === "polygon"
          ? (coordinatesToGeoJSON(polygonCoordinates) ?? undefined)
          : undefined,
    };

    const methodInput = {
      name: name, // Use zone name as method name
      description: methodDescription || undefined,
      methodType: deliveryType,
      rateType,
      baseRate,
      perItemRate,
      perKgRate,
      freeShippingThreshold,
      minDeliveryDays,
      maxDeliveryDays,
      estimatedTime: estimatedTime || undefined,
      includesTracking,
      pickupLocationName:
        deliveryType === "pickup" ? pickupLocationName : undefined,
      pickupLocationAddress:
        deliveryType === "pickup" ? pickupLocationAddress : undefined,
    };

    startTransition(async () => {
      const result =
        isEditing && method
          ? await updateDeliveryOption(tenantId, zone!.id, method.id, {
              zone: zoneInput,
              method: methodInput,
            })
          : await createDeliveryOption(tenantId, {
              zone: zoneInput,
              method: methodInput,
            });

      if (result.success && result.zone) {
        toast.success(
          isEditing ? "Delivery option updated" : "Delivery option created"
        );
        onSuccess?.(result.zone);
        onOpenChange(false);
        resetForm();
      } else {
        toast.error(result.error || "Failed to save delivery option");
      }
    });
  };

  const resetForm = () => {
    setStep("delivery_type");
    setDeliveryType(null);
    setZoneType(null);
    setName("");
    setColor(ZONE_COLORS[0]);
    setIsActive(true);
    setSelectedCountries([]);
    setCenterLat(undefined);
    setCenterLng(undefined);
    setRadiusMeters(5000);
    setPolygonCoordinates([]);
    setRateType("flat");
    setBaseRate(0);
    setPerItemRate(undefined);
    setPerKgRate(undefined);
    setFreeShippingThreshold(undefined);
    setMinDeliveryDays(undefined);
    setMaxDeliveryDays(undefined);
    setEstimatedTime("");
    setIncludesTracking(true);
    setMethodDescription("");
    setPickupLocationName("");
    setPickupLocationAddress("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4 border-b">
          <SheetTitle>
            {isEditing ? "Edit Delivery Option" : "Create Delivery Option"}
          </SheetTitle>

          {/* Step indicator */}
          <div className="flex items-center justify-center overflow-x-auto pb-1">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center shrink-0">
                {idx > 0 && (
                  <div
                    className={cn(
                      "w-6 sm:w-10 h-0.5 mx-0.5 sm:mx-1",
                      idx <= currentStepIndex ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => idx <= currentStepIndex && setStep(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 transition-colors",
                    idx <= currentStepIndex
                      ? "cursor-pointer"
                      : "cursor-default"
                  )}
                  disabled={idx > currentStepIndex}
                >
                  <span
                    className={cn(
                      "w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center text-xs sm:text-sm font-medium leading-none border-2",
                      step === s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : idx < currentStepIndex
                          ? "bg-primary/10 text-primary border-primary/50"
                          : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={cn(
                      "hidden lg:inline text-xs sm:text-sm",
                      step === s.id
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="py-6 px-4 space-y-6">
          {/* Step: Delivery Type Selection */}
          {step === "delivery_type" && (
            <DeliveryTypeStep
              selectedType={deliveryType}
              onSelect={(type) => {
                setDeliveryType(type);
                const preset = DELIVERY_TYPE_PRESETS.find((p) => p.id === type);
                if (preset && !isEditing) {
                  applyPresetDefaults(preset);
                  // Auto-select suggested zone type
                  if (preset.suggestedZoneTypes.length > 0) {
                    setZoneType(preset.suggestedZoneTypes[0]);
                  }
                }
              }}
              disabled={isPending}
            />
          )}

          {/* Step: Area Type Selection */}
          {step === "area_type" && (
            <ZoneTypeSelector
              selectedType={zoneType}
              onSelect={setZoneType}
              disabled={isPending}
              suggestedTypes={currentPreset?.suggestedZoneTypes}
            />
          )}

          {/* Step: Location Configuration */}
          {step === "location" && zoneType && (
            <LocationStep
              zoneType={zoneType}
              selectedCountries={selectedCountries}
              onCountriesChange={setSelectedCountries}
              centerLat={centerLat}
              centerLng={centerLng}
              onCenterChange={(lat, lng) => {
                setCenterLat(lat);
                setCenterLng(lng);
              }}
              radiusMeters={radiusMeters}
              onRadiusChange={setRadiusMeters}
              polygonCoordinates={polygonCoordinates}
              onPolygonCoordinatesChange={setPolygonCoordinates}
              zoneColor={color}
              disabled={isPending}
            />
          )}

          {/* Step: Pricing */}
          {step === "pricing" && (
            <PricingStep
              rateType={rateType}
              onRateTypeChange={setRateType}
              baseRate={baseRate}
              onBaseRateChange={setBaseRate}
              perItemRate={perItemRate}
              onPerItemRateChange={setPerItemRate}
              perKgRate={perKgRate}
              onPerKgRateChange={setPerKgRate}
              freeShippingThreshold={freeShippingThreshold}
              onFreeShippingThresholdChange={setFreeShippingThreshold}
              deliveryType={deliveryType}
              disabled={isPending}
            />
          )}

          {/* Step: Details */}
          {step === "details" && zoneType && deliveryType && (
            <DetailsStep
              name={name}
              onNameChange={setName}
              color={color}
              onColorChange={setColor}
              isActive={isActive}
              onActiveChange={setIsActive}
              deliveryType={deliveryType}
              zoneType={zoneType}
              selectedCountries={selectedCountries}
              minDeliveryDays={minDeliveryDays}
              onMinDeliveryDaysChange={setMinDeliveryDays}
              maxDeliveryDays={maxDeliveryDays}
              onMaxDeliveryDaysChange={setMaxDeliveryDays}
              estimatedTime={estimatedTime}
              onEstimatedTimeChange={setEstimatedTime}
              includesTracking={includesTracking}
              onIncludesTrackingChange={setIncludesTracking}
              description={methodDescription}
              onDescriptionChange={setMethodDescription}
              pickupLocationName={pickupLocationName}
              onPickupLocationNameChange={setPickupLocationName}
              pickupLocationAddress={pickupLocationAddress}
              onPickupLocationAddressChange={setPickupLocationAddress}
              disabled={isPending}
            />
          )}
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between p-4 border-t mt-auto">
          <Button
            type="button"
            variant="outline"
            onClick={
              currentStepIndex === 0 ? () => onOpenChange(false) : goBack
            }
            disabled={isPending}
          >
            {currentStepIndex === 0 ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {step === "details" ? (
            <Button onClick={handleSave} disabled={!canGoNext() || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Delivery Option"}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext() || isPending}>
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// DELIVERY TYPE STEP
// =============================================================================

interface DeliveryTypeStepProps {
  selectedType: DeliveryMethodType | null;
  onSelect: (type: DeliveryMethodType) => void;
  disabled?: boolean;
}

function DeliveryTypeStep({
  selectedType,
  onSelect,
  disabled,
}: DeliveryTypeStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Delivery Type</h3>
        <p className="text-sm text-muted-foreground">
          Select the type of delivery option you want to create. We&apos;ll
          pre-fill settings based on your choice.
        </p>
      </div>

      <div className="grid gap-3">
        {DELIVERY_TYPE_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedType === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              disabled={disabled}
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{preset.title}</h4>
                  {preset.id === "local_delivery" && (
                    <Badge variant="secondary" className="text-xs">
                      Popular
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {preset.description}
                </p>
                {preset.defaults.baseRate > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Suggested: {preset.defaults.baseRate} AFN base rate
                    {preset.defaults.freeShippingThreshold && (
                      <>
                        {" "}
                        • Free above {preset.defaults.freeShippingThreshold} AFN
                      </>
                    )}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// LOCATION STEP
// =============================================================================

interface LocationStepProps {
  zoneType: UnifiedZoneType;
  selectedCountries: string[];
  onCountriesChange: (countries: string[]) => void;
  centerLat?: number;
  centerLng?: number;
  onCenterChange: (lat: number, lng: number) => void;
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  polygonCoordinates: [number, number][];
  onPolygonCoordinatesChange: (coords: [number, number][]) => void;
  zoneColor: string;
  disabled?: boolean;
}

function LocationStep({
  zoneType,
  selectedCountries,
  onCountriesChange,
  centerLat,
  centerLng,
  onCenterChange,
  radiusMeters,
  onRadiusChange,
  polygonCoordinates,
  onPolygonCoordinatesChange,
  zoneColor,
  disabled,
}: LocationStepProps) {
  // Worldwide zone needs no configuration
  if (zoneType === "worldwide") {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Globe className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Worldwide Zone</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          This zone will serve as a fallback for any location not covered by
          other zones. No additional configuration needed.
        </p>
      </div>
    );
  }

  // Country selection
  if (zoneType === "country") {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Select Countries
          </Label>
          <UnifiedDeliveryMap
            mode="select-countries"
            selectedCountries={selectedCountries}
            onCountriesChange={onCountriesChange}
            zoneColor={zoneColor}
            height={320}
            className="rounded-xl"
            compact
          />
        </div>

        {/* Selected countries display */}
        {selectedCountries.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Selected Countries ({selectedCountries.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {selectedCountries.map((code) => (
                <Badge
                  key={code}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() =>
                    onCountriesChange(
                      selectedCountries.filter((c) => c !== code)
                    )
                  }
                >
                  {getCountryFlag(code)} {getCountryName(code)}
                  <X className="h-3 w-3 ml-1.5" />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Radius zone
  if (zoneType === "radius") {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-1 block">
            Set Delivery Area
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Click on the map to set center point. Drag the edge handle to adjust
            radius.
          </p>
          <RadiusPickerMap
            centerLat={centerLat}
            centerLng={centerLng}
            radiusMeters={radiusMeters}
            color={zoneColor}
            onCenterChange={onCenterChange}
            onRadiusChange={onRadiusChange}
            disabled={disabled}
            height={320}
          />
        </div>

        {/* Radius slider and info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Radius</Label>
              <span className="text-sm font-semibold text-primary">
                {(radiusMeters / 1000).toFixed(1)} km
              </span>
            </div>
            <Slider
              value={[radiusMeters]}
              onValueChange={([value]) => onRadiusChange(value)}
              min={100}
              max={100000}
              step={100}
              disabled={disabled}
            />
          </div>

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Latitude
              </Label>
              <Input
                type="number"
                step="0.000001"
                value={centerLat ?? ""}
                onChange={(e) =>
                  onCenterChange(
                    parseFloat(e.target.value) || 0,
                    centerLng ?? 0
                  )
                }
                placeholder="34.5553"
                disabled={disabled}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Longitude
              </Label>
              <Input
                type="number"
                step="0.000001"
                value={centerLng ?? ""}
                onChange={(e) =>
                  onCenterChange(
                    centerLat ?? 0,
                    parseFloat(e.target.value) || 0
                  )
                }
                placeholder="69.2075"
                disabled={disabled}
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Polygon zone
  if (zoneType === "polygon") {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-1 block">
            Draw Delivery Zone
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Click on the map to add points. Click the first point (green) to
            close the polygon.
          </p>
          <PolygonPickerMap
            coordinates={polygonCoordinates}
            onCoordinatesChange={onPolygonCoordinatesChange}
            color={zoneColor}
            disabled={disabled}
            height={360}
          />
        </div>

        {/* Polygon info */}
        {polygonCoordinates.length > 0 && (
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {polygonCoordinates.length} point
                {polygonCoordinates.length !== 1 && "s"} added
              </span>
              {polygonCoordinates.length >= 3 && (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700"
                >
                  Polygon complete
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// =============================================================================
// PRICING STEP
// =============================================================================

interface PricingStepProps {
  rateType: RateCalculationType;
  onRateTypeChange: (type: RateCalculationType) => void;
  baseRate: number;
  onBaseRateChange: (rate: number) => void;
  perItemRate?: number;
  onPerItemRateChange: (rate?: number) => void;
  perKgRate?: number;
  onPerKgRateChange: (rate?: number) => void;
  freeShippingThreshold?: number;
  onFreeShippingThresholdChange: (threshold?: number) => void;
  deliveryType: DeliveryMethodType | null;
  disabled?: boolean;
}

const RATE_TYPE_OPTIONS: {
  id: RateCalculationType;
  label: string;
  description: string;
}[] = [
  { id: "free", label: "Free", description: "No delivery charge" },
  { id: "flat", label: "Flat Rate", description: "Fixed price per order" },
  {
    id: "per_item",
    label: "Per Item",
    description: "Base rate + per item fee",
  },
  {
    id: "weight_based",
    label: "Weight Based",
    description: "Base rate + per kg fee",
  },
];

function PricingStep({
  rateType,
  onRateTypeChange,
  baseRate,
  onBaseRateChange,
  perItemRate,
  onPerItemRateChange,
  perKgRate,
  onPerKgRateChange,
  freeShippingThreshold,
  onFreeShippingThresholdChange,
  deliveryType,
  disabled,
}: PricingStepProps) {
  const isPickup = deliveryType === "pickup";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Set Pricing</h3>
        <p className="text-sm text-muted-foreground">
          {isPickup
            ? "Store pickup is typically free, but you can add a handling fee if needed."
            : "Configure how delivery fees are calculated for this zone."}
        </p>
      </div>

      {/* Rate Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Rate Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {RATE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onRateTypeChange(option.id);
                if (option.id === "free") {
                  onBaseRateChange(0);
                }
              }}
              disabled={disabled}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                rateType === option.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <p className="font-medium text-sm">{option.label}</p>
              <p className="text-xs text-muted-foreground">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Rate Inputs */}
      {rateType !== "free" && (
        <div className="space-y-4">
          {/* Base Rate */}
          <div>
            <Label
              htmlFor="base-rate"
              className="text-sm font-medium mb-2 block"
            >
              {rateType === "flat" ? "Delivery Fee" : "Base Rate"} (AFN)
            </Label>
            <Input
              id="base-rate"
              type="number"
              min="0"
              step="10"
              value={baseRate}
              onChange={(e) =>
                onBaseRateChange(parseFloat(e.target.value) || 0)
              }
              placeholder="0"
              disabled={disabled}
            />
          </div>

          {/* Per Item Rate */}
          {rateType === "per_item" && (
            <div>
              <Label
                htmlFor="per-item-rate"
                className="text-sm font-medium mb-2 block"
              >
                Per Item Fee (AFN)
              </Label>
              <Input
                id="per-item-rate"
                type="number"
                min="0"
                step="5"
                value={perItemRate ?? ""}
                onChange={(e) =>
                  onPerItemRateChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="10"
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Added for each item in the order
              </p>
            </div>
          )}

          {/* Per Kg Rate */}
          {rateType === "weight_based" && (
            <div>
              <Label
                htmlFor="per-kg-rate"
                className="text-sm font-medium mb-2 block"
              >
                Per Kg Fee (AFN)
              </Label>
              <Input
                id="per-kg-rate"
                type="number"
                min="0"
                step="5"
                value={perKgRate ?? ""}
                onChange={(e) =>
                  onPerKgRateChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="20"
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Added per kilogram of total order weight
              </p>
            </div>
          )}
        </div>
      )}

      {/* Free Shipping Threshold */}
      {rateType !== "free" && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="text-sm font-medium">
                Free Delivery Threshold
              </Label>
              <p className="text-xs text-muted-foreground">
                Offer free delivery for orders above a certain amount
              </p>
            </div>
            <Switch
              checked={
                freeShippingThreshold !== undefined && freeShippingThreshold > 0
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  onFreeShippingThresholdChange(2000); // Default 2000 AFN
                } else {
                  onFreeShippingThresholdChange(undefined);
                }
              }}
              disabled={disabled}
            />
          </div>

          {freeShippingThreshold !== undefined && freeShippingThreshold > 0 && (
            <Input
              type="number"
              min="0"
              step="100"
              value={freeShippingThreshold}
              onChange={(e) =>
                onFreeShippingThresholdChange(parseFloat(e.target.value) || 0)
              }
              placeholder="2000"
              disabled={disabled}
            />
          )}
        </div>
      )}

      {/* Preview */}
      <div className="bg-muted rounded-xl p-4">
        <h4 className="text-sm font-medium mb-2">Pricing Preview</h4>
        <div className="text-sm text-muted-foreground space-y-1">
          {rateType === "free" ? (
            <p className="text-green-600 font-medium">Free Delivery</p>
          ) : (
            <>
              <p>
                {rateType === "flat" && `${baseRate} AFN per order`}
                {rateType === "per_item" &&
                  `${baseRate} AFN base + ${perItemRate || 0} AFN per item`}
                {rateType === "weight_based" &&
                  `${baseRate} AFN base + ${perKgRate || 0} AFN per kg`}
              </p>
              {freeShippingThreshold && freeShippingThreshold > 0 && (
                <p className="text-green-600">
                  Free for orders above {freeShippingThreshold} AFN
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DETAILS STEP
// =============================================================================

interface DetailsStepProps {
  name: string;
  onNameChange: (name: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  deliveryType: DeliveryMethodType;
  zoneType: UnifiedZoneType;
  selectedCountries: string[];
  minDeliveryDays?: number;
  onMinDeliveryDaysChange: (days?: number) => void;
  maxDeliveryDays?: number;
  onMaxDeliveryDaysChange: (days?: number) => void;
  estimatedTime: string;
  onEstimatedTimeChange: (time: string) => void;
  includesTracking: boolean;
  onIncludesTrackingChange: (tracking: boolean) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  pickupLocationName: string;
  onPickupLocationNameChange: (name: string) => void;
  pickupLocationAddress: string;
  onPickupLocationAddressChange: (address: string) => void;
  disabled?: boolean;
}

function DetailsStep({
  name,
  onNameChange,
  color,
  onColorChange,
  isActive,
  onActiveChange,
  deliveryType,
  zoneType,
  selectedCountries,
  minDeliveryDays,
  onMinDeliveryDaysChange,
  maxDeliveryDays,
  onMaxDeliveryDaysChange,
  estimatedTime,
  onEstimatedTimeChange,
  includesTracking,
  onIncludesTrackingChange,
  description,
  onDescriptionChange,
  pickupLocationName,
  onPickupLocationNameChange,
  pickupLocationAddress,
  onPickupLocationAddressChange,
  disabled,
}: DetailsStepProps) {
  const zoneInfo = getZoneTypeInfo(zoneType);
  const preset = DELIVERY_TYPE_PRESETS.find((p) => p.id === deliveryType);
  const isPickup = deliveryType === "pickup";
  const isLocalDelivery = deliveryType === "local_delivery";

  // Generate suggested name
  const suggestedName = (() => {
    const baseTitle = preset?.title || "Delivery";
    if (zoneType === "worldwide") return `${baseTitle} (Worldwide)`;
    if (zoneType === "country") {
      if (selectedCountries.length === 1) {
        return `${baseTitle} - ${getCountryName(selectedCountries[0])}`;
      }
      if (selectedCountries.length <= 3) {
        return `${baseTitle} - ${selectedCountries.map(getCountryName).join(", ")}`;
      }
      return `${baseTitle} - ${selectedCountries.length} Countries`;
    }
    return baseTitle;
  })();

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <Label htmlFor="zone-name" className="text-sm font-medium mb-2 block">
          Delivery Option Name
        </Label>
        <Input
          id="zone-name"
          placeholder={suggestedName || "Enter name"}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
        />
        {suggestedName && !name && (
          <button
            type="button"
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => onNameChange(suggestedName)}
          >
            Use suggested: &ldquo;{suggestedName}&rdquo;
          </button>
        )}
      </div>

      {/* Timing */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">
          <Clock className="h-4 w-4 inline mr-1" />
          Delivery Time
        </Label>

        {isLocalDelivery ? (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Estimated Delivery Time
            </Label>
            <Input
              placeholder="30-60 minutes"
              value={estimatedTime}
              onChange={(e) => onEstimatedTimeChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        ) : isPickup ? (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Ready for Pickup
            </Label>
            <Input
              placeholder="Ready in 1-2 hours"
              value={estimatedTime}
              onChange={(e) => onEstimatedTimeChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Min Days
              </Label>
              <Input
                type="number"
                min="0"
                value={minDeliveryDays ?? ""}
                onChange={(e) =>
                  onMinDeliveryDaysChange(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="3"
                disabled={disabled}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Max Days
              </Label>
              <Input
                type="number"
                min="0"
                value={maxDeliveryDays ?? ""}
                onChange={(e) =>
                  onMaxDeliveryDaysChange(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="7"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pickup Location (for pickup type) */}
      {isPickup && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            <MapPin className="h-4 w-4 inline mr-1" />
            Pickup Location
          </Label>
          <Input
            placeholder="Store name or location name"
            value={pickupLocationName}
            onChange={(e) => onPickupLocationNameChange(e.target.value)}
            disabled={disabled}
          />
          <Textarea
            placeholder="Full address..."
            value={pickupLocationAddress}
            onChange={(e) => onPickupLocationAddressChange(e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>
      )}

      {/* Description */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Description (optional)
        </Label>
        <Textarea
          placeholder="Additional details shown to customers..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          rows={2}
        />
      </div>

      {/* Tracking */}
      {!isPickup && (
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Includes Tracking</Label>
            <p className="text-xs text-muted-foreground">
              Customers can track their shipment
            </p>
          </div>
          <Switch
            checked={includesTracking}
            onCheckedChange={onIncludesTrackingChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Color */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          <Palette className="h-4 w-4 inline mr-1" />
          Zone Color
        </Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform",
                color === c
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* Active Status */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Active</Label>
          <p className="text-xs text-muted-foreground">
            Inactive options won&apos;t be shown to customers
          </p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={onActiveChange}
          disabled={disabled}
        />
      </div>

      {/* Summary */}
      <div className="bg-muted rounded-xl p-4">
        <h4 className="text-sm font-medium mb-2">Summary</h4>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <span className="font-medium">Type:</span> {preset?.title}
          </p>
          <p>
            <span className="font-medium">Area:</span>{" "}
            {zoneInfo?.title || zoneType}
          </p>
          {selectedCountries.length > 0 && (
            <p>
              <span className="font-medium">Countries:</span>{" "}
              {selectedCountries.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
