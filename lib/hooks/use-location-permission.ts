"use client";

import { useState, useEffect, useCallback } from "react";

export type PermissionState = "unknown" | "granted" | "denied" | "prompt";

/**
 * Error types for location requests
 * - permission_denied: User denied browser permission
 * - position_unavailable: Location services disabled at OS level (phone settings)
 * - timeout: Location request timed out
 * - unknown: Other error
 */
export type LocationErrorType =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "android_silent_deny"
  | "unknown";

export interface LocationResult {
  position: GeolocationPosition | null;
  error: LocationErrorType | null;
}

interface UseLocationPermissionReturn {
  /** Whether to show a location permission prompt to the user */
  shouldShowLocationPrompt: boolean;
  /** Whether we're still checking the permission status */
  isCheckingPermission: boolean;
  /** Current permission state */
  permissionState: PermissionState;
  /** Last error from location request */
  lastError: LocationErrorType | null;
  /** Request location permission and get coordinates */
  requestLocation: () => Promise<LocationResult>;
  /** Dismiss the location prompt */
  dismissPrompt: () => void;
}

const DISMISSED_KEY = "location_prompt_dismissed";
const DISMISSED_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hook to manage browser geolocation permission
 * Shows a prompt only when permission is in 'prompt' state (never asked before)
 * and user hasn't dismissed it recently
 */
export function useLocationPermission(): UseLocationPermissionReturn {
  const [shouldShowLocationPrompt, setShouldShowLocationPrompt] =
    useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [permissionState, setPermissionState] =
    useState<PermissionState>("unknown");
  const [lastError, setLastError] = useState<LocationErrorType | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const checkLocationPermission = async () => {
      try {
        // Check if geolocation is supported
        if (!navigator.geolocation) {
          setPermissionState("denied");
          setShouldShowLocationPrompt(false);
          setIsCheckingPermission(false);
          return;
        }

        // Check secure context (but allow localhost in development)
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
        if (!window.isSecureContext && !isLocalhost) {
          setPermissionState("denied");
          setShouldShowLocationPrompt(false);
          setIsCheckingPermission(false);
          return;
        }

        // Check if user previously dismissed the prompt
        const dismissedData = localStorage.getItem(DISMISSED_KEY);
        if (dismissedData) {
          try {
            const { timestamp } = JSON.parse(dismissedData);
            if (Date.now() - timestamp < DISMISSED_EXPIRY) {
              // User dismissed recently, don't show prompt
              setPermissionState("prompt");
              setShouldShowLocationPrompt(false);
              setIsCheckingPermission(false);
              return;
            } else {
              // Dismissal expired, remove it
              localStorage.removeItem(DISMISSED_KEY);
            }
          } catch {
            localStorage.removeItem(DISMISSED_KEY);
          }
        }

        // Check current permission state using Permissions API
        if ("permissions" in navigator) {
          try {
            const permission = await navigator.permissions.query({
              name: "geolocation",
            });
            setPermissionState(permission.state as PermissionState);

            // Only show prompt if permission is in 'prompt' state (never asked before)
            if (permission.state === "prompt") {
              setShouldShowLocationPrompt(true);
            } else {
              setShouldShowLocationPrompt(false);
            }

            // Listen for permission changes
            const handleChange = () => {
              setPermissionState(permission.state as PermissionState);
              if (permission.state !== "prompt") {
                setShouldShowLocationPrompt(false);
              }
            };
            permission.addEventListener("change", handleChange);

            // Store cleanup function
            cleanup = () =>
              permission.removeEventListener("change", handleChange);
          } catch {
            // Permissions API might not support geolocation query in some browsers
            // Fallback: Try to detect if permission was previously denied
            navigator.geolocation.getCurrentPosition(
              () => {
                // Permission granted
                setPermissionState("granted");
                setShouldShowLocationPrompt(false);
              },
              (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                  setPermissionState("denied");
                  setShouldShowLocationPrompt(false);
                } else {
                  // Likely in prompt state or other error
                  setPermissionState("prompt");
                  setShouldShowLocationPrompt(true);
                }
              },
              { timeout: 1000, maximumAge: Infinity }
            );
          }
        } else {
          // Very old browser - assume we should ask
          setPermissionState("prompt");
          setShouldShowLocationPrompt(true);
        }
      } catch (error) {
        console.error("Error checking location permission:", error);
        setPermissionState("unknown");
        setShouldShowLocationPrompt(false);
      } finally {
        setIsCheckingPermission(false);
      }
    };

    checkLocationPermission();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  /**
   * Request location permission and get current position
   * Returns both position and error type for better error handling
   */
  const requestLocation = useCallback(async (): Promise<LocationResult> => {
    // Detect Android for special handling
    const isAndroid =
      typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

    // Store current permission state before request
    const prevPermissionState = permissionState;

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLastError("unknown");
        resolve({ position: null, error: "unknown" });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermissionState("granted");
          setShouldShowLocationPrompt(false);
          setLastError(null);
          resolve({ position, error: null });
        },
        (error) => {
          console.error("Geolocation error:", error.code, error.message);
          let errorType: LocationErrorType = "unknown";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              // On Android, if permission was "prompt" and we got denied without
              // user interaction, it's the Android silent deny issue
              if (isAndroid && prevPermissionState === "prompt") {
                errorType = "android_silent_deny";
              } else {
                errorType = "permission_denied";
              }
              setPermissionState("denied");
              break;
            case error.POSITION_UNAVAILABLE:
              // Location services disabled at OS level (phone settings off)
              errorType = "position_unavailable";
              // Note: permission might still be 'granted' in browser, just OS-level disabled
              break;
            case error.TIMEOUT:
              // Request timed out
              errorType = "timeout";
              break;
          }

          setLastError(errorType);
          setShouldShowLocationPrompt(false);
          resolve({ position: null, error: errorType });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Accept cached position up to 1 minute old
        }
      );
    });
  }, [permissionState]);

  /**
   * Dismiss the location prompt for 7 days
   */
  const dismissPrompt = useCallback(() => {
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ timestamp: Date.now() })
    );
    setShouldShowLocationPrompt(false);
  }, []);

  return {
    shouldShowLocationPrompt,
    isCheckingPermission,
    permissionState,
    lastError,
    requestLocation,
    dismissPrompt,
  };
}
