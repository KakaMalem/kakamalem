"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Address } from "@/lib/db/schema";
import type { CheckoutDeliveryZone } from "@/lib/actions/unified-delivery";
import type { Cart } from "@/lib/db/queries/carts";
import type { EnabledGateway } from "@/lib/payments/types";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useStoreBasePath } from "@/components/store/store-path-provider";
import { CheckoutAccordion } from "./accordion";
import { CheckoutSummary } from "./checkout-summary";
import { MobileOrderSummary } from "./mobile-order-summary";

interface CheckoutContainerProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
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
  deliveryZones: CheckoutDeliveryZone[];
  enabledPaymentMethods: EnabledGateway[];
  storeLocation?: { lat: number; lng: number } | null;
  showPromoCode?: boolean;
  checkoutAddressMode?: "gps" | "standard_form";
}

export function CheckoutContainer({
  tenantId,
  storeSlug,
  storeName,
  currency,
  cart,
  savedAddresses,
  user,
  userPhone,
  subtotal,
  deliveryZones,
  enabledPaymentMethods,
  storeLocation,
  showPromoCode = false,
  checkoutAddressMode = "gps",
}: CheckoutContainerProps) {
  const mounted = useMounted();
  const basePath = useStoreBasePath();

  const { shippingAddress, initCheckout, setShippingAddress } =
    useCheckoutStore();

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
            <div className="lg:col-span-2 space-y-4">
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
            </div>
            <div className="hidden lg:block h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`${basePath}/cart`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to cart</span>
        </Link>
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      {/* Mobile Order Summary */}
      <div className="lg:hidden mb-6">
        <MobileOrderSummary
          cart={cart}
          currency={currency}
          tenantId={tenantId}
        />
      </div>

      {/* Main Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Accordion Sections */}
        <div className="lg:col-span-2 min-w-0 w-full max-w-full">
          <CheckoutAccordion
            tenantId={tenantId}
            storeSlug={storeSlug}
            storeName={storeName}
            currency={currency}
            cart={cart}
            savedAddresses={savedAddresses}
            user={user}
            userPhone={userPhone}
            deliveryZones={deliveryZones}
            enabledPaymentMethods={enabledPaymentMethods}
            storeLocation={storeLocation}
            showPromoCode={showPromoCode}
            checkoutAddressMode={checkoutAddressMode}
          />
        </div>

        {/* Desktop Order Summary Sidebar */}
        <div className="hidden lg:block lg:col-span-1 min-w-0 max-w-full">
          <div className="sticky top-4">
            <CheckoutSummary
              cart={cart}
              currency={currency}
              tenantId={tenantId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
