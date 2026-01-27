"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  tenantSettingsActions,
  type TenantSettings,
} from "@/lib/stores/use-tenant-settings-store";
import { updateStoreModeSettings } from "@/lib/actions/stores";
import type { StoreModeSettingsInput } from "@/lib/validations/stores";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const tenantKeys = {
  all: ["tenant"] as const,
  settings: (tenantId: string) =>
    [...tenantKeys.all, "settings", tenantId] as const,
};

// ============================================================================
// MUTATION: Update Store Mode Settings
// ============================================================================

type UpdateStoreModeVariables = {
  storeId: string;
  storeSlug: string;
  settings: StoreModeSettingsInput;
};

export function useUpdateStoreModeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      storeSlug,
      settings,
    }: UpdateStoreModeVariables) => {
      const result = await updateStoreModeSettings(
        storeId,
        storeSlug,
        settings
      );

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },

    // Optimistic update
    onMutate: async ({ settings }) => {
      // Save previous state for rollback
      const previousSettings = tenantSettingsActions.updateSettings({
        storeMode: settings.storeMode,
        onlineCheckoutEnabled: settings.onlineCheckoutEnabled,
        posEnabled: settings.posEnabled,
        phoneOrdersEnabled: settings.phoneOrdersEnabled,
        receiptPaperWidth: settings.receiptPaperWidth,
        receiptShowLogo: settings.receiptShowLogo,
        receiptShowContact: settings.receiptShowContact,
        receiptFooterText: settings.receiptFooterText ?? null,
      });

      return { previousSettings };
    },

    // On success - no need to do anything, optimistic update already applied
    onSuccess: () => {
      toast.success("Store settings updated");
    },

    // Rollback on error
    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        tenantSettingsActions.rollback(context.previousSettings);
      }
      toast.error(error.message || "Failed to update settings");
    },

    // Always refetch after error or success to ensure consistency
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKeys.settings(variables.storeId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Toggle Phone Orders
// ============================================================================

type TogglePhoneOrdersVariables = {
  storeId: string;
  storeSlug: string;
  enabled: boolean;
  currentSettings: StoreModeSettingsInput;
};

export function useTogglePhoneOrdersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      storeSlug,
      enabled,
      currentSettings,
    }: TogglePhoneOrdersVariables) => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        ...currentSettings,
        phoneOrdersEnabled: enabled,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },

    // Optimistic update
    onMutate: async ({ enabled }) => {
      const previousSettings =
        tenantSettingsActions.setPhoneOrdersEnabled(enabled);
      return { previousSettings };
    },

    onSuccess: (_data, { enabled }) => {
      toast.success(`Phone orders ${enabled ? "enabled" : "disabled"}`);
    },

    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        tenantSettingsActions.rollback(context.previousSettings);
      }
      toast.error(error.message || "Failed to update phone orders setting");
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKeys.settings(variables.storeId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Toggle POS
// ============================================================================

type TogglePosVariables = {
  storeId: string;
  storeSlug: string;
  enabled: boolean;
  currentSettings: StoreModeSettingsInput;
};

export function useTogglePosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      storeSlug,
      enabled,
      currentSettings,
    }: TogglePosVariables) => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        ...currentSettings,
        posEnabled: enabled,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },

    onMutate: async ({ enabled }) => {
      const previousSettings = tenantSettingsActions.setPosEnabled(enabled);
      return { previousSettings };
    },

    onSuccess: (_data, { enabled }) => {
      toast.success(`POS ${enabled ? "enabled" : "disabled"}`);
    },

    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        tenantSettingsActions.rollback(context.previousSettings);
      }
      toast.error(error.message || "Failed to update POS setting");
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKeys.settings(variables.storeId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Toggle Online Checkout
// ============================================================================

type ToggleOnlineCheckoutVariables = {
  storeId: string;
  storeSlug: string;
  enabled: boolean;
  currentSettings: StoreModeSettingsInput;
};

export function useToggleOnlineCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      storeSlug,
      enabled,
      currentSettings,
    }: ToggleOnlineCheckoutVariables) => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        ...currentSettings,
        onlineCheckoutEnabled: enabled,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },

    onMutate: async ({ enabled }) => {
      const previousSettings =
        tenantSettingsActions.setOnlineCheckoutEnabled(enabled);
      return { previousSettings };
    },

    onSuccess: (_data, { enabled }) => {
      toast.success(`Online checkout ${enabled ? "enabled" : "disabled"}`);
    },

    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        tenantSettingsActions.rollback(context.previousSettings);
      }
      toast.error(error.message || "Failed to update online checkout setting");
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKeys.settings(variables.storeId),
      });
    },
  });
}

// ============================================================================
// MUTATION: Update Receipt Settings
// ============================================================================

type UpdateReceiptSettingsVariables = {
  storeId: string;
  storeSlug: string;
  receiptSettings: {
    receiptPaperWidth: "80mm" | "58mm";
    receiptShowLogo: boolean;
    receiptShowContact: boolean;
    receiptFooterText?: string;
  };
  currentSettings: StoreModeSettingsInput;
};

export function useUpdateReceiptSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      storeSlug,
      receiptSettings,
      currentSettings,
    }: UpdateReceiptSettingsVariables) => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        ...currentSettings,
        ...receiptSettings,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },

    onMutate: async ({ receiptSettings }) => {
      const previousSettings = tenantSettingsActions.setReceiptSettings({
        receiptPaperWidth: receiptSettings.receiptPaperWidth,
        receiptShowLogo: receiptSettings.receiptShowLogo,
        receiptShowContact: receiptSettings.receiptShowContact,
        receiptFooterText: receiptSettings.receiptFooterText ?? null,
      });
      return { previousSettings };
    },

    onSuccess: () => {
      toast.success("Receipt settings updated");
    },

    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        tenantSettingsActions.rollback(context.previousSettings);
      }
      toast.error(error.message || "Failed to update receipt settings");
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: tenantKeys.settings(variables.storeId),
      });
    },
  });
}

// ============================================================================
// HELPER: Get current settings for mutations
// ============================================================================

export function getCurrentSettingsForMutation(
  settings: TenantSettings | null
): StoreModeSettingsInput | null {
  if (!settings) return null;

  return {
    storeMode: settings.storeMode,
    onlineCheckoutEnabled: settings.onlineCheckoutEnabled,
    posEnabled: settings.posEnabled,
    phoneOrdersEnabled: settings.phoneOrdersEnabled,
    posScannerMode: settings.posScannerMode,
    receiptPaperWidth: settings.receiptPaperWidth,
    receiptShowLogo: settings.receiptShowLogo,
    receiptShowContact: settings.receiptShowContact,
    receiptFooterText: settings.receiptFooterText ?? undefined,
  };
}
