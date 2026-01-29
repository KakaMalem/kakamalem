"use client";

export type ConnectivityStatus = "online" | "offline" | "degraded";

export interface ConnectivityCheckResult {
  status: ConnectivityStatus;
  latencyMs: number | null;
}

const HEALTH_ENDPOINT = "/api/health";
const ONLINE_INTERVAL_MS = 30_000; // 30 seconds when online
const RECOVERING_INTERVAL_MS = 5_000; // 5 seconds when recovering from offline
const DEGRADED_LATENCY_MS = 2000; // >2s latency = degraded
const TIMEOUT_MS = 5000; // 5 second timeout for health check

/**
 * Perform a single connectivity check.
 * Uses the existing /api/health endpoint as a heartbeat.
 * Returns status and latency.
 */
export async function checkConnectivity(): Promise<ConnectivityCheckResult> {
  // First check browser-level connectivity
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { status: "offline", latencyMs: null };
  }

  // Then check actual server reachability
  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(HEALTH_ENDPOINT, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return { status: "degraded", latencyMs };
    }

    if (latencyMs > DEGRADED_LATENCY_MS) {
      return { status: "degraded", latencyMs };
    }

    return { status: "online", latencyMs };
  } catch {
    return { status: "offline", latencyMs: null };
  }
}

/**
 * Get the heartbeat interval based on current status.
 * Faster interval when offline/degraded to detect recovery quickly.
 */
export function getHeartbeatInterval(status: ConnectivityStatus): number {
  return status === "online" ? ONLINE_INTERVAL_MS : RECOVERING_INTERVAL_MS;
}
