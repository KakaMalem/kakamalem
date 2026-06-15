"use client";

import { useEffect } from "react";
import { isDeploymentSkewError, reloadForUpdate } from "@/lib/app-reload";

/**
 * Catches deployment-skew errors that surface as unhandled promise rejections
 * (Server Actions invoked from event handlers, which don't hit a route error
 * boundary) and silently reloads onto the fresh build. Route-boundary cases
 * are handled separately in <ErrorDisplay>.
 *
 * Mounted once in the root layout. No UI.
 */
export function AppUpdateReloader() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isDeploymentSkewError(event.reason)) {
        event.preventDefault();
        void reloadForUpdate();
      }
    };

    const onError = (event: ErrorEvent) => {
      if (isDeploymentSkewError(event.error ?? event.message)) {
        void reloadForUpdate();
      }
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
