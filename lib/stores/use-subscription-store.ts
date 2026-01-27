"use client";

import { create } from "zustand";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";

// =============================================================================
// SUBSCRIPTION STORE
// =============================================================================
// Stores the current store's subscription data for client-side access
// Hydrated from server on each store layout render
// No persistence needed - refreshes on page load
// =============================================================================

type SubscriptionState = {
  // State
  subscription: SubscriptionOverview | null;
  tenantId: string | null;
  isHydrated: boolean;

  // Actions
  hydrate: (tenantId: string, subscription: SubscriptionOverview) => void;
  reset: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>()((set) => ({
  // Initial state
  subscription: null,
  tenantId: null,
  isHydrated: false,

  // Hydrate from server data
  hydrate: (tenantId, subscription) => {
    set({
      tenantId,
      subscription,
      isHydrated: true,
    });
  },

  // Reset store (on logout or tenant switch)
  reset: () => {
    set({
      subscription: null,
      tenantId: null,
      isHydrated: false,
    });
  },
}));

// =============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// =============================================================================

export function useSubscription() {
  return useSubscriptionStore((state) => state.subscription);
}

export function useIsPro() {
  return useSubscriptionStore((state) => state.subscription?.plan === "pro");
}

export function useIsTrialing() {
  return useSubscriptionStore(
    (state) => state.subscription?.status === "trialing"
  );
}

export function useProductLimit() {
  return useSubscriptionStore((state) => state.subscription?.productLimit);
}

export function useProductCount() {
  return useSubscriptionStore((state) => state.subscription?.productCount ?? 0);
}

export function useDaysRemainingInTrial() {
  return useSubscriptionStore(
    (state) => state.subscription?.daysRemainingInTrial
  );
}

export function useIsSubscriptionHydrated() {
  return useSubscriptionStore((state) => state.isHydrated);
}

export function useSubscriptionTenantId() {
  return useSubscriptionStore((state) => state.tenantId);
}

// =============================================================================
// ACTIONS (stable references, no re-renders)
// =============================================================================

export const subscriptionActions = {
  hydrate: (tenantId: string, subscription: SubscriptionOverview) =>
    useSubscriptionStore.getState().hydrate(tenantId, subscription),
  reset: () => useSubscriptionStore.getState().reset(),
};
