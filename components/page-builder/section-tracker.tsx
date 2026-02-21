"use client";

import { useEffect, useRef, useCallback } from "react";

interface SectionTrackerProps {
  tenantId: string;
  pageType: string;
}

interface PendingEvent {
  sectionType: string;
  sectionIndex: number;
  eventType: "impression" | "click";
}

const FLUSH_INTERVAL = 5000; // 5 seconds

export function SectionTracker({ tenantId, pageType }: SectionTrackerProps) {
  const pendingEvents = useRef<PendingEvent[]>([]);
  const impressedSections = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(() => {
    if (pendingEvents.current.length === 0) return;

    const events = [...pendingEvents.current];
    pendingEvents.current = [];

    // Use sendBeacon for reliability (survives page unload)
    const body = JSON.stringify({ tenantId, pageType, events });
    const beaconSent = navigator.sendBeacon("/api/analytics/sections", body);

    // Fallback to fetch if sendBeacon fails
    if (!beaconSent) {
      fetch("/api/analytics/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Silent fail — analytics are best-effort
      });
    }
  }, [tenantId, pageType]);

  useEffect(() => {
    // --- Impression tracking via IntersectionObserver ---
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const el = entry.target as HTMLElement;
          const sectionType = el.dataset.sectionType;
          const sectionIndex = el.dataset.sectionIndex;

          if (!sectionType || sectionIndex === undefined) continue;

          const key = `${sectionType}-${sectionIndex}`;
          if (impressedSections.current.has(key)) continue;

          impressedSections.current.add(key);
          pendingEvents.current.push({
            sectionType,
            sectionIndex: parseInt(sectionIndex, 10),
            eventType: "impression",
          });
        }
      },
      { threshold: 0.3 } // 30% visible
    );

    // Observe all section elements
    const sections = document.querySelectorAll("[data-section-type]");
    sections.forEach((el) => observer.observe(el));

    // --- Click tracking via event delegation ---
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const section = target.closest(
        "[data-section-type]"
      ) as HTMLElement | null;
      if (!section) return;

      const sectionType = section.dataset.sectionType;
      const sectionIndex = section.dataset.sectionIndex;

      if (!sectionType || sectionIndex === undefined) return;

      pendingEvents.current.push({
        sectionType,
        sectionIndex: parseInt(sectionIndex, 10),
        eventType: "click",
      });
    };

    document.addEventListener("click", handleClick, { passive: true });

    // --- Periodic flush ---
    flushTimer.current = setInterval(flush, FLUSH_INTERVAL);

    // --- Flush on page visibility change (user navigating away) ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (flushTimer.current) clearInterval(flushTimer.current);
      flush(); // Final flush on unmount
    };
  }, [flush]);

  return null; // Invisible component
}
