"use client";

import { useEffect } from "react";

export function AutoPrintTrigger() {
  useEffect(() => {
    // Small delay to ensure the page is fully rendered
    const timer = setTimeout(() => {
      window.print();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
