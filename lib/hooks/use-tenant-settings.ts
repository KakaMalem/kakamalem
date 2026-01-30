"use client";

import {
  useTenantSettings as useTenantSettingsFromStore,
  useStoreMode,
  useOnlineCheckoutEnabled,
  usePosEnabled,
  useReceiptSettings,
  useTenantCurrency,
  useTenantBranding,
  useIsSettingsHydrated,
  tenantSettingsActions,
} from "@/lib/stores/use-tenant-settings-store";
import {
  useUpdateStoreModeMutation,
  useTogglePosMutation,
  useToggleOnlineCheckoutMutation,
  useUpdateReceiptSettingsMutation,
  getCurrentSettingsForMutation,
} from "@/lib/hooks/use-tenant-mutations";
import type { StoreMode, ReceiptPaperWidth } from "@/lib/validations/stores";

// ============================================================================
// MAIN HOOK: useTenantSettings
// ============================================================================

/**
 * Primary hook for accessing and mutating tenant settings.
 *
 * Combines Zustand state (for instant reads) with TanStack Query mutations
 * (for optimistic updates with rollback).
 *
 * @example
 * ```tsx
 * function StoreSettings() {
 *   const {
 *     settings,
 *     storeMode,
 *     posEnabled,
 *     setStoreMode,
 *     togglePos,
 *     isUpdating,
 *   } = useTenantSettingsWithMutations();
 *
 *   return (
 *     <Switch
 *       checked={posEnabled}
 *       onCheckedChange={(enabled) => togglePos(enabled)}
 *       disabled={isUpdating}
 *     />
 *   );
 * }
 * ```
 */
export function useTenantSettingsWithMutations() {
  // Zustand state (instant access)
  const settings = useTenantSettingsFromStore();
  const storeMode = useStoreMode();
  const onlineCheckoutEnabled = useOnlineCheckoutEnabled();
  const posEnabled = usePosEnabled();
  const receiptSettings = useReceiptSettings();
  const currency = useTenantCurrency();
  const branding = useTenantBranding();
  const isHydrated = useIsSettingsHydrated();

  // TanStack Query mutations
  const updateStoreModeMutation = useUpdateStoreModeMutation();
  const togglePosMutation = useTogglePosMutation();
  const toggleOnlineCheckoutMutation = useToggleOnlineCheckoutMutation();
  const updateReceiptSettingsMutation = useUpdateReceiptSettingsMutation();

  // Combined updating state
  const isUpdating =
    updateStoreModeMutation.isPending ||
    togglePosMutation.isPending ||
    toggleOnlineCheckoutMutation.isPending ||
    updateReceiptSettingsMutation.isPending;

  // Convenience mutation functions
  const setStoreMode = (mode: StoreMode) => {
    if (!settings) return;
    const currentSettings = getCurrentSettingsForMutation(settings);
    if (!currentSettings) return;

    updateStoreModeMutation.mutate({
      storeId: settings.id,
      storeSlug: settings.slug,
      settings: { ...currentSettings, storeMode: mode },
    });
  };

  const togglePos = (enabled: boolean) => {
    if (!settings) return;
    const currentSettings = getCurrentSettingsForMutation(settings);
    if (!currentSettings) return;

    togglePosMutation.mutate({
      storeId: settings.id,
      storeSlug: settings.slug,
      enabled,
      currentSettings,
    });
  };

  const toggleOnlineCheckout = (enabled: boolean) => {
    if (!settings) return;
    const currentSettings = getCurrentSettingsForMutation(settings);
    if (!currentSettings) return;

    toggleOnlineCheckoutMutation.mutate({
      storeId: settings.id,
      storeSlug: settings.slug,
      enabled,
      currentSettings,
    });
  };

  const updateReceiptSettings = (newReceiptSettings: {
    receiptPaperWidth: ReceiptPaperWidth;
    receiptShowLogo: boolean;
    receiptShowContact: boolean;
    receiptFooterText?: string;
  }) => {
    if (!settings) return;
    const currentSettings = getCurrentSettingsForMutation(settings);
    if (!currentSettings) return;

    updateReceiptSettingsMutation.mutate({
      storeId: settings.id,
      storeSlug: settings.slug,
      receiptSettings: newReceiptSettings,
      currentSettings,
    });
  };

  return {
    // State (from Zustand - instant access)
    settings,
    storeMode,
    onlineCheckoutEnabled,
    posEnabled,
    receiptSettings,
    currency,
    branding,
    isHydrated,

    // Mutation functions (with optimistic updates)
    setStoreMode,
    togglePos,
    toggleOnlineCheckout,
    updateReceiptSettings,

    // Loading states
    isUpdating,
    isUpdatingStoreMode: updateStoreModeMutation.isPending,
    isUpdatingPos: togglePosMutation.isPending,
    isUpdatingOnlineCheckout: toggleOnlineCheckoutMutation.isPending,
    isUpdatingReceiptSettings: updateReceiptSettingsMutation.isPending,

    // Error states (if needed for UI)
    storeModeError: updateStoreModeMutation.error,
    posError: togglePosMutation.error,
    onlineCheckoutError: toggleOnlineCheckoutMutation.error,
    receiptSettingsError: updateReceiptSettingsMutation.error,

    // Direct access to mutations (for advanced use cases)
    mutations: {
      updateStoreMode: updateStoreModeMutation,
      togglePos: togglePosMutation,
      toggleOnlineCheckout: toggleOnlineCheckoutMutation,
      updateReceiptSettings: updateReceiptSettingsMutation,
    },

    // Actions for direct state manipulation (use sparingly)
    actions: tenantSettingsActions,
  };
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

// Re-export simple selector hooks for components that just need to read
export {
  useTenantSettingsFromStore as useTenantSettings,
  useStoreMode,
  useOnlineCheckoutEnabled,
  usePosEnabled,
  useReceiptSettings,
  useTenantCurrency,
  useTenantBranding,
  useIsSettingsHydrated,
};
