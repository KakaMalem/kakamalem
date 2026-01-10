"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "@/lib/db/schema";

// =============================================================================
// TYPES
// =============================================================================

export type CheckoutStep = 1 | 2 | 3;

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

type CheckoutState = {
  // Step tracking
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

  // Step navigation
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

  // Notes
  setCustomerNotes: (notes: string) => void;

  // Totals
  updateTotals: (subtotal: number, shippingTotal?: number) => void;

  // Reset
  resetCheckout: () => void;
};

type CheckoutStore = CheckoutState & CheckoutActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: CheckoutState = {
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

      // Step navigation
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        tenantId: state.tenantId,
        storeSlug: state.storeSlug,
        customerInfo: state.customerInfo,
        shippingAddress: state.shippingAddress,
        billingAddress: state.billingAddress,
        useSameForBilling: state.useSameForBilling,
        selectedAddressId: state.selectedAddressId,
        selectedMethod: state.selectedMethod,
        customerNotes: state.customerNotes,
        subtotal: state.subtotal,
        shippingTotal: state.shippingTotal,
        total: state.total,
      }),
    }
  )
);

// =============================================================================
// SELECTOR HOOKS
// =============================================================================

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
