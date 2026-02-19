"use client";

import { useLayoutEffect, useRef } from "react";
import {
  useTenantSettingsStore,
  type TenantSettings,
} from "@/lib/stores/use-tenant-settings-store";

interface TenantSettingsHydrationProps {
  settings: TenantSettings;
}

export function TenantSettingsHydration({
  settings,
}: TenantSettingsHydrationProps) {
  const lastSettingsIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (lastSettingsIdRef.current !== settings.id) {
      useTenantSettingsStore.getState().hydrate(settings);
      lastSettingsIdRef.current = settings.id;
    }
  }, [settings]);

  return null;
}
