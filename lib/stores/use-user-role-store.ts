"use client";

import { create } from "zustand";
import type { StoreRole } from "@/lib/auth/context";

// =============================================================================
// USER ROLE STORE
// =============================================================================
// Stores the current user's role at the active store (from dashboard context)
// Role is hydrated from server on each store layout render
// No persistence needed - refreshes on page load
// =============================================================================

type UserRoleState = {
  // State
  role: StoreRole;
  tenantId: string | null;
  isHydrated: boolean;
  isPlatformAdminOverride: boolean;

  // Actions
  hydrate: (
    tenantId: string,
    role: StoreRole,
    isPlatformAdminOverride: boolean
  ) => void;
  reset: () => void;
};

export const useUserRoleStore = create<UserRoleState>()((set) => ({
  // Initial state
  role: null,
  tenantId: null,
  isHydrated: false,
  isPlatformAdminOverride: false,

  // Hydrate from server data
  hydrate: (tenantId, role, isPlatformAdminOverride) => {
    set({
      tenantId,
      role,
      isPlatformAdminOverride,
      isHydrated: true,
    });
  },

  // Reset store (on logout or tenant switch)
  reset: () => {
    set({
      role: null,
      tenantId: null,
      isHydrated: false,
      isPlatformAdminOverride: false,
    });
  },
}));

// =============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// =============================================================================

export function useUserRole() {
  return useUserRoleStore((state) => state.role);
}

/**
 * Returns true when the current user is a platform admin acting on a store
 * they don't own/staff. Use for UI that should expand access beyond `role`.
 */
export function useIsPlatformAdminOverride() {
  return useUserRoleStore((state) => state.isPlatformAdminOverride);
}

export function useIsOwner() {
  return useUserRoleStore((state) => state.role === "owner");
}

export function useIsAdmin() {
  return useUserRoleStore(
    (state) => state.role === "owner" || state.role === "admin"
  );
}

export function useIsStaff() {
  return useUserRoleStore(
    (state) =>
      state.role === "owner" || state.role === "admin" || state.role === "staff"
  );
}

export function useIsRoleHydrated() {
  return useUserRoleStore((state) => state.isHydrated);
}

export function useCurrentTenantId() {
  return useUserRoleStore((state) => state.tenantId);
}

// =============================================================================
// ACTIONS (stable references, no re-renders)
// =============================================================================

export const userRoleActions = {
  hydrate: (
    tenantId: string,
    role: StoreRole,
    isPlatformAdminOverride: boolean
  ) =>
    useUserRoleStore
      .getState()
      .hydrate(tenantId, role, isPlatformAdminOverride),
  reset: () => useUserRoleStore.getState().reset(),
};
