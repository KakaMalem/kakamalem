"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  BellOff,
  Smartphone,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
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

interface CustomerNotificationSettingsProps {
  tenantId: string;
  storeName: string;
}

/**
 * Validate that a string looks like a valid VAPID key
 */
function isValidVapidKey(key: string | undefined): key is string {
  if (!key) return false;
  if (key.length < 40) return false;
  if (key.toLowerCase().includes("your") || key.includes("...")) return false;
  return /^[A-Za-z0-9_-]+$/.test(key);
}

/**
 * Convert VAPID public key from base64url to Uint8Array
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
    console.error("Failed to decode VAPID key");
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

  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "Mac";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return os ? `${browser} on ${os}` : browser;
}

export function CustomerNotificationSettings({
  tenantId,
  storeName,
}: CustomerNotificationSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);

  /**
   * Get current device's push subscription endpoint (if any)
   */
  async function getCurrentDeviceEndpoint(): Promise<string | null> {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return null;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;
      const subscription = await registration.pushManager.getSubscription();
      return subscription?.endpoint || null;
    } catch {
      return null;
    }
  }

  // Check browser support and initial status
  useEffect(() => {
    const checkSupport = async () => {
      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        // Get current device's endpoint for accurate status
        const currentEndpoint = await getCurrentDeviceEndpoint();

        // Check if already subscribed for this store
        try {
          const params = new URLSearchParams({ tenantId });
          if (currentEndpoint) {
            params.set("endpoint", currentEndpoint);
          }

          const response = await fetch(`/api/push/status?${params}`);
          if (response.ok) {
            const data = await response.json();
            // Use currentDeviceEnabled for accurate device-specific status
            setIsEnabled(data.currentDeviceEnabled ?? data.subscribed ?? false);
          }
        } catch (error) {
          console.error("Failed to check subscription status:", error);
        }
      }
      setIsLoading(false);
    };

    checkSupport();
  }, [tenantId]);

  const handleToggle = async (enabled: boolean) => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    if (enabled) {
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

        // Check VAPID key
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!isValidVapidKey(vapidKey)) {
          toast.error("Push notifications are not configured on this server");
          setIsSubscribing(false);
          return;
        }

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
        toast.success(`Notifications enabled for ${storeName}`);
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
      // Disable notifications for this device
      setIsSubscribing(true);
      try {
        // Get current device's endpoint for device-specific deletion
        const currentEndpoint = await getCurrentDeviceEndpoint();
        const params = new URLSearchParams({ tenantId });
        if (currentEndpoint) {
          params.set("endpoint", encodeURIComponent(currentEndpoint));
        }

        const response = await fetch(`/api/push/subscribe?${params}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setIsEnabled(false);
          toast.success("Notifications disabled");
        } else {
          toast.error("Failed to disable notifications");
        }
      } catch (error) {
        console.error("Failed to disable notifications:", error);
        toast.error("Failed to disable notifications");
      } finally {
        setIsSubscribing(false);
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Loading notification settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Get notified about your orders from {storeName}
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
                  use Chrome, Firefox, or Edge.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications" className="text-base">
                  Order updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your order status changes
                </p>
              </div>
              <Switch
                id="notifications"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isSubscribing}
              />
            </div>

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
                      them in your browser settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {permission === "granted" && !isEnabled && (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Permission granted
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your browser already allows notifications. Toggle the
                      switch above to enable order updates for this store.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isEnabled && permission === "default" && (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
                <div className="flex gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Stay updated
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Enable notifications to get instant updates when your
                      orders are confirmed, shipped, or delivered.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isEnabled && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
                <Bell className="h-4 w-4 shrink-0" />
                <span>You&apos;ll receive notifications on this device</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
