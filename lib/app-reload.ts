/**
 * Deployment-skew recovery.
 *
 * When a new version is deployed, clients (especially installed PWAs on
 * phones, which keep an old build resident for days) hold stale Server Action
 * references. Submitting a form then fails server-side with:
 *
 *   "Failed to find Server Action "...". This request might be from an
 *    older or newer deployment."
 *
 * The structural fix is a stable NEXT_SERVER_ACTIONS_ENCRYPTION_KEY env var,
 * but an already-loaded old client can still miss when an action's code
 * changed between builds. This module detects that specific failure and
 * hard-reloads onto the fresh build (busting the service-worker cache) so the
 * user silently lands on the new version instead of seeing a broken form.
 */

const RELOAD_GUARD_KEY = "km_skew_reload_at";
// Don't reload more than once per cooldown — if the error persists after a
// reload it's NOT skew (or the env fix isn't deployed), so we stop and let the
// real error surface instead of looping.
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * True when the error looks like a Next.js deployment/version skew error
 * (stale Server Action reference). Matchers are intentionally narrow so we
 * never hard-reload on unrelated rejections.
 */
export function isDeploymentSkewError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const m = message.toLowerCase();

  return (
    m.includes("failed to find server action") ||
    m.includes("older or newer deployment") ||
    // Generic message Next.js surfaces to the client when the action POST
    // gets an unexpected (non-action) response after a redeploy.
    m.includes("an unexpected response was received from the server")
  );
}

/**
 * Hard-reload onto the latest build. Returns true if a reload was initiated,
 * false if it was suppressed by the cooldown guard (caller should then show
 * the real error rather than spinning forever).
 */
export async function reloadForUpdate(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (last && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode / disabled) — without a guard
    // a reload could loop, so bail and let the real error show.
    return false;
  }

  // Bust the PWA caches and pull a new service worker so the reload actually
  // fetches the new build instead of being served stale chunks. Keep the SW
  // registered (don't unregister — preserves offline POS); skipWaiting in
  // app/sw.ts means the new worker takes over immediately.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Best-effort cache busting; reload regardless.
  }

  window.location.reload();
  return true;
}
