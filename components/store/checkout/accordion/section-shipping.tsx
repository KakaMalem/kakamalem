"use client";

import { useState, useEffect } from "react";
import { MapPin, AlertCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  useCheckoutStore,
  type ShippingMethod,
} from "@/lib/stores/use-checkout-store";
import { calculateShippingAction } from "@/lib/actions/checkout";
import { OutOfZoneMap } from "../out-of-zone-map";
import type { CheckoutDeliveryZone } from "@/lib/actions/unified-delivery";

interface SectionShippingProps {
  tenantId: string;
  currency: string;
  deliveryZones: CheckoutDeliveryZone[];
  onContinue: () => void;
  onEditAddress: () => void;
}

type FulfillmentType = "local_delivery" | "shipping";

type ShippingMethodOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  type?: FulfillmentType;
};

export function SectionShipping({
  tenantId,
  currency,
  deliveryZones,
  onContinue,
  onEditAddress,
}: SectionShippingProps) {
  const { shippingAddress, subtotal, selectedMethod, setShippingMethod } =
    useCheckoutStore();

  const [fetchState, setFetchState] = useState<{
    isLoading: boolean;
    error: string | null;
    isOutOfZone: boolean;
    zoneName: string | null;
    methods: ShippingMethodOption[];
    hasLocalDelivery: boolean;
    hasShipping: boolean;
    deliveryZonesEnabled: boolean;
    shippingEnabled: boolean;
  }>({
    isLoading: !!shippingAddress,
    error: null,
    isOutOfZone: false,
    zoneName: null,
    methods: [],
    hasLocalDelivery: false,
    hasShipping: false,
    deliveryZonesEnabled: false,
    shippingEnabled: false,
  });

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    selectedMethod?.id || null
  );

  const error = !shippingAddress
    ? "No shipping address selected"
    : fetchState.error;
  const isLoading = shippingAddress ? fetchState.isLoading : false;
  const isOutOfZone = fetchState.isOutOfZone;
  const zoneName = fetchState.zoneName;
  const methods = fetchState.methods;

  // Fetch shipping methods when address is available
  useEffect(() => {
    if (!shippingAddress) return;

    const address = shippingAddress;
    let cancelled = false;

    async function fetchMethods() {
      setFetchState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await calculateShippingAction(tenantId, address, subtotal);

      if (cancelled) return;

      if (!result.success) {
        setFetchState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error?.message || "Failed to load shipping options",
        }));
        return;
      }

      const data = result.data;
      const deliveryZonesEnabled = data?.deliveryZonesEnabled ?? false;
      const shippingEnabled = data?.shippingEnabled ?? true;
      const isWithinDeliveryZone = data?.isWithinDeliveryZone ?? false;
      const returnedMethods = data?.methods || [];

      // Check if we have local delivery and/or shipping options
      const hasLocalDelivery = returnedMethods.some(
        (m) => m.type === "local_delivery"
      );
      const hasShipping = returnedMethods.some((m) => m.type === "shipping");

      // Out of zone scenario: delivery zones enabled and outside zone
      // Do not show any shipping methods if out of zone when delivery zones are enabled
      if (deliveryZonesEnabled && !isWithinDeliveryZone) {
        setFetchState((prev) => ({
          ...prev,
          isLoading: false,
          isOutOfZone: true,
          error: "Your selected address is outside our delivery areas.",
          deliveryZonesEnabled,
          shippingEnabled,
          hasLocalDelivery: false,
          hasShipping: false,
          methods: [],
        }));
        return;
      }

      // No methods available at all
      if (returnedMethods.length === 0) {
        const freeShipping: ShippingMethodOption = {
          id: "free-shipping",
          name: "Free Shipping",
          description: "Standard delivery",
          price: 0,
          minDeliveryDays: null,
          maxDeliveryDays: null,
          type: "shipping",
        };

        setFetchState({
          isLoading: false,
          error: null,
          isOutOfZone: false,
          zoneName: null,
          methods: [freeShipping],
          hasLocalDelivery: false,
          hasShipping: true,
          deliveryZonesEnabled,
          shippingEnabled,
        });

        if (!selectedMethodId) {
          setSelectedMethodId(freeShipping.id);
          setShippingMethod(freeShipping);
        }
        return;
      }

      setFetchState({
        isLoading: false,
        error: null,
        isOutOfZone: deliveryZonesEnabled && !isWithinDeliveryZone,
        zoneName: data?.zone?.name || null,
        methods: returnedMethods,
        hasLocalDelivery,
        hasShipping,
        deliveryZonesEnabled,
        shippingEnabled,
      });

      // Auto-select first method if none selected
      if (!selectedMethodId && returnedMethods.length > 0) {
        const firstMethod = returnedMethods[0];
        setSelectedMethodId(firstMethod.id);
        setShippingMethod({
          id: firstMethod.id,
          name: firstMethod.name,
          description: firstMethod.description,
          price: firstMethod.price,
          minDeliveryDays: firstMethod.minDeliveryDays,
          maxDeliveryDays: firstMethod.maxDeliveryDays,
        });
      }
    }

    fetchMethods();

    return () => {
      cancelled = true;
    };
  }, [
    tenantId,
    shippingAddress,
    subtotal,
    selectedMethodId,
    setShippingMethod,
  ]);

  const handleMethodSelect = (methodId: string) => {
    const method = methods.find((m) => m.id === methodId);
    if (method) {
      setSelectedMethodId(methodId);
      setShippingMethod({
        id: method.id,
        name: method.name,
        description: method.description,
        price: method.price,
        minDeliveryDays: method.minDeliveryDays,
        maxDeliveryDays: method.maxDeliveryDays,
      });
    }
  };

  const handleContinue = () => {
    if (selectedMethodId && selectedMethod) {
      onContinue();
    }
  };

  const formatDeliveryEstimate = (
    minDays: number | null,
    maxDays: number | null
  ): string => {
    if (minDays === null && maxDays === null) return "";
    if (minDays === maxDays && minDays !== null) {
      return `${minDays} ${minDays === 1 ? "day" : "days"}`;
    }
    if (minDays !== null && maxDays !== null) {
      return `${minDays}-${maxDays} days`;
    }
    if (minDays !== null) return `${minDays}+ days`;
    if (maxDays !== null) return `Up to ${maxDays} days`;
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Skeleton className="size-5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Out of Zone Error - Only show if no shipping methods available */}
      {!isLoading &&
        error &&
        isOutOfZone &&
        shippingAddress &&
        methods.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Outside Delivery Area
                  </p>
                  <p className="mt-1 text-sm text-destructive/80">
                    Your selected address is outside our delivery zones and we
                    don&apos;t currently offer shipping to your location. Please
                    choose an address within the highlighted zones.
                  </p>
                </div>
              </div>
            </div>

            {deliveryZones.length > 0 && (
              <OutOfZoneMap
                userAddress={{
                  latitude: shippingAddress.latitude,
                  longitude: shippingAddress.longitude,
                }}
                deliveryZones={deliveryZones}
              />
            )}

            <Button
              variant="default"
              className="w-full"
              onClick={onEditAddress}
            >
              <MapPin className="mr-2 size-4" />
              Choose a Different Address
            </Button>
          </div>
        )}

      {/* No Address Selected */}
      {!shippingAddress && (
        <div className="rounded-lg border border-muted bg-muted/30 p-6 text-center">
          <MapPin className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium text-foreground">
            Select a delivery address first
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            We need your delivery location to show available shipping options.
          </p>
          <Button variant="default" onClick={onEditAddress}>
            <MapPin className="mr-2 size-4" />
            Add Delivery Address
          </Button>
        </div>
      )}

      {/* Generic Error (when address exists but other errors) */}
      {!isLoading && error && !isOutOfZone && shippingAddress && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onEditAddress}
              >
                Edit Address
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Methods List */}
      {!isLoading && !error && methods.length > 0 && (
        <>
          {/* Zone info */}
          {zoneName && (
            <p className="text-sm text-muted-foreground">
              Delivering to: <span className="font-medium">{zoneName}</span>
            </p>
          )}

          {/* Show section headers when both types available */}
          <RadioGroup
            value={selectedMethodId || ""}
            onValueChange={handleMethodSelect}
          >
            <div className="space-y-4">
              {/* Local Delivery Section */}
              {fetchState.hasLocalDelivery && (
                <div className="space-y-2">
                  {fetchState.hasShipping && (
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Local Delivery</span>
                      <Badge variant="secondary" className="text-xs">
                        Fastest
                      </Badge>
                    </div>
                  )}
                  {methods
                    .filter((m) => m.type === "local_delivery")
                    .map((method) => (
                      <FulfillmentOption
                        key={method.id}
                        method={method}
                        isSelected={selectedMethodId === method.id}
                        currency={currency}
                        formatDeliveryEstimate={formatDeliveryEstimate}
                      />
                    ))}
                </div>
              )}

              {/* Shipping Section */}
              {fetchState.hasShipping && (
                <div className="space-y-2">
                  {fetchState.hasLocalDelivery && (
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pt-2 border-t">
                      <Truck className="h-4 w-4" />
                      <span>Shipping</span>
                    </div>
                  )}
                  {methods
                    .filter((m) => m.type === "shipping" || !m.type)
                    .map((method) => (
                      <FulfillmentOption
                        key={method.id}
                        method={method}
                        isSelected={selectedMethodId === method.id}
                        currency={currency}
                        formatDeliveryEstimate={formatDeliveryEstimate}
                      />
                    ))}
                </div>
              )}

              {/* Fallback: show all if no type info */}
              {!fetchState.hasLocalDelivery && !fetchState.hasShipping && (
                <div className="space-y-3">
                  {methods.map((method) => (
                    <FulfillmentOption
                      key={method.id}
                      method={method}
                      isSelected={selectedMethodId === method.id}
                      currency={currency}
                      formatDeliveryEstimate={formatDeliveryEstimate}
                    />
                  ))}
                </div>
              )}
            </div>
          </RadioGroup>

          {/* Continue Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleContinue}
              disabled={!selectedMethodId || isLoading}
              size="lg"
            >
              Continue to Payment
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Individual fulfillment option component
function FulfillmentOption({
  method,
  isSelected,
  currency: _currency,
  formatDeliveryEstimate,
}: {
  method: ShippingMethodOption;
  isSelected: boolean;
  currency: string;
  formatDeliveryEstimate: (min: number | null, max: number | null) => string;
}) {
  const { format: formatPrice } = useCurrencyStore();
  const deliveryEstimate = formatDeliveryEstimate(
    method.minDeliveryDays,
    method.maxDeliveryDays
  );

  return (
    <div>
      <RadioGroupItem
        value={method.id}
        id={`shipping-${method.id}`}
        className="peer sr-only"
      />
      <Label
        htmlFor={`shipping-${method.id}`}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors w-full min-w-0 max-w-full overflow-hidden",
          "hover:bg-muted/50",
          isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-muted"
        )}
      >
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{method.name}</p>
            <span className="shrink-0 font-semibold">
              {method.price === 0 ? (
                <span className="text-green-600">Free</span>
              ) : (
                formatPrice(method.price)
              )}
            </span>
          </div>
          {method.description &&
            method.description !== method.name &&
            method.description !== deliveryEstimate && (
              <p className="text-sm text-muted-foreground">
                {method.description}
              </p>
            )}
          {deliveryEstimate && (
            <p className="text-sm text-muted-foreground">
              Est. {deliveryEstimate}
            </p>
          )}
        </div>
      </Label>
    </div>
  );
}

// Summary component for collapsed state
export function ShippingSummary({
  selectedMethod,
  currency: _currency,
}: {
  selectedMethod: ShippingMethod | null;
  currency: string;
}) {
  const { format: formatPrice } = useCurrencyStore();
  if (!selectedMethod) return null;

  const formatDeliveryEstimate = (
    minDays: number | null,
    maxDays: number | null
  ): string => {
    if (minDays === null && maxDays === null) return "";
    if (minDays === maxDays && minDays !== null) {
      return `${minDays} ${minDays === 1 ? "day" : "days"}`;
    }
    if (minDays !== null && maxDays !== null) {
      return `${minDays}-${maxDays} days`;
    }
    return "";
  };

  const estimate = formatDeliveryEstimate(
    selectedMethod.minDeliveryDays,
    selectedMethod.maxDeliveryDays
  );

  return (
    <span>
      {selectedMethod.name} &bull;{" "}
      {selectedMethod.price === 0 ? (
        <span className="text-green-600">Free</span>
      ) : (
        formatPrice(selectedMethod.price)
      )}
      {estimate && ` (${estimate})`}
    </span>
  );
}
