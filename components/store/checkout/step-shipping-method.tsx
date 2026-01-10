"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Truck, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { calculateShippingAction } from "@/lib/actions/checkout";

interface StepShippingMethodProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
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
  currency,
}: StepShippingMethodProps) {
  // storeSlug is passed for future use (e.g., revalidation)
  void _storeSlug;
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
    zoneName: string | null;
    methods: ShippingMethodOption[];
  }>({
    isLoading: !!shippingAddress, // Only loading if we have an address to fetch
    error: null,
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

      if (!result.data?.zone) {
        setFetchState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            "Sorry, we don't currently ship to this address. Please go back and try a different address.",
        }));
        return;
      }

      if (result.data.methods.length === 0) {
        setFetchState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            "No shipping methods available for your address. Please contact the store.",
        }));
        return;
      }

      setFetchState({
        isLoading: false,
        error: null,
        zoneName: result.data.zone.name,
        methods: result.data.methods,
      });

      // Auto-select first method if none selected
      if (!selectedMethodId && result.data.methods.length > 0) {
        const firstMethod = result.data.methods[0];
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

          {/* Error State */}
          {!isLoading && error && (
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
                              {method.description && (
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
                              formatPrice(method.price, currency)
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
