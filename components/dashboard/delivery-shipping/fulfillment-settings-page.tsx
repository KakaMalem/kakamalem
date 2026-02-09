"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Truck,
  Info,
  Check,
  ChevronDown,
  ChevronRight,
  Settings2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { DeliveryZonesManager } from "@/components/dashboard/delivery-zones/delivery-zones-manager";
import { ShippingRatesManager } from "./shipping-rates-manager";
import { updateFulfillmentSettings } from "@/lib/actions/stores";
import type { DeliveryZone } from "@/lib/db/schema";

// =============================================================================
// TYPES
// =============================================================================

type ShippingMethod = {
  id: string;
  tenantId: string;
  zoneId: string;
  name: string;
  description: string | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  rateType:
    | "flat"
    | "per_item"
    | "weight_based"
    | "weight_tiered"
    | "price_based";
  baseRate: string;
  perItemRate: string | null;
  perKgRate: string | null;
  freeShippingThreshold: string | null;
  minWeight: string | null;
  maxWeight: string | null;
  handlingFee: string | null;
  includesInsurance: boolean;
  insuranceRate: string | null;
  includesTracking: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShippingZone = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  countries: string[] | null;
  states: string[] | null;
  cities: string[] | null;
  postalCodes: string[] | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  methods: ShippingMethod[];
};

interface FulfillmentSettingsPageProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  enableDeliveryZones: boolean;
  enableShipping: boolean;
  deliveryZones: DeliveryZone[];
  shippingZones: ShippingZone[];
  storeLocation?: { lat: number; lng: number } | null;
}

// =============================================================================
// FULFILLMENT CARD COMPONENT
// =============================================================================

interface FulfillmentCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  disabled?: boolean;
  disabledReason?: string;
  badge?: {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  };
  configuredCount?: number;
  children: React.ReactNode;
}

function FulfillmentCard({
  title,
  description,
  icon,
  enabled,
  onToggle,
  isExpanded,
  onToggleExpand,
  disabled,
  disabledReason,
  badge: _badge,
  configuredCount,
  children,
}: FulfillmentCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200 overflow-hidden",
        enabled && "ring-1 ring-primary/20",
        disabled && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg transition-colors",
              enabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{title}</h3>
              {enabled && (
                <Badge
                  variant="outline"
                  className="text-[11px] border-green-200 bg-green-50 text-green-700 px-1.5 py-0"
                >
                  <Check className="mr-0.5 h-3 w-3" />
                  Active
                </Badge>
              )}
              {configuredCount !== undefined && configuredCount > 0 && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                  {configuredCount} zone{configuredCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="shrink-0">
                <Switch
                  checked={enabled}
                  onCheckedChange={onToggle}
                  disabled={disabled}
                />
              </div>
            </TooltipTrigger>
            {disabled && disabledReason && (
              <TooltipContent>
                <p>{disabledReason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Expandable Configuration */}
      {enabled && (
        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between px-4 sm:px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 border-t transition-colors">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Configuration
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !isExpanded && "-rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 sm:p-5 pt-4 border-t bg-muted/20">
              {children}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FulfillmentSettingsPage({
  tenantId,
  storeSlug,
  currency,
  enableDeliveryZones: initialEnableDeliveryZones,
  enableShipping: initialEnableShipping,
  deliveryZones,
  shippingZones,
  storeLocation,
}: FulfillmentSettingsPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state for toggles
  const [enableDeliveryZones, setEnableDeliveryZones] = useState(
    initialEnableDeliveryZones
  );
  const [enableShipping, setEnableShipping] = useState(initialEnableShipping);

  // Track which sections are expanded
  const [deliveryExpanded, setDeliveryExpanded] = useState(
    initialEnableDeliveryZones
  );
  const [shippingExpanded, setShippingExpanded] = useState(
    initialEnableShipping && !initialEnableDeliveryZones
  );

  // Check if there are unsaved changes
  const hasChanges =
    enableDeliveryZones !== initialEnableDeliveryZones ||
    enableShipping !== initialEnableShipping;

  // Prevent disabling both
  const canDisableDeliveryZones = enableShipping;
  const canDisableShipping = enableDeliveryZones;

  // Handle toggle with validation
  const handleDeliveryZonesToggle = useCallback(
    (checked: boolean) => {
      if (!checked && !enableShipping) {
        toast.error(
          "At least one fulfillment method must be enabled. Enable Shipping first."
        );
        return;
      }
      setEnableDeliveryZones(checked);
      if (checked) setDeliveryExpanded(true);
    },
    [enableShipping]
  );

  const handleShippingToggle = useCallback(
    (checked: boolean) => {
      if (!checked && !enableDeliveryZones) {
        toast.error(
          "At least one fulfillment method must be enabled. Enable Local Delivery first."
        );
        return;
      }
      setEnableShipping(checked);
      if (checked) setShippingExpanded(true);
    },
    [enableDeliveryZones]
  );

  // Save handler
  const handleSave = useCallback(() => {
    startTransition(async () => {
      const result = await updateFulfillmentSettings(tenantId, storeSlug, {
        enableDeliveryZones,
        enableShipping,
      });

      if (result.success) {
        toast.success("Fulfillment settings saved successfully");
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to save settings");
        // Revert on error
        setEnableDeliveryZones(initialEnableDeliveryZones);
        setEnableShipping(initialEnableShipping);
      }
    });
  }, [
    tenantId,
    storeSlug,
    enableDeliveryZones,
    enableShipping,
    initialEnableDeliveryZones,
    initialEnableShipping,
    router,
  ]);

  // Count configured items
  const activeDeliveryZonesCount = deliveryZones.filter(
    (z) => z.isActive
  ).length;
  const _activeShippingMethodsCount = shippingZones.reduce(
    (acc, zone) => acc + zone.methods.filter((m) => m.isActive).length,
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Fulfillment Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure how customers receive their orders.
        </p>
      </div>

      {/* Validation Warning */}
      {!enableDeliveryZones && !enableShipping && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            At least one fulfillment method must be enabled for customers to
            place orders.
          </AlertDescription>
        </Alert>
      )}

      {/* Fulfillment Cards */}
      <div className="space-y-3">
        {/* Local Delivery Card */}
        <FulfillmentCard
          title="Local Delivery"
          description="GPS-based delivery zones for nearby customers with custom fees."
          icon={<MapPin className="h-5 w-5" />}
          enabled={enableDeliveryZones}
          onToggle={handleDeliveryZonesToggle}
          isExpanded={deliveryExpanded}
          onToggleExpand={() => setDeliveryExpanded(!deliveryExpanded)}
          disabled={!canDisableDeliveryZones && enableDeliveryZones}
          disabledReason="Enable Shipping first before disabling Local Delivery"
          configuredCount={activeDeliveryZonesCount}
        >
          <DeliveryZonesManager
            tenantId={tenantId}
            currency={currency}
            initialZones={deliveryZones}
            storeLocation={storeLocation}
          />
        </FulfillmentCard>

        {/* Shipping Card */}
        <FulfillmentCard
          title="Shipping"
          description="Accept orders from anywhere with configured shipping rates."
          icon={<Truck className="h-5 w-5" />}
          enabled={enableShipping}
          onToggle={handleShippingToggle}
          isExpanded={shippingExpanded}
          onToggleExpand={() => setShippingExpanded(!shippingExpanded)}
          disabled={!canDisableShipping && enableShipping}
          disabledReason="Enable Local Delivery first before disabling Shipping"
          configuredCount={shippingZones.length}
        >
          <ShippingRatesManager
            tenantId={tenantId}
            storeSlug={storeSlug}
            currency={currency}
            initialZones={shippingZones}
          />
        </FulfillmentCard>
      </div>

      {/* Save Bar - only show when there are changes */}
      {hasChanges && (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes
          </p>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}

      {/* Help Section - Collapsible for cleaner UI */}
      <details className="group rounded-lg border bg-card">
        <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            How fulfillment works
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t px-3 pb-3 pt-2">
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                1
              </span>
              <p>
                <strong className="text-foreground">Local customers</strong> see
                delivery options with zone-specific pricing.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                2
              </span>
              <p>
                <strong className="text-foreground">Remote customers</strong>{" "}
                see shipping rates based on location.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                3
              </span>
              <p>
                <strong className="text-foreground">Both enabled?</strong>{" "}
                Customers can choose their preferred method.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                4
              </span>
              <p>
                <strong className="text-foreground">No rates?</strong> Defaults
                to free shipping/delivery.
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
