"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "@/lib/db/schema";

// =============================================================================
// TYPES
// =============================================================================

// Legacy step type (kept for migration)
export type CheckoutStep = 1 | 2 | 3;

// New section-based navigation
export type CheckoutSection = "contact" | "delivery" | "shipping" | "payment";

export type SectionStatus = "locked" | "active" | "completed";

export type CustomerInfo = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string; // Required for delivery coordination
};

export type ShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
};

export type PaymentMethod = {
  gateway: "hesabpay" | "stripe" | "cod" | "bank_transfer" | "mobile_money";
  displayName: string;
  description?: string;
};

type CheckoutState = {
  // Section-based navigation (accordion)
  expandedSection: CheckoutSection | null;
  completedSections: CheckoutSection[];

  // Legacy step tracking (for backward compatibility during migration)
  currentStep: CheckoutStep;
  completedSteps: CheckoutStep[];

  // Store context
  tenantId: string | null;
  storeSlug: string | null;

  // Customer info (for guest checkout)
  customerInfo: CustomerInfo | null;

  // Addresses
  shippingAddress: Address | null;
  billingAddress: Address | null;
  useSameForBilling: boolean;

  // Saved address selection (for logged-in users)
  selectedAddressId: string | null;

  // Shipping method
  selectedMethod: ShippingMethod | null;

  // Payment method
  selectedPaymentMethod: PaymentMethod | null;

  // Notes
  customerNotes: string;

  // Totals (calculated from cart + shipping)
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
};

type CheckoutActions = {
  // Initialization
  initCheckout: (tenantId: string, storeSlug: string, subtotal: number) => void;

  // Section navigation (new accordion-based)
  setExpandedSection: (section: CheckoutSection | null) => void;
  completeSection: (section: CheckoutSection) => void;
  uncompleteSection: (section: CheckoutSection) => void;
  canExpandSection: (section: CheckoutSection) => boolean;
  getSectionStatus: (section: CheckoutSection) => SectionStatus;

  // Legacy step navigation (kept for backward compatibility)
  setStep: (step: CheckoutStep) => void;
  completeStep: (step: CheckoutStep) => void;
  canProceedToStep: (step: CheckoutStep) => boolean;

  // Customer info
  setCustomerInfo: (info: CustomerInfo) => void;

  // Address management
  setShippingAddress: (address: Address) => void;
  setBillingAddress: (address: Address | null) => void;
  setUseSameForBilling: (same: boolean) => void;
  setSelectedAddressId: (addressId: string | null) => void;

  // Shipping method
  setShippingMethod: (method: ShippingMethod) => void;

  // Payment method
  setPaymentMethod: (method: PaymentMethod) => void;

  // Notes
  setCustomerNotes: (notes: string) => void;

  // Totals
  updateTotals: (subtotal: number, shippingTotal?: number) => void;

  // Reset
  resetCheckout: () => void;
};

type CheckoutStore = CheckoutState & CheckoutActions;

// =============================================================================
// CONSTANTS
// =============================================================================

const STORE_VERSION = 2;

// Section order for validation
const SECTION_ORDER: CheckoutSection[] = [
  "contact",
  "delivery",
  "shipping",
  "payment",
];

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: CheckoutState = {
  // New section-based state
  expandedSection: "contact",
  completedSections: [],

  // Legacy (kept for migration)
  currentStep: 1,
  completedSteps: [],

  tenantId: null,
  storeSlug: null,
  customerInfo: null,
  shippingAddress: null,
  billingAddress: null,
  useSameForBilling: true,
  selectedAddressId: null,
  selectedMethod: null,
  selectedPaymentMethod: null,
  customerNotes: "",
  subtotal: 0,
  shippingTotal: 0,
  taxTotal: 0,
  total: 0,
};

// =============================================================================
// STORE
// =============================================================================

export const useCheckoutStore = create<CheckoutStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Initialization
      initCheckout: (tenantId, storeSlug, subtotal) => {
        const state = get();
        // Only reset if different store
        if (state.tenantId !== tenantId) {
          set({
            ...initialState,
            tenantId,
            storeSlug,
            subtotal,
            total: subtotal,
          });
        } else {
          // Same store, just update subtotal
          set({
            subtotal,
            total: subtotal + state.shippingTotal,
          });
        }
      },

      // ==========================================================================
      // SECTION NAVIGATION (new accordion-based)
      // ==========================================================================

      setExpandedSection: (section) => {
        set({ expandedSection: section });
      },

      completeSection: (section) => {
        const { completedSections } = get();
        if (!completedSections.includes(section)) {
          set({ completedSections: [...completedSections, section] });
        }
      },

      uncompleteSection: (section) => {
        const { completedSections } = get();
        // Remove this section and all sections after it
        const sectionIndex = SECTION_ORDER.indexOf(section);
        const newCompletedSections = completedSections.filter((s) => {
          const index = SECTION_ORDER.indexOf(s);
          return index < sectionIndex;
        });
        set({ completedSections: newCompletedSections });
      },

      canExpandSection: (section) => {
        const { completedSections } = get();

        // Contact is always accessible
        if (section === "contact") return true;

        // For other sections, check if the previous section is completed
        const sectionIndex = SECTION_ORDER.indexOf(section);
        if (sectionIndex <= 0) return true;

        const previousSection = SECTION_ORDER[sectionIndex - 1];
        return completedSections.includes(previousSection);
      },

      getSectionStatus: (section) => {
        const { expandedSection, completedSections } = get();

        // Check if this section is currently expanded
        if (expandedSection === section) {
          return "active";
        }

        // Check if completed
        if (completedSections.includes(section)) {
          return "completed";
        }

        // Check if locked (previous section not completed)
        const sectionIndex = SECTION_ORDER.indexOf(section);
        if (sectionIndex > 0) {
          const previousSection = SECTION_ORDER[sectionIndex - 1];
          if (!completedSections.includes(previousSection)) {
            return "locked";
          }
        }

        // Default to locked if not first section
        return section === "contact" ? "active" : "locked";
      },

      // ==========================================================================
      // LEGACY STEP NAVIGATION (kept for backward compatibility)
      // ==========================================================================

      setStep: (step) => {
        set({ currentStep: step });
      },

      completeStep: (step) => {
        const { completedSteps } = get();
        if (!completedSteps.includes(step)) {
          set({ completedSteps: [...completedSteps, step] });
        }
      },

      canProceedToStep: (step) => {
        const state = get();

        if (step === 1) return true;

        if (step === 2) {
          // Need shipping address to proceed
          return !!state.shippingAddress;
        }

        if (step === 3) {
          // Need shipping method selected
          return !!state.shippingAddress && !!state.selectedMethod;
        }

        return false;
      },

      // ==========================================================================
      // DATA MANAGEMENT
      // ==========================================================================

      // Customer info
      setCustomerInfo: (info) => {
        set({ customerInfo: info });
      },

      // Address management
      setShippingAddress: (address) => {
        set({ shippingAddress: address });
      },

      setBillingAddress: (address) => {
        set({ billingAddress: address });
      },

      setUseSameForBilling: (same) => {
        set({
          useSameForBilling: same,
          billingAddress: same ? null : get().billingAddress,
        });
      },

      setSelectedAddressId: (addressId) => {
        set({ selectedAddressId: addressId });
      },

      // Shipping method
      setShippingMethod: (method) => {
        const { subtotal, taxTotal } = get();
        set({
          selectedMethod: method,
          shippingTotal: method.price,
          total: subtotal + method.price + taxTotal,
        });
      },

      // Payment method
      setPaymentMethod: (method) => {
        set({ selectedPaymentMethod: method });
      },

      // Notes
      setCustomerNotes: (notes) => {
        set({ customerNotes: notes });
      },

      // Totals
      updateTotals: (subtotal, shippingTotal) => {
        const state = get();
        const shipping = shippingTotal ?? state.shippingTotal;
        set({
          subtotal,
          shippingTotal: shipping,
          total: subtotal + shipping + state.taxTotal,
        });
      },

      // Reset
      resetCheckout: () => {
        set(initialState);
      },
    }),
    {
      name: "kaka-malem-checkout",
      version: STORE_VERSION,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // New section-based state
        expandedSection: state.expandedSection,
        completedSections: state.completedSections,
        // Legacy (for migration)
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        // Data
        tenantId: state.tenantId,
        storeSlug: state.storeSlug,
        customerInfo: state.customerInfo,
        shippingAddress: state.shippingAddress,
        billingAddress: state.billingAddress,
        useSameForBilling: state.useSameForBilling,
        selectedAddressId: state.selectedAddressId,
        selectedMethod: state.selectedMethod,
        selectedPaymentMethod: state.selectedPaymentMethod,
        customerNotes: state.customerNotes,
        subtotal: state.subtotal,
        shippingTotal: state.shippingTotal,
        total: state.total,
      }),
      migrate: (persistedState, version) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any;

        if (version < 2) {
          // Migrate from step-based to section-based
          const stepToSection: Record<number, CheckoutSection> = {
            1: "contact",
            2: "shipping",
            3: "payment",
          };

          // Map old completed steps to new sections
          // Note: Old step 1 combined contact+delivery, so we mark both as complete
          const completedSections: CheckoutSection[] = [];
          if (state.completedSteps?.includes(1)) {
            completedSections.push("contact", "delivery");
          }
          if (state.completedSteps?.includes(2)) {
            completedSections.push("shipping");
          }

          return {
            ...state,
            expandedSection:
              stepToSection[state.currentStep as number] || "contact",
            completedSections,
          };
        }

        return state as CheckoutState;
      },
    }
  )
);

// =============================================================================
// SELECTOR HOOKS
// =============================================================================

// Section-based selectors (new)
export function useExpandedSection() {
  return useCheckoutStore((state) => state.expandedSection);
}

export function useCompletedSections() {
  return useCheckoutStore((state) => state.completedSections);
}

export function useSectionStatus(section: CheckoutSection): SectionStatus {
  return useCheckoutStore((state) => state.getSectionStatus(section));
}

export function useCheckoutSectionNavigation() {
  return useCheckoutStore(
    useShallow((state) => ({
      expandedSection: state.expandedSection,
      completedSections: state.completedSections,
      setExpandedSection: state.setExpandedSection,
      completeSection: state.completeSection,
      uncompleteSection: state.uncompleteSection,
      canExpandSection: state.canExpandSection,
      getSectionStatus: state.getSectionStatus,
    }))
  );
}

// Legacy step selector (kept for backward compatibility)
export function useCheckoutStep() {
  return useCheckoutStore((state) => state.currentStep);
}

export function useCheckoutTotals() {
  return useCheckoutStore(
    useShallow((state) => ({
      subtotal: state.subtotal,
      shippingTotal: state.shippingTotal,
      taxTotal: state.taxTotal,
      total: state.total,
    }))
  );
}

export function useShippingAddress() {
  return useCheckoutStore((state) => state.shippingAddress);
}

export function useSelectedShippingMethod() {
  return useCheckoutStore((state) => state.selectedMethod);
}

export function useSelectedPaymentMethod() {
  return useCheckoutStore((state) => state.selectedPaymentMethod);
}

export function useCustomerInfo() {
  return useCheckoutStore((state) => state.customerInfo);
}
