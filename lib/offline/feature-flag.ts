/**
 * Feature flag for offline POS functionality.
 * Controlled via NEXT_PUBLIC_OFFLINE_POS environment variable.
 *
 * When disabled:
 * - No Dexie database initialization
 * - No connectivity monitoring in POS UI
 * - POS works in online-only mode (current behavior)
 *
 * When enabled:
 * - Dexie database is initialized and seeded
 * - Connectivity is monitored and displayed in POS UI
 * - Install prompt appears on POS page
 * - POS UI shows offline indicators
 */
export const OFFLINE_POS_ENABLED =
  process.env.NEXT_PUBLIC_OFFLINE_POS === "true";
