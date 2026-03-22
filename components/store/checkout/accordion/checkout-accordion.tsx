"use client";

import { User, MapPin, Truck, CreditCard } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { SectionContact, ContactSummary } from "./section-contact";
import { SectionDelivery, DeliverySummary } from "./section-delivery";
import { SectionShipping, ShippingSummary } from "./section-shipping";
import { SectionPayment } from "./section-payment";
import {
  useCheckoutStore,
  useCheckoutSectionNavigation,
  type CheckoutSection,
} from "@/lib/stores/use-checkout-store";
import type { Cart } from "@/lib/db/queries/carts";
import type { CheckoutDeliveryZone } from "@/lib/actions/unified-delivery";
import type { EnabledGateway } from "@/lib/payments/types";

interface SavedAddress {
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
}

interface CheckoutAccordionProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  cart: Cart;
  savedAddresses: SavedAddress[];
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  userPhone: string;
  deliveryZones: CheckoutDeliveryZone[];
  enabledPaymentMethods: EnabledGateway[];
  storeLocation?: { lat: number; lng: number } | null;
  showPromoCode?: boolean;
  checkoutAddressMode?: "gps" | "standard_form";
}

export function CheckoutAccordion({
  tenantId,
  storeSlug,
  storeName,
  currency,
  cart,
  savedAddresses,
  user,
  userPhone,
  deliveryZones,
  enabledPaymentMethods,
  storeLocation,
  showPromoCode = false,
  checkoutAddressMode = "gps",
}: CheckoutAccordionProps) {
  const {
    expandedSection,
    setExpandedSection,
    completeSection,
    uncompleteSection,
    getSectionStatus,
  } = useCheckoutSectionNavigation();

  const { customerInfo, shippingAddress, selectedMethod } = useCheckoutStore();

  // Handle section completion and auto-advance
  const handleSectionComplete = (
    currentSection: CheckoutSection,
    nextSection: CheckoutSection
  ) => {
    completeSection(currentSection);
    setExpandedSection(nextSection);
  };

  // Handle editing a completed section
  const handleEditSection = (section: CheckoutSection) => {
    // When editing a section, uncomplete it and all following sections
    uncompleteSection(section);
    setExpandedSection(section);
  };

  // Toggle section expansion
  const handleToggleSection = (section: CheckoutSection) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Contact */}
      <SectionWrapper
        section="contact"
        stepNumber={1}
        title="Contact Information"
        icon={User}
        status={getSectionStatus("contact")}
        isExpanded={expandedSection === "contact"}
        onToggle={() => handleToggleSection("contact")}
        onEdit={() => handleEditSection("contact")}
        summary={<ContactSummary user={user} customerInfo={customerInfo} />}
      >
        <SectionContact
          user={user}
          userPhone={userPhone}
          tenantId={tenantId}
          storeName={storeName}
          onContinue={() => handleSectionComplete("contact", "delivery")}
        />
      </SectionWrapper>

      {/* Section 2: Delivery Address */}
      <SectionWrapper
        section="delivery"
        stepNumber={2}
        title={
          checkoutAddressMode === "standard_form"
            ? "Shipping Address"
            : "Delivery Address"
        }
        icon={MapPin}
        status={getSectionStatus("delivery")}
        isExpanded={expandedSection === "delivery"}
        onToggle={() => handleToggleSection("delivery")}
        onEdit={() => handleEditSection("delivery")}
        summary={
          <DeliverySummary
            shippingAddress={shippingAddress}
            checkoutAddressMode={checkoutAddressMode}
          />
        }
      >
        <SectionDelivery
          user={user}
          userPhone={userPhone}
          savedAddresses={savedAddresses}
          deliveryZones={deliveryZones}
          storeLocation={storeLocation}
          onContinue={() => handleSectionComplete("delivery", "shipping")}
          checkoutAddressMode={checkoutAddressMode}
        />
      </SectionWrapper>

      {/* Section 3: Shipping Method */}
      <SectionWrapper
        section="shipping"
        stepNumber={3}
        title="Shipping Method"
        icon={Truck}
        status={getSectionStatus("shipping")}
        isExpanded={expandedSection === "shipping"}
        onToggle={() => handleToggleSection("shipping")}
        onEdit={() => handleEditSection("shipping")}
        summary={
          <ShippingSummary
            selectedMethod={selectedMethod}
            currency={currency}
          />
        }
      >
        <SectionShipping
          tenantId={tenantId}
          currency={currency}
          deliveryZones={deliveryZones}
          onContinue={() => handleSectionComplete("shipping", "payment")}
          onEditAddress={() => handleEditSection("delivery")}
        />
      </SectionWrapper>

      {/* Section 4: Payment */}
      <SectionWrapper
        section="payment"
        stepNumber={4}
        title="Payment"
        icon={CreditCard}
        status={getSectionStatus("payment")}
        isExpanded={expandedSection === "payment"}
        onToggle={() => handleToggleSection("payment")}
        onEdit={() => setExpandedSection("payment")}
      >
        <SectionPayment
          tenantId={tenantId}
          storeSlug={storeSlug}
          currency={currency}
          cart={cart}
          user={user}
          enabledPaymentMethods={enabledPaymentMethods}
          showPromoCode={showPromoCode}
          onEditDelivery={() => handleEditSection("delivery")}
          onEditShipping={() => handleEditSection("shipping")}
        />
      </SectionWrapper>
    </div>
  );
}
