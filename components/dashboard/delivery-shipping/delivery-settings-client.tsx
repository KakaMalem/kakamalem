"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Globe, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeliveryZonesManager } from "@/components/dashboard/delivery-zones/delivery-zones-manager";
import { ShippingRatesManager } from "./shipping-rates-manager";
import { updateDeliveryZonesEnabled } from "@/lib/actions/stores";
import { toast } from "sonner";
import type { DeliveryZone } from "@/lib/db/schema";

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

interface DeliverySettingsClientProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  enableDeliveryZones: boolean;
  deliveryZones: DeliveryZone[];
  shippingZones: ShippingZone[];
}

type DeliveryMode = "local" | "anywhere";

export function DeliverySettingsClient({
  tenantId,
  storeSlug,
  currency,
  enableDeliveryZones: initialEnabled,
  deliveryZones,
  shippingZones,
}: DeliverySettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Default to "local" (GPS-based delivery zones) as the recommended option
  const [mode, setMode] = useState<DeliveryMode>("local");

  const hasChanges = (mode === "local") !== initialEnabled;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateDeliveryZonesEnabled(
        tenantId,
        storeSlug,
        mode === "local"
      );
      if (result.success) {
        toast.success("Settings saved");
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to save");
        setMode(initialEnabled ? "local" : "anywhere");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delivery Mode</CardTitle>
          <CardDescription>
            Choose how customers can receive their orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as DeliveryMode)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="local"
                disabled={isPending}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                GPS System
              </TabsTrigger>
              <TabsTrigger
                value="anywhere"
                disabled={isPending}
                className="flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                Shipping
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium mb-1">GPS-Based Delivery Zones</h4>
                <p className="text-sm text-muted-foreground">
                  Define areas on a map where you deliver. Customers outside
                  these zones cannot place orders. Best for restaurants, local
                  stores, and same-day delivery.
                </p>
              </div>
              <DeliveryZonesManager
                tenantId={tenantId}
                currency={currency}
                initialZones={deliveryZones}
              />
            </TabsContent>

            <TabsContent value="anywhere" className="mt-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium mb-1">Shipping Rates</h4>
                <p className="text-sm text-muted-foreground">
                  Accept orders from any location and configure shipping fees.
                  Leave empty for free shipping on all orders.
                </p>
              </div>
              <ShippingRatesManager
                tenantId={tenantId}
                storeSlug={storeSlug}
                currency={currency}
                initialZones={shippingZones}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
