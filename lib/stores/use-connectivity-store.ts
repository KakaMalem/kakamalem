"use client";

import { create } from "zustand";
import {
  checkConnectivity,
  getHeartbeatInterval,
  type ConnectivityStatus,
} from "@/lib/offline/connectivity";

interface ConnectivityState {
  // State
  status: ConnectivityStatus;
  lastOnlineAt: number | null;
  lastCheckedAt: number | null;
  latencyMs: number | null;
  isMonitoring: boolean;

  // Internal
  _cleanup: (() => void) | null;
  _heartbeatTimer: ReturnType<typeof setInterval> | null;

  // Actions
  setStatus: (status: ConnectivityStatus, latencyMs: number | null) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  checkNow: () => Promise<void>;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  status:
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  lastOnlineAt: null,
  lastCheckedAt: null,
  latencyMs: null,
  isMonitoring: false,
  _cleanup: null,
  _heartbeatTimer: null,

  setStatus: (status, latencyMs) => {
    const now = Date.now();
    set((state) => ({
      status,
      latencyMs,
      lastCheckedAt: now,
      ...(status === "online" && state.status !== "online"
        ? { lastOnlineAt: now }
        : {}),
    }));
  },

  checkNow: async () => {
    const result = await checkConnectivity();
    get().setStatus(result.status, result.latencyMs);
  },

  startMonitoring: () => {
    if (get().isMonitoring) return;
    if (typeof window === "undefined") return;

    set({ isMonitoring: true });

    // Listen to browser online/offline events
    const handleOnline = () => {
      get().checkNow();
    };
    const handleOffline = () => {
      get().setStatus("offline", null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    get().checkNow();

    // Start heartbeat with dynamic interval
    const scheduleHeartbeat = () => {
      const currentTimer = get()._heartbeatTimer;
      if (currentTimer) {
        clearInterval(currentTimer);
      }

      const interval = getHeartbeatInterval(get().status);
      const timer = setInterval(async () => {
        const prevStatus = get().status;
        await get().checkNow();
        const newStatus = get().status;

        // Adjust interval if status changed
        if (prevStatus !== newStatus) {
          scheduleHeartbeat();
        }
      }, interval);

      set({ _heartbeatTimer: timer });
    };

    scheduleHeartbeat();

    // Store cleanup function
    const cleanup = () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      const timer = get()._heartbeatTimer;
      if (timer) {
        clearInterval(timer);
      }
    };

    set({ _cleanup: cleanup });
  },

  stopMonitoring: () => {
    const cleanup = get()._cleanup;
    if (cleanup) {
      cleanup();
    }
    set({
      isMonitoring: false,
      _cleanup: null,
      _heartbeatTimer: null,
    });
  },
}));

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export function useConnectivityStatus(): ConnectivityStatus {
  return useConnectivityStore((state) => state.status);
}

export function useIsOnline(): boolean {
  return useConnectivityStore((state) => state.status !== "offline");
}

export function useIsOffline(): boolean {
  return useConnectivityStore((state) => state.status === "offline");
}

export function useConnectivityLatency(): number | null {
  return useConnectivityStore((state) => state.latencyMs);
}
