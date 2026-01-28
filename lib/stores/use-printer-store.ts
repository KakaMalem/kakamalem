"use client";

import { create } from "zustand";

export type PrinterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface PrinterState {
  status: PrinterStatus;
  error: string | null;
  lastPrintTime: number | null;

  // Actions
  setStatus: (status: PrinterStatus) => void;
  setError: (error: string | null) => void;
  setLastPrintTime: () => void;
  reset: () => void;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  status: "disconnected",
  error: null,
  lastPrintTime: null,

  setStatus: (status) =>
    set({
      status,
      error: status === "connected" ? null : undefined,
    }),

  setError: (error) =>
    set({
      error,
      status: "error",
    }),

  setLastPrintTime: () =>
    set({
      lastPrintTime: Date.now(),
    }),

  reset: () =>
    set({
      status: "disconnected",
      error: null,
      lastPrintTime: null,
    }),
}));

// Selector hooks for convenience
export function usePrinterStatus() {
  return usePrinterStore((state) => state.status);
}

export function usePrinterError() {
  return usePrinterStore((state) => state.error);
}

export function useIsPrinterConnected() {
  return usePrinterStore((state) => state.status === "connected");
}
