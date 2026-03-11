"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Truck,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { calculateShippingAction } from "@/lib/actions/checkout";
import { OutOfZoneMap } from "./out-of-zone-map";
import type { CheckoutDeliveryZone } from "@/lib/actions/unified-delivery";

interface StepShippingMethodProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  deliveryZones: CheckoutDeliveryZone[];
}

type ShippingMethodOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
};

export function StepShippingMethod({
  tenantId,
  storeSlug: _storeSlug,
  currency: _currency,
  deliveryZones,
}: StepShippingMethodProps) {
  // storeSlug is passed for future use (e.g., revalidation)
  void _storeSlug;
  const { format: formatPrice } = useCurrencyStore();
  const {
    shippingAddress,
    subtotal,
    selectedMethod,
    setShippingMethod,
    setStep,
    completeStep,
  } = useCheckoutStore();

  const [fetchState, setFetchState] = useState<{
    isLoading: boolean;
    error: string | null;
    isOutOfZone: boolean;
    zoneName: string | null;
    methods: ShippingMethodOption[];
  }>({
    isLoading: !!shippingAddress, // Only loading if we have an address to fetch
    error: null,
    isOutOfZone: false,
    zoneName: null,
    methods: [],
  });
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    selectedMethod?.id || null
  );

  // Derive error - no address case is handled without effect setState
  const error = !shippingAddress
    ? "No shipping address selected"
    : fetchState.error;
  const isLoading = shippingAddress ? fetchState.isLoading : false;
  const isOutOfZone = fetchState.isOutOfZone;
  const zoneName = fetchState.zoneName;
  const methods = fetchState.methods;

  // Fetch shipping methods when address is available
  useEffect(() => {
    if (!shippingAddress) {
      return;
    }

    // Capture the address value for the async function
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

      // Check if delivery zones are enabled and address is outside all zones
      if (
        result.data?.deliveryZonesEnabled &&
        result.data.methods.length === 0
      ) {
        setFetchState((prev) => ({
          ...prev,
          isLoading: false,
          isOutOfZone: true,
          error:
            "Your selected address is outside our delivery areas. Please choose a different address within the highlighted zones.",
        }));
        return;
      }

      // If zones are disabled and no shipping methods configured, offer free shipping
      if (
        !result.data?.deliveryZonesEnabled &&
        result.data?.methods.length === 0
      ) {
        setFetchState({
          isLoading: false,
          error: null,
          isOutOfZone: false,
          zoneName: null,
          methods: [
            {
              id: "free-shipping",
              name: "Free Shipping",
              description: "Standard delivery",
              price: 0,
              minDeliveryDays: null,
              maxDeliveryDays: null,
            },
          ],
        });

        // Auto-select free shipping
        if (!selectedMethodId) {
          setSelectedMethodId("free-shipping");
          setShippingMethod({
            id: "free-shipping",
            name: "Free Shipping",
            description: "Standard delivery",
            price: 0,
            minDeliveryDays: null,
            maxDeliveryDays: null,
          });
        }
        return;
      }

      const methods = result.data?.methods || [];
      setFetchState({
        isLoading: false,
        error: null,
        isOutOfZone: false,
        zoneName: result.data?.zone?.name || null,
        methods,
      });

      // Auto-select first method if none selected
      if (!selectedMethodId && methods.length > 0) {
        const firstMethod = methods[0];
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

  // Handle method selection
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

  // Navigate to previous step
  const handleBack = () => {
    setStep(1);
  };

  // Navigate to next step
  const handleContinue = () => {
    if (selectedMethodId && selectedMethod) {
      completeStep(2);
      setStep(3);
    }
  };

  // Format delivery estimate
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="size-5" />
            Shipping Method
          </CardTitle>
        </CardHeader>
        <CardContent>
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

          {/* Error State - Out of Zone with Map */}
          {!isLoading && error && isOutOfZone && shippingAddress && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Outside Delivery Area
                    </p>
                    <p className="mt-1 text-sm text-destructive/80">
                      Your selected address is outside our delivery zones. The
                      map below shows our delivery areas - please choose an
                      address within the highlighted zones.
                    </p>
                  </div>
                </div>
              </div>

              {/* Show map with zones and user's address */}
              {deliveryZones.length > 0 && (
                <OutOfZoneMap
                  userAddress={{
                    latitude: shippingAddress.latitude,
                    longitude: shippingAddress.longitude,
                  }}
                  deliveryZones={deliveryZones}
                />
              )}

              <Button variant="default" className="w-full" onClick={handleBack}>
                <MapPin className="mr-2 size-4" />
                Choose a Different Address
              </Button>
            </div>
          )}

          {/* Error State - Generic Error */}
          {!isLoading && error && !isOutOfZone && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 text-destructive" />
                <div>
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleBack}
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
              {zoneName && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Shipping to: {zoneName}
                </p>
              )}

              <RadioGroup
                value={selectedMethodId || ""}
                onValueChange={handleMethodSelect}
              >
                <div className="space-y-3">
                  {methods.map((method) => {
                    const deliveryEstimate = formatDeliveryEstimate(
                      method.minDeliveryDays,
                      method.maxDeliveryDays
                    );

                    return (
                      <div key={method.id}>
                        <RadioGroupItem
                          value={method.id}
                          id={method.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={method.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 transition-colors",
                            "hover:bg-muted/50",
                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                selectedMethodId === method.id
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              )}
                            >
                              {selectedMethodId === method.id && (
                                <div className="size-2 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{method.name}</p>
                              {method.description &&
                                method.description !== method.name &&
                                method.description !==
                                  `Estimated delivery: ${deliveryEstimate}` && (
                                  <p className="text-sm text-muted-foreground">
                                    {method.description}
                                  </p>
                                )}
                              {deliveryEstimate && (
                                <p className="text-sm text-muted-foreground">
                                  Estimated delivery: {deliveryEstimate}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 font-semibold">
                            {method.price === 0 ? (
                              <span className="text-green-600">Free</span>
                            ) : (
                              formatPrice(method.price)
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedMethodId || isLoading || !!error}
          size="lg"
        >
          Continue to Review
          <ChevronRight className="ml-2 size-4" />
        </Button>
      </div>
    </div>
  );
}
