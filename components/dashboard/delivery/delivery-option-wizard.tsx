"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Polygon } from "geojson";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  X,
  Globe,
  Palette,
  Clock,
  MapPin,
  Check,
  Circle,
  AlertCircle,
  Earth,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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
import type { RateCalculationType } from "@/lib/validations/unified-delivery";
import { toast } from "sonner";

// Dynamic imports for map components
const UnifiedDeliveryMap = dynamic(
  () => import("./map").then((mod) => mod.UnifiedDeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 bg-muted rounded-xl flex items-center justify-center">
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
      <div className="h-80 bg-muted rounded-xl flex items-center justify-center">
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
      <div className="h-80 bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

import {
  coordinatesToGeoJSON,
  geoJSONToCoordinates,
} from "./map/polygon-utils";

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

type AreaType = "radius" | "polygon" | "country" | "worldwide";

interface AreaTypeOption {
  type: AreaType;
  title: string;
  description: string;
  icon: typeof Circle;
}

const AREA_TYPE_OPTIONS: AreaTypeOption[] = [
  {
    type: "radius",
    title: "Radius Zone",
    description: "Circular area around a center point (e.g., 10km from store)",
    icon: Circle,
  },
  {
    type: "polygon",
    title: "Custom Area",
    description: "Draw a custom shape on the map for precise coverage",
    icon: MapPin,
  },
  {
    type: "country",
    title: "Countries",
    description: "Select one or more countries you ship to",
    icon: Globe,
  },
  {
    type: "worldwide",
    title: "Worldwide",
    description: "Ship to any location globally (fallback option)",
    icon: Earth,
  },
];

// =============================================================================
// WIZARD STEP DEFINITIONS
// =============================================================================

type WizardStep =
  | "area_type"
  | "define_area"
  | "pricing"
  | "details"
  | "review";

function getStepsForAreaType(areaType: AreaType | null): WizardStep[] {
  if (!areaType) return ["area_type"];

  if (areaType === "worldwide") {
    // Worldwide: no area to define, just pricing + details
    return ["area_type", "pricing", "details", "review"];
  }

  // All other types need area definition
  return ["area_type", "define_area", "pricing", "details", "review"];
}

function getStepTitle(step: WizardStep): string {
  switch (step) {
    case "area_type":
      return "Coverage";
    case "define_area":
      return "Area";
    case "pricing":
      return "Pricing";
    case "details":
      return "Details";
    case "review":
      return "Review";
  }
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface DeliveryOptionWizardProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: UnifiedZone | null;
  method?: UnifiedMethod | null;
  onSuccess?: (zone: UnifiedZone) => void;
}

export function DeliveryOptionWizard({
  tenantId,
  open,
  onOpenChange,
  zone,
  method,
  onSuccess,
}: DeliveryOptionWizardProps) {
  const isEditing = !!zone;
  const [isPending, startTransition] = useTransition();

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  // Area type
  const [areaType, setAreaType] = useState<AreaType | null>(
    zone?.zoneType as AreaType | null
  );

  // Zone configuration
  const [name, setName] = useState(zone?.name || "");
  const [color, setColor] = useState(zone?.color || ZONE_COLORS[0]);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);

  // Location data
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    (zone?.countries as string[]) || []
  );

  // Radius zone
  const [centerLat, setCenterLat] = useState<number | undefined>(
    zone?.centerLat ? parseFloat(zone.centerLat) : undefined
  );
  const [centerLng, setCenterLng] = useState<number | undefined>(
    zone?.centerLng ? parseFloat(zone.centerLng) : undefined
  );
  const [radiusMeters, setRadiusMeters] = useState<number>(
    zone?.radiusMeters || 5000
  );

  // Polygon zone
  const [polygonCoordinates, setPolygonCoordinates] = useState<
    [number, number][]
  >(
    zone?.polygonGeojson
      ? geoJSONToCoordinates(zone.polygonGeojson as Polygon)
      : []
  );

  // Pricing
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

  // Timing
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
  const [description, setDescription] = useState<string>(
    method?.description || ""
  );

  const steps = useMemo(() => getStepsForAreaType(areaType), [areaType]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = steps[currentStepIndex];

  // Is this a local delivery type (radius/polygon)?
  const isLocalDelivery = areaType === "radius" || areaType === "polygon";

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case "area_type":
        return !!areaType;

      case "define_area":
        if (!areaType) return false;
        switch (areaType) {
          case "country":
            return selectedCountries.length > 0;
          case "radius":
            return centerLat !== undefined && centerLng !== undefined;
          case "polygon":
            return polygonCoordinates.length >= 3;
          default:
            return true;
        }

      case "pricing":
        if (rateType === "free") return true;
        return baseRate >= 0;

      case "details":
        return name.trim().length > 0;

      case "review":
        return true;

      default:
        return false;
    }
  }, [
    currentStep,
    areaType,
    selectedCountries,
    centerLat,
    centerLng,
    polygonCoordinates,
    rateType,
    baseRate,
    name,
  ]);

  const canProceed = validateCurrentStep();

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index <= currentStepIndex) {
      setCurrentStepIndex(index);
    }
  };

  // When area type changes, reset to first step of new flow
  const handleAreaTypeChange = (type: AreaType) => {
    setAreaType(type);
  };

  // ==========================================================================
  // SAVE
  // ==========================================================================

  const handleSave = async () => {
    if (!areaType) return;

    const zoneInput = {
      name,
      zoneType: areaType,
      color,
      isActive,
      displayOrder: 0,
      countries: selectedCountries,
      regions: [],
      cities: [],
      postalPatterns: [],
      centerLat: areaType === "radius" ? centerLat : undefined,
      centerLng: areaType === "radius" ? centerLng : undefined,
      radiusMeters: areaType === "radius" ? radiusMeters : undefined,
      polygonGeojson:
        areaType === "polygon"
          ? (coordinatesToGeoJSON(polygonCoordinates) ?? undefined)
          : undefined,
    };

    // Determine method type based on area type
    const methodType = isLocalDelivery
      ? ("local_delivery" as const)
      : ("standard" as const);

    const methodInput = {
      name,
      description: description || undefined,
      methodType,
      rateType,
      baseRate,
      perItemRate,
      perKgRate,
      freeShippingThreshold,
      minDeliveryDays,
      maxDeliveryDays,
      estimatedTime: estimatedTime || undefined,
      includesTracking,
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
    setCurrentStepIndex(0);
    setAreaType(null);
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
    setDescription("");
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {isEditing ? "Edit Delivery Option" : "Create Delivery Option"}
          </DialogTitle>

          {/* Step indicator */}
          {areaType && (
            <div className="flex items-center gap-1 pt-3 overflow-x-auto">
              {steps.map((step, idx) => (
                <div key={step} className="flex items-center">
                  {idx > 0 && (
                    <div
                      className={cn(
                        "w-6 h-0.5 mx-0.5",
                        idx <= currentStepIndex ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(idx)}
                    disabled={idx > currentStepIndex}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                      currentStepIndex === idx
                        ? "bg-primary text-primary-foreground"
                        : idx < currentStepIndex
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {idx < currentStepIndex ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                    )}
                    <span className="hidden sm:inline">
                      {getStepTitle(step)}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === "area_type" && (
            <AreaTypeStep
              selectedType={areaType}
              onSelect={handleAreaTypeChange}
              disabled={isPending}
            />
          )}

          {currentStep === "define_area" && areaType && (
            <DefineAreaStep
              areaType={areaType}
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

          {currentStep === "pricing" && (
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
              disabled={isPending}
            />
          )}

          {currentStep === "details" && (
            <DetailsStep
              name={name}
              onNameChange={setName}
              color={color}
              onColorChange={setColor}
              isActive={isActive}
              onActiveChange={setIsActive}
              areaType={areaType}
              selectedCountries={selectedCountries}
              radiusMeters={radiusMeters}
              minDeliveryDays={minDeliveryDays}
              onMinDeliveryDaysChange={setMinDeliveryDays}
              maxDeliveryDays={maxDeliveryDays}
              onMaxDeliveryDaysChange={setMaxDeliveryDays}
              estimatedTime={estimatedTime}
              onEstimatedTimeChange={setEstimatedTime}
              includesTracking={includesTracking}
              onIncludesTrackingChange={setIncludesTracking}
              description={description}
              onDescriptionChange={setDescription}
              disabled={isPending}
            />
          )}

          {currentStep === "review" && (
            <ReviewStep
              areaType={areaType}
              name={name}
              selectedCountries={selectedCountries}
              radiusMeters={radiusMeters}
              rateType={rateType}
              baseRate={baseRate}
              freeShippingThreshold={freeShippingThreshold}
              minDeliveryDays={minDeliveryDays}
              maxDeliveryDays={maxDeliveryDays}
              estimatedTime={estimatedTime}
              color={color}
              isActive={isActive}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0 bg-muted/30">
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

          {currentStep === "review" ? (
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Delivery Option"}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canProceed || isPending}>
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// STEP: AREA TYPE
// =============================================================================

interface AreaTypeStepProps {
  selectedType: AreaType | null;
  onSelect: (type: AreaType) => void;
  disabled?: boolean;
}

function AreaTypeStep({ selectedType, onSelect, disabled }: AreaTypeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Where do you deliver?</h3>
        <p className="text-sm text-muted-foreground">
          Choose how to define your delivery coverage area.
        </p>
      </div>

      <div className="grid gap-3">
        {AREA_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type)}
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
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold">{option.title}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
              {isSelected && (
                <Check className="h-5 w-5 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// STEP: DEFINE AREA
// =============================================================================

interface DefineAreaStepProps {
  areaType: AreaType;
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

function DefineAreaStep({
  areaType,
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
}: DefineAreaStepProps) {
  if (areaType === "country") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Select Countries</h3>
          <p className="text-sm text-muted-foreground">
            Click on countries to add or remove them from your delivery zone.
          </p>
        </div>

        <UnifiedDeliveryMap
          mode="select-countries"
          selectedCountries={selectedCountries}
          onCountriesChange={onCountriesChange}
          zoneColor={zoneColor}
          height={300}
          className="rounded-xl"
          compact
        />

        {selectedCountries.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Selected ({selectedCountries.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {selectedCountries.map((code) => (
                <Badge
                  key={code}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    onCountriesChange(
                      selectedCountries.filter((c) => c !== code)
                    )
                  }
                >
                  {getCountryFlag(code)} {getCountryName(code)}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (areaType === "radius") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Set Delivery Radius</h3>
          <p className="text-sm text-muted-foreground">
            Click on the map to set your center point, then adjust the radius.
          </p>
        </div>

        <RadiusPickerMap
          centerLat={centerLat}
          centerLng={centerLng}
          radiusMeters={radiusMeters}
          color={zoneColor}
          onCenterChange={onCenterChange}
          onRadiusChange={onRadiusChange}
          disabled={disabled}
          height={300}
        />

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Delivery Radius</Label>
            <span className="text-sm font-semibold text-primary">
              {(radiusMeters / 1000).toFixed(1)} km
            </span>
          </div>
          <Slider
            value={[radiusMeters]}
            onValueChange={([value]) => onRadiusChange(value)}
            min={500}
            max={100000}
            step={500}
            disabled={disabled}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.5 km</span>
            <span>100 km</span>
          </div>
        </div>
      </div>
    );
  }

  if (areaType === "polygon") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Draw Delivery Area</h3>
          <p className="text-sm text-muted-foreground">
            Click on the map to add points. Click the first point to close the
            shape.
          </p>
        </div>

        <PolygonPickerMap
          coordinates={polygonCoordinates}
          onCoordinatesChange={onPolygonCoordinatesChange}
          color={zoneColor}
          disabled={disabled}
          height={350}
        />

        {polygonCoordinates.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {polygonCoordinates.length} points added
            </span>
            {polygonCoordinates.length >= 3 && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Shape complete
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// =============================================================================
// STEP: PRICING
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
  disabled?: boolean;
}

const RATE_TYPES: {
  id: RateCalculationType;
  label: string;
  description: string;
}[] = [
  { id: "free", label: "Free Delivery", description: "No charge for delivery" },
  { id: "flat", label: "Flat Rate", description: "Same price for every order" },
  { id: "per_item", label: "Per Item", description: "Base + fee per item" },
  {
    id: "weight_based",
    label: "Weight Based",
    description: "Base + fee per kg",
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
  disabled,
}: PricingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Set Your Pricing</h3>
        <p className="text-sm text-muted-foreground">
          Choose how to calculate delivery fees for this zone.
        </p>
      </div>

      {/* Rate type selection */}
      <div className="grid grid-cols-2 gap-2">
        {RATE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => {
              onRateTypeChange(type.id);
              if (type.id === "free") onBaseRateChange(0);
            }}
            disabled={disabled}
            className={cn(
              "p-3 rounded-xl border-2 text-left transition-all",
              rateType === type.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <p className="font-medium text-sm">{type.label}</p>
            <p className="text-xs text-muted-foreground">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Rate inputs */}
      {rateType !== "free" && (
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm font-medium">
              {rateType === "flat" ? "Delivery Fee" : "Base Rate"} (AFN)
            </Label>
            <Input
              type="number"
              min="0"
              step="10"
              value={baseRate}
              onChange={(e) =>
                onBaseRateChange(parseFloat(e.target.value) || 0)
              }
              onWheel={(e) => e.currentTarget.blur()}
              disabled={disabled}
              className="mt-1.5"
            />
          </div>

          {rateType === "per_item" && (
            <div>
              <Label className="text-sm font-medium">Per Item Fee (AFN)</Label>
              <Input
                type="number"
                min="0"
                step="5"
                value={perItemRate ?? ""}
                onChange={(e) =>
                  onPerItemRateChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="10"
                disabled={disabled}
                className="mt-1.5"
              />
            </div>
          )}

          {rateType === "weight_based" && (
            <div>
              <Label className="text-sm font-medium">Per Kg Fee (AFN)</Label>
              <Input
                type="number"
                min="0"
                step="5"
                value={perKgRate ?? ""}
                onChange={(e) =>
                  onPerKgRateChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="20"
                disabled={disabled}
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      )}

      {/* Free shipping threshold */}
      {rateType !== "free" && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Free Delivery Threshold
              </Label>
              <p className="text-xs text-muted-foreground">
                Offer free delivery above a certain order amount
              </p>
            </div>
            <Switch
              checked={!!freeShippingThreshold && freeShippingThreshold > 0}
              onCheckedChange={(checked) => {
                onFreeShippingThresholdChange(checked ? 2000 : undefined);
              }}
              disabled={disabled}
            />
          </div>

          {freeShippingThreshold && freeShippingThreshold > 0 && (
            <Input
              type="number"
              min="0"
              step="100"
              value={freeShippingThreshold}
              onChange={(e) =>
                onFreeShippingThresholdChange(parseFloat(e.target.value) || 0)
              }
              onWheel={(e) => e.currentTarget.blur()}
              disabled={disabled}
              className="mt-3"
            />
          )}
        </div>
      )}

      {/* Preview */}
      <div className="bg-muted rounded-xl p-4">
        <h4 className="text-sm font-medium mb-2">Pricing Preview</h4>
        <div className="text-sm text-muted-foreground">
          {rateType === "free" ? (
            <p className="text-green-600 font-medium">Free Delivery</p>
          ) : (
            <>
              <p>
                {rateType === "flat" &&
                  `${baseRate.toLocaleString()} AFN per order`}
                {rateType === "per_item" &&
                  `${baseRate.toLocaleString()} AFN + ${perItemRate || 0} AFN per item`}
                {rateType === "weight_based" &&
                  `${baseRate.toLocaleString()} AFN + ${perKgRate || 0} AFN per kg`}
              </p>
              {freeShippingThreshold && freeShippingThreshold > 0 && (
                <p className="text-green-600 mt-1">
                  Free for orders above {freeShippingThreshold.toLocaleString()}{" "}
                  AFN
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
// STEP: DETAILS
// =============================================================================

interface DetailsStepProps {
  name: string;
  onNameChange: (name: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  areaType: AreaType | null;
  selectedCountries: string[];
  radiusMeters: number;
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
  disabled?: boolean;
}

function DetailsStep({
  name,
  onNameChange,
  color,
  onColorChange,
  isActive,
  onActiveChange,
  areaType,
  selectedCountries,
  radiusMeters,
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
  disabled,
}: DetailsStepProps) {
  const isLocalDelivery = areaType === "radius" || areaType === "polygon";
  const isShipping = areaType === "country" || areaType === "worldwide";

  // Generate suggested name
  const suggestedName = useMemo(() => {
    if (areaType === "worldwide") return "Worldwide Shipping";
    if (areaType === "country" && selectedCountries.length === 1) {
      return `Shipping - ${getCountryName(selectedCountries[0])}`;
    }
    if (areaType === "country" && selectedCountries.length > 1) {
      return `Shipping - ${selectedCountries.length} Countries`;
    }
    if (areaType === "radius") {
      return `Local Delivery (${(radiusMeters / 1000).toFixed(0)}km)`;
    }
    if (areaType === "polygon") return "Local Delivery";
    return "Delivery";
  }, [areaType, selectedCountries, radiusMeters]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Final Details</h3>
        <p className="text-sm text-muted-foreground">
          Name your delivery option and set timing details.
        </p>
      </div>

      {/* Name */}
      <div>
        <Label className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder={suggestedName}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          className="mt-1.5"
        />
        {!name && suggestedName && (
          <button
            type="button"
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => onNameChange(suggestedName)}
          >
            Use suggestion: &ldquo;{suggestedName}&rdquo;
          </button>
        )}
      </div>

      {/* Timing - different for local vs shipping */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          <Clock className="h-4 w-4 inline mr-1" />
          Delivery Time
        </Label>

        {isLocalDelivery ? (
          <Input
            placeholder="e.g., 30-60 minutes"
            value={estimatedTime}
            onChange={(e) => onEstimatedTimeChange(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Min Days</Label>
              <Input
                type="number"
                min="0"
                value={minDeliveryDays ?? ""}
                onChange={(e) =>
                  onMinDeliveryDaysChange(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="3"
                disabled={disabled}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max Days</Label>
              <Input
                type="number"
                min="0"
                value={maxDeliveryDays ?? ""}
                onChange={(e) =>
                  onMaxDeliveryDaysChange(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="7"
                disabled={disabled}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <Label className="text-sm font-medium">Description (optional)</Label>
        <Textarea
          placeholder="Additional details shown to customers..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          rows={2}
          className="mt-1.5"
        />
      </div>

      {/* Tracking - only for shipping */}
      {isShipping && (
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

      {/* Active */}
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
    </div>
  );
}

// =============================================================================
// STEP: REVIEW
// =============================================================================

interface ReviewStepProps {
  areaType: AreaType | null;
  name: string;
  selectedCountries: string[];
  radiusMeters: number;
  rateType: RateCalculationType;
  baseRate: number;
  freeShippingThreshold?: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  estimatedTime: string;
  color: string;
  isActive: boolean;
}

function ReviewStep({
  areaType,
  name,
  selectedCountries,
  radiusMeters,
  rateType,
  baseRate,
  freeShippingThreshold,
  minDeliveryDays,
  maxDeliveryDays,
  estimatedTime,
  color,
  isActive,
}: ReviewStepProps) {
  const areaOption = AREA_TYPE_OPTIONS.find((o) => o.type === areaType);
  const Icon = areaOption?.icon || Globe;

  const getCoverageText = () => {
    if (areaType === "worldwide") return "Worldwide";
    if (areaType === "country") {
      if (selectedCountries.length === 1)
        return getCountryName(selectedCountries[0]);
      return `${selectedCountries.length} countries`;
    }
    if (areaType === "radius")
      return `${(radiusMeters / 1000).toFixed(1)} km radius`;
    if (areaType === "polygon") return "Custom area";
    return "Not defined";
  };

  const getPricingText = () => {
    if (rateType === "free") return "Free";
    return `${baseRate.toLocaleString()} AFN`;
  };

  const getTimingText = () => {
    if (estimatedTime) return estimatedTime;
    if (minDeliveryDays && maxDeliveryDays)
      return `${minDeliveryDays}-${maxDeliveryDays} days`;
    if (minDeliveryDays) return `${minDeliveryDays}+ days`;
    if (maxDeliveryDays) return `Up to ${maxDeliveryDays} days`;
    return "Not specified";
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">
          Review Your Delivery Option
        </h3>
        <p className="text-sm text-muted-foreground">
          Please review the details before creating.
        </p>
      </div>

      <div className="bg-muted/50 rounded-xl divide-y">
        {/* Header with icon and name */}
        <div className="flex items-center gap-4 p-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-semibold text-lg">{name || "Untitled"}</h4>
            <p className="text-sm text-muted-foreground">{areaOption?.title}</p>
          </div>
          {!isActive && (
            <Badge variant="secondary" className="ml-auto">
              Inactive
            </Badge>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 p-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Coverage
            </p>
            <p className="font-medium">{getCoverageText()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Pricing
            </p>
            <p className="font-medium">{getPricingText()}</p>
            {freeShippingThreshold && freeShippingThreshold > 0 && (
              <p className="text-xs text-green-600">
                Free above {freeShippingThreshold.toLocaleString()} AFN
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Timing
            </p>
            <p className="font-medium">{getTimingText()}</p>
          </div>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You can edit these settings anytime after creation.
        </AlertDescription>
      </Alert>
    </div>
  );
}
