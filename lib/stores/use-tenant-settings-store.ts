"use client";

import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import type { StoreMode, ReceiptPaperWidth } from "@/lib/validations/stores";
import type { TenantSettings } from "@/lib/types/tenant-settings";

// No-op storage for SSR
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// Re-export for convenience
export type { TenantSettings };

type TenantSettingsState = {
  // State
  settings: TenantSettings | null;
  isHydrated: boolean;
  lastUpdated: number | null;

  // Actions
  hydrate: (settings: TenantSettings) => void;
  reset: () => void;

  // Optimistic update helpers
  updateSettings: (partial: Partial<TenantSettings>) => TenantSettings | null;
  rollback: (previousSettings: TenantSettings) => void;

  // Individual setting updates (for optimistic mutations)
  setStoreMode: (mode: StoreMode) => TenantSettings | null;
  setOnlineCheckoutEnabled: (enabled: boolean) => TenantSettings | null;
  setPosEnabled: (enabled: boolean) => TenantSettings | null;
  setReceiptSettings: (settings: {
    receiptPaperWidth?: ReceiptPaperWidth;
    receiptShowLogo?: boolean;
    receiptShowContact?: boolean;
    receiptFooterText?: string | null;
  }) => TenantSettings | null;
};

// ============================================================================
// STORE
// ============================================================================

export const useTenantSettingsStore = create<TenantSettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: null,
      isHydrated: false,
      lastUpdated: null,

      // Hydrate from server data
      hydrate: (settings) => {
        set({
          settings,
          isHydrated: true,
          lastUpdated: Date.now(),
        });
      },

      // Reset store (on logout or tenant switch)
      reset: () => {
        set({
          settings: null,
          isHydrated: false,
          lastUpdated: null,
        });
      },

      // Generic update - returns previous state for rollback
      updateSettings: (partial) => {
        const previous = get().settings;
        if (!previous) return null;

        set({
          settings: { ...previous, ...partial },
          lastUpdated: Date.now(),
        });

        return previous;
      },

      // Rollback to previous state (on mutation failure)
      rollback: (previousSettings) => {
        set({
          settings: previousSettings,
          lastUpdated: Date.now(),
        });
      },

      // Store mode update
      setStoreMode: (mode) => {
        const previous = get().settings;
        if (!previous) return null;

        // Apply store mode presets (same logic as server)
        let updates: Partial<TenantSettings> = { storeMode: mode };

        switch (mode) {
          case "online_only":
            updates = {
              ...updates,
              posEnabled: false,
            };
            break;
          case "offline_only":
            updates = {
              ...updates,
              onlineCheckoutEnabled: false,
            };
            break;
          case "catalog":
            updates = {
              ...updates,
              onlineCheckoutEnabled: false,
              posEnabled: false,
            };
            break;
          // "full" mode respects all toggles
        }

        set({
          settings: { ...previous, ...updates },
          lastUpdated: Date.now(),
        });

        return previous;
      },

      // Individual toggle updates
      setOnlineCheckoutEnabled: (enabled) => {
        const previous = get().settings;
        if (!previous) return null;

        set({
          settings: { ...previous, onlineCheckoutEnabled: enabled },
          lastUpdated: Date.now(),
        });

        return previous;
      },

      setPosEnabled: (enabled) => {
        const previous = get().settings;
        if (!previous) return null;

        set({
          settings: { ...previous, posEnabled: enabled },
          lastUpdated: Date.now(),
        });

        return previous;
      },

      // Receipt settings update
      setReceiptSettings: (receiptSettings) => {
        const previous = get().settings;
        if (!previous) return null;

        set({
          settings: { ...previous, ...receiptSettings },
          lastUpdated: Date.now(),
        });

        return previous;
      },
    }),
    {
      name: "kaka-malem-tenant-settings",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        // Only persist these fields for offline support
        settings: state.settings,
        lastUpdated: state.lastUpdated,
      }),
      // Skip hydration on server
      skipHydration: true,
    }
  )
);

// ============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// ============================================================================

export function useTenantSettings() {
  return useTenantSettingsStore((state) => state.settings);
}

export function useStoreMode() {
  return useTenantSettingsStore((state) => state.settings?.storeMode ?? "full");
}

export function useOnlineCheckoutEnabled() {
  return useTenantSettingsStore(
    (state) => state.settings?.onlineCheckoutEnabled ?? true
  );
}

export function usePosEnabled() {
  return useTenantSettingsStore((state) => state.settings?.posEnabled ?? true);
}

export function useReceiptSettings() {
  return useTenantSettingsStore((state) => ({
    receiptPaperWidth: state.settings?.receiptPaperWidth ?? "80mm",
    receiptShowLogo: state.settings?.receiptShowLogo ?? true,
    receiptShowContact: state.settings?.receiptShowContact ?? true,
    receiptFooterText: state.settings?.receiptFooterText ?? null,
  }));
}

export function useTenantCurrency() {
  return useTenantSettingsStore((state) => state.settings?.currency ?? "AFN");
}

export function useTenantBranding() {
  return useTenantSettingsStore((state) => ({
    name: state.settings?.name ?? "",
    logoUrl: state.settings?.logoUrl ?? null,
    faviconUrl: state.settings?.faviconUrl ?? null,
    tagline: state.settings?.tagline ?? null,
  }));
}

export function useIsSettingsHydrated() {
  return useTenantSettingsStore((state) => state.isHydrated);
}

/**
 * Returns the public-facing store URL.
 * If the store has an active custom domain, returns https://customdomain.com
 * Otherwise returns the default /store/{slug} path (relative).
 */
export function useStoreUrl() {
  return useTenantSettingsStore((state) => {
    const s = state.settings;
    if (!s) return null;
    if (s.customDomain && s.customDomainStatus === "active") {
      return `https://${s.customDomain}`;
    }
    return `/store/${s.slug}`;
  });
}

// ============================================================================
// ACTIONS (stable references, no re-renders)
// ============================================================================

export const tenantSettingsActions = {
  hydrate: (settings: TenantSettings) =>
    useTenantSettingsStore.getState().hydrate(settings),
  reset: () => useTenantSettingsStore.getState().reset(),
  updateSettings: (partial: Partial<TenantSettings>) =>
    useTenantSettingsStore.getState().updateSettings(partial),
  rollback: (previousSettings: TenantSettings) =>
    useTenantSettingsStore.getState().rollback(previousSettings),
  setStoreMode: (mode: StoreMode) =>
    useTenantSettingsStore.getState().setStoreMode(mode),
  setOnlineCheckoutEnabled: (enabled: boolean) =>
    useTenantSettingsStore.getState().setOnlineCheckoutEnabled(enabled),
  setPosEnabled: (enabled: boolean) =>
    useTenantSettingsStore.getState().setPosEnabled(enabled),
  setReceiptSettings: (settings: {
    receiptPaperWidth?: ReceiptPaperWidth;
    receiptShowLogo?: boolean;
    receiptShowContact?: boolean;
    receiptFooterText?: string | null;
  }) => useTenantSettingsStore.getState().setReceiptSettings(settings),
};

// Hook version for components that need reactive updates
export function useTenantSettingsActions() {
  return tenantSettingsActions;
}
