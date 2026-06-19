/**
 * Safari-safe date parsing.
 *
 * Safari's `Date` parser is far stricter than Chrome's. It returns `Invalid
 * Date` for inputs Chrome accepts, most importantly:
 *   - space-separated timestamps: "2024-01-15 10:30:00+00" (the format Postgres
 *     / postgres.js returns for timestamptz columns)
 *   - "YYYY-MM-DD HH:mm" without a "T"
 *   - some offset shapes like "+00"
 *
 * Calling `.toISOString()` or doing arithmetic on the result then throws
 * `RangeError: Invalid time value` (or yields NaN), which crashes the React
 * render in Safari and trips the error boundary.
 *
 * Use these helpers anywhere a date STRING (a DB timestamp or user input) is
 * turned into a Date in code that can run in the browser.
 */

import { format, formatDistanceToNow } from "date-fns";

/**
 * Parse a date-ish value into a Date, normalizing Safari-hostile formats.
 * Returns null when the value can't be parsed (never throws).
 */
export function parseDate(
  value: string | number | Date | null | undefined
): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = value.trim();
  if (!s) return null;

  // Proper ISO (with "T") parses identically everywhere — try as-is first.
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;

  // Normalize Postgres-style "YYYY-MM-DD HH:mm:ss[.ffffff][+TZ]":
  // - the space between date and time → "T"
  // - a trailing 2-digit offset ("+00") → "+00:00"
  const normalized = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const fixed = new Date(normalized);
  return Number.isNaN(fixed.getTime()) ? null : fixed;
}

/**
 * Safe epoch milliseconds for sorting/arithmetic. Returns 0 for unparseable
 * input so sorts stay stable instead of producing NaN comparisons.
 */
export function toTime(
  value: string | number | Date | null | undefined
): number {
  const d = parseDate(value);
  return d ? d.getTime() : 0;
}

/**
 * Safe ISO string. Returns null instead of throwing when the input is invalid.
 */
export function toISO(
  value: string | number | Date | null | undefined
): string | null {
  const d = parseDate(value);
  return d ? d.toISOString() : null;
}

/**
 * date-fns `format`, but Safari-safe: parses the value with parseDate first and
 * returns `fallback` instead of throwing on an invalid/unparseable date.
 *
 * Replaces `format(new Date(dbString), fmt)` — which throws RangeError in
 * Safari on space-separated Postgres timestamps.
 */
export function safeFormat(
  value: string | number | Date | null | undefined,
  fmt: string,
  fallback = "—"
): string {
  const d = parseDate(value);
  return d ? format(d, fmt) : fallback;
}

/**
 * date-fns `formatDistanceToNow`, Safari-safe. Returns `fallback` on an
 * invalid/unparseable date instead of throwing.
 */
export function safeFormatDistanceToNow(
  value: string | number | Date | null | undefined,
  options?: Parameters<typeof formatDistanceToNow>[1],
  fallback = "—"
): string {
  const d = parseDate(value);
  return d ? formatDistanceToNow(d, options) : fallback;
}
