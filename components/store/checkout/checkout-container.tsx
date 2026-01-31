"use client";

import { useEffect } from "react";
import type { Address, DeliveryZone } from "@/lib/db/schema";
import type { Cart } from "@/lib/db/queries/carts";
import type { EnabledGateway } from "@/lib/payments/types";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { useMounted } from "@/lib/hooks/use-mounted";
import { CheckoutSteps } from "./checkout-steps";
import { CheckoutSummary } from "./checkout-summary";
import { StepContactShipping } from "./step-contact-shipping";
import { StepShippingMethod } from "./step-shipping-method";
import { StepReview } from "./step-review";

interface CheckoutContainerProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  cart: Cart;
  savedAddresses: Array<{
    id: string;
    label: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    latitude: string;
    longitude: string;
    h3Index: string | null;
    plusCode: string | null;
    city: string | null;
    accuracy: string | null;
    source: string | null;
    notes: string | null;
    isDefault: boolean;
  }>;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  userPhone: string;
  subtotal: number;
  deliveryZones: DeliveryZone[];
  enabledPaymentMethods: EnabledGateway[];
}

export function CheckoutContainer({
  tenantId,
  storeSlug,
  currency,
  cart,
  savedAddresses,
  user,
  userPhone,
  subtotal,
  deliveryZones,
  enabledPaymentMethods,
}: CheckoutContainerProps) {
  const mounted = useMounted();

  const {
    currentStep,
    shippingAddress,
    selectedMethod,
    initCheckout,
    setStep,
    setShippingAddress,
  } = useCheckoutStore();

  // Initialize checkout on mount
  useEffect(() => {
    initCheckout(tenantId, storeSlug, subtotal);
  }, [tenantId, storeSlug, subtotal, initCheckout]);

  // Set default address if user has one and no address selected yet
  useEffect(() => {
    if (mounted && !shippingAddress && savedAddresses.length > 0) {
      const defaultAddress =
        savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      if (defaultAddress) {
        const address: Address = {
          firstName: defaultAddress.firstName,
          lastName: defaultAddress.lastName,
          phone: defaultAddress.phone || "",
          latitude: parseFloat(defaultAddress.latitude),
          longitude: parseFloat(defaultAddress.longitude),
          h3Index: defaultAddress.h3Index || undefined,
          plusCode: defaultAddress.plusCode || undefined,
          accuracy: defaultAddress.accuracy
            ? parseFloat(defaultAddress.accuracy)
            : undefined,
          source: (defaultAddress.source as "gps" | "manual") || undefined,
          notes: defaultAddress.notes || undefined,
        };
        setShippingAddress(address);
      }
    }
  }, [mounted, shippingAddress, savedAddresses, setShippingAddress]);

  // Prevent hydration issues
  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-8" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-muted rounded" />
            </div>
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const handleStepClick = (step: 1 | 2 | 3) => {
    // Allow going back to previous steps
    if (step < currentStep) {
      setStep(step);
    }
    // Allow going forward only if previous steps completed
    else if (step === 2 && shippingAddress) {
      setStep(step);
    } else if (step === 3 && shippingAddress && selectedMethod) {
      setStep(step);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      {/* Step Indicator */}
      <CheckoutSteps
        currentStep={currentStep}
        onStepClick={handleStepClick}
        completedSteps={{
          1: !!shippingAddress,
          2: !!selectedMethod,
          3: false,
        }}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {currentStep === 1 && (
            <StepContactShipping
              user={user}
              userPhone={userPhone}
              savedAddresses={savedAddresses}
              tenantId={tenantId}
              storeSlug={storeSlug}
              deliveryZones={deliveryZones}
            />
          )}
          {currentStep === 2 && (
            <StepShippingMethod
              tenantId={tenantId}
              storeSlug={storeSlug}
              currency={currency}
              deliveryZones={deliveryZones}
            />
          )}
          {currentStep === 3 && (
            <StepReview
              tenantId={tenantId}
              storeSlug={storeSlug}
              currency={currency}
              cart={cart}
              user={user}
              enabledPaymentMethods={enabledPaymentMethods}
            />
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <CheckoutSummary cart={cart} currency={currency} />
        </div>
      </div>
    </div>
  );
}
