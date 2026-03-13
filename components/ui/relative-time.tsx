"use client";

import { useSyncExternalStore } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Custom hook to detect client-side mounting (prevents hydration mismatch)
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// =============================================================================
// RELATIVE TIME COMPONENT
// =============================================================================
// Displays timestamps as relative time ("2 hours ago") with full datetime tooltip.
// Uses client-side rendering to show times in the viewer's local timezone.
// =============================================================================

interface RelativeTimeProps {
  /** The date to display (Date object or ISO string) */
  date: Date | string | null | undefined;
  /** Whether to show tooltip with full datetime (default: true) */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Fallback text when date is null/undefined */
  fallback?: string;
  /** Timezone for the tooltip (default: "Asia/Kabul") */
  timeZone?: string;
}

/**
 * Displays a timestamp as relative time with a tooltip showing the full datetime.
 *
 * @example
 * <RelativeTime date={user.createdAt} />
 * // Renders: "2 hours ago" with tooltip "Feb 8, 2026, 3:45:30 PM"
 *
 * @example
 * <RelativeTime date={order.createdAt} showTooltip={false} />
 * // Renders: "Yesterday" without tooltip
 */
export function RelativeTime({
  date,
  showTooltip = true,
  className,
  fallback = "—",
  timeZone = "Asia/Kabul",
}: RelativeTimeProps) {
  const mounted = useIsMounted();

  // Handle null/undefined dates
  if (!date) {
    return <span className={className}>{fallback}</span>;
  }

  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Validate date
  if (isNaN(dateObj.getTime())) {
    return <span className={className}>{fallback}</span>;
  }

  // SSR: Show ISO date to avoid hydration mismatch
  if (!mounted) {
    return (
      <span className={className}>{dateObj.toISOString().split("T")[0]}</span>
    );
  }

  const relativeText = getRelativeTimeString(dateObj);
  const fullDateTime = formatFullDateTime(dateObj, timeZone);

  if (!showTooltip) {
    return <span className={className}>{relativeText}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className} style={{ cursor: "default" }}>
          {relativeText}
        </span>
      </TooltipTrigger>
      <TooltipContent>{fullDateTime}</TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Converts a date to a human-readable relative time string.
 * Uses the browser's Intl.RelativeTimeFormat for proper localization.
 */
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  // Use Intl.RelativeTimeFormat for localized output
  const rtf = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
    style: "long",
  });

  if (absDiff < MINUTE) {
    return rtf.format(
      isPast ? -Math.floor(absDiff / SECOND) : Math.floor(absDiff / SECOND),
      "second"
    );
  }

  if (absDiff < HOUR) {
    const minutes = Math.floor(absDiff / MINUTE);
    return rtf.format(isPast ? -minutes : minutes, "minute");
  }

  if (absDiff < DAY) {
    const hours = Math.floor(absDiff / HOUR);
    return rtf.format(isPast ? -hours : hours, "hour");
  }

  if (absDiff < WEEK) {
    const days = Math.floor(absDiff / DAY);
    return rtf.format(isPast ? -days : days, "day");
  }

  if (absDiff < MONTH) {
    const weeks = Math.floor(absDiff / WEEK);
    return rtf.format(isPast ? -weeks : weeks, "week");
  }

  if (absDiff < YEAR) {
    const months = Math.floor(absDiff / MONTH);
    return rtf.format(isPast ? -months : months, "month");
  }

  const years = Math.floor(absDiff / YEAR);
  return rtf.format(isPast ? -years : years, "year");
}

/**
 * Formats a date to a full localized datetime string.
 * Uses the specified timezone and locale.
 */
function formatFullDateTime(date: Date, timeZone?: string): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone,
  });
}
