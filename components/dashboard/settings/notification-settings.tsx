"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, BellOff, Smartphone, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { disablePushNotifications } from "@/lib/actions/push-notifications";

interface NotificationSettingsProps {
  tenantId: string;
  storeSlug: string;
  initialEnabled: boolean;
  deviceCount: number;
}

/**
 * Validate that a string looks like a valid VAPID key
 * VAPID keys are base64url encoded and typically 87+ characters
 */
function isValidVapidKey(key: string | undefined): key is string {
  if (!key) return false;
  // VAPID public keys are base64url encoded, typically 87 characters
  // Check it's not a placeholder and has reasonable length
  if (key.length < 40) return false;
  if (key.toLowerCase().includes("your") || key.includes("...")) return false;
  // Basic base64url character check
  return /^[A-Za-z0-9_-]+$/.test(key);
}

/**
 * Convert VAPID public key from base64url to Uint8Array
 * Required for PushManager.subscribe()
 * Returns null if conversion fails
 */
function urlBase64ToUint8Array(
  base64String: string
): Uint8Array<ArrayBuffer> | null {
  try {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    console.error("Failed to decode VAPID key - ensure valid base64url format");
    return null;
  }
}

/**
 * Get a friendly device name from the user agent
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "";

  // Detect browser
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";

  // Detect OS
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "Mac";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return os ? `${browser} on ${os}` : browser;
}

export function NotificationSettings({
  tenantId,
  storeSlug,
  initialEnabled,
  deviceCount,
}: NotificationSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [currentDeviceCount, setCurrentDeviceCount] = useState(deviceCount);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isPending, startTransition] = useTransition();
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Check browser support
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = async (enabled: boolean) => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    if (enabled) {
      // Enable notifications
      setIsSubscribing(true);
      try {
        // Request permission if needed
        if (permission !== "granted") {
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== "granted") {
            toast.error("Please allow notifications in your browser settings");
            setIsSubscribing(false);
            return;
          }
        }

        // Check if VAPID key is configured and valid
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!isValidVapidKey(vapidKey)) {
          toast.error("Push notifications are not configured on this server");
          setIsSubscribing(false);
          return;
        }

        // Convert VAPID key to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        if (!applicationServerKey) {
          toast.error("Invalid VAPID key configuration");
          setIsSubscribing(false);
          return;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // Send subscription to server
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            subscription: subscription.toJSON(),
            deviceName: getDeviceName(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to save subscription");
        }

        setIsEnabled(true);
        setCurrentDeviceCount((prev) => prev + 1);
        toast.success("Order notifications enabled for this device");
      } catch (error) {
        console.error("Failed to enable notifications:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to enable notifications"
        );
      } finally {
        setIsSubscribing(false);
      }
    } else {
      // Disable notifications
      startTransition(async () => {
        const result = await disablePushNotifications(tenantId, storeSlug);
        if (result.success) {
          setIsEnabled(false);
          setCurrentDeviceCount(0);
          toast.success("Notifications disabled");
        } else {
          toast.error(result.error || "Failed to disable notifications");
        }
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Order Notifications
        </CardTitle>
        <CardDescription>
          Get instant browser notifications when you receive new orders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex gap-3">
              <BellOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Not Supported</p>
                <p className="text-sm text-muted-foreground">
                  Push notifications are not supported in this browser. Please
                  use Chrome, Firefox, or Edge for the best experience.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications" className="text-base">
                  Enable notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts for new orders on this device
                </p>
              </div>
              <Switch
                id="notifications"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isPending || isSubscribing}
              />
            </div>

            {isEnabled && currentDeviceCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
                <Smartphone className="h-4 w-4 shrink-0" />
                <span>
                  Notifications enabled on {currentDeviceCount} device
                  {currentDeviceCount > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {permission === "denied" && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Notifications Blocked
                    </p>
                    <p className="text-sm text-destructive/80">
                      Notifications are blocked by your browser. Please enable
                      them in your browser settings to receive order alerts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isEnabled && permission !== "denied" && (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Stay informed
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Enable notifications to get instant alerts when customers
                      place orders. Works even when the browser tab is closed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
