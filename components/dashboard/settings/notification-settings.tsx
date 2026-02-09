"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Bell,
  BellOff,
  Smartphone,
  AlertCircle,
  Trash2,
  Monitor,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  disablePushNotifications,
  disablePushNotificationsForDevice,
} from "@/lib/actions/push-notifications";
import { formatDistanceToNow } from "date-fns";

interface Device {
  id: string;
  deviceName: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isCurrent: boolean;
}

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

export function NotificationSettings({
  tenantId,
  storeSlug,
  initialEnabled,
  deviceCount,
}: NotificationSettingsProps) {
  // isEnabled now means THIS device is enabled
  const [isEnabled, setIsEnabled] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [totalDevices, setTotalDevices] = useState(deviceCount);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isPending, startTransition] = useTransition();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  // Check current device status on mount
  useEffect(() => {
    const checkStatus = async () => {
      // Check browser support
      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        // Get current device's endpoint
        const currentEndpoint = await getCurrentDeviceEndpoint();

        // Fetch status from API with current endpoint
        try {
          const params = new URLSearchParams({ tenantId });
          if (currentEndpoint) {
            params.set("endpoint", currentEndpoint);
          }

          const response = await fetch(`/api/push/status?${params}`);
          if (response.ok) {
            const data = await response.json();
            setIsEnabled(data.currentDeviceEnabled);
            setDevices(data.devices || []);
            setTotalDevices(data.totalDevices);
          }
        } catch (error) {
          console.error("Failed to fetch push status:", error);
          // Fall back to initial values
          setIsEnabled(initialEnabled);
        }
      }
      setIsLoading(false);
    };

    checkStatus();
  }, [tenantId, initialEnabled]);

  const handleToggle = async (enabled: boolean) => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    if (enabled) {
      // Enable notifications for THIS device
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

        const result = await response.json();

        setIsEnabled(true);
        // Add this device to the list
        setDevices((prev) => {
          const exists = prev.some((d) => d.id === result.subscriptionId);
          if (exists) {
            return prev.map((d) =>
              d.id === result.subscriptionId ? { ...d, isCurrent: true } : d
            );
          }
          return [
            ...prev,
            {
              id: result.subscriptionId,
              deviceName: getDeviceName(),
              lastUsedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              isCurrent: true,
            },
          ];
        });
        setTotalDevices((prev) => (result.isNew ? prev + 1 : prev));
        toast.success("Notifications enabled for this device");
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
      // Disable notifications for THIS device only
      startTransition(async () => {
        try {
          const currentEndpoint = await getCurrentDeviceEndpoint();
          if (currentEndpoint) {
            // Just disable this device
            const response = await fetch(
              `/api/push/subscribe?tenantId=${tenantId}&endpoint=${encodeURIComponent(currentEndpoint)}`,
              { method: "DELETE" }
            );
            if (response.ok) {
              setIsEnabled(false);
              setDevices((prev) =>
                prev.filter((d) => !d.isCurrent).map((d) => d)
              );
              setTotalDevices((prev) => Math.max(0, prev - 1));
              toast.success("Notifications disabled for this device");
            }
          }
        } catch (error) {
          console.error("Failed to disable notifications:", error);
          toast.error("Failed to disable notifications");
        }
      });
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    setRemovingDeviceId(deviceId);
    try {
      const result = await disablePushNotificationsForDevice(
        tenantId,
        deviceId
      );
      if (result.success) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
        setTotalDevices((prev) => Math.max(0, prev - 1));
        toast.success("Device removed");
      } else {
        toast.error(result.error || "Failed to remove device");
      }
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setRemovingDeviceId(null);
    }
  };

  const handleRemoveAllDevices = async () => {
    startTransition(async () => {
      const result = await disablePushNotifications(tenantId, storeSlug);
      if (result.success) {
        setIsEnabled(false);
        setDevices([]);
        setTotalDevices(0);
        toast.success("All devices removed");
      } else {
        toast.error(result.error || "Failed to remove devices");
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Order Notifications
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
                  Enable on this device
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts for new orders on this browser
                </p>
              </div>
              <Switch
                id="notifications"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isPending || isSubscribing}
              />
            </div>

            {/* Device list */}
            {devices.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Enabled devices ({totalDevices})
                  </p>
                  {totalDevices > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={handleRemoveAllDevices}
                      disabled={isPending}
                    >
                      Remove all
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border divide-y">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3">
                        {device.isCurrent ? (
                          <Monitor className="h-4 w-4 text-primary" />
                        ) : (
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {device.deviceName || "Unknown device"}
                            {device.isCurrent && (
                              <span className="ml-2 text-xs text-primary">
                                (This device)
                              </span>
                            )}
                          </p>
                          {device.lastUsedAt && (
                            <p className="text-xs text-muted-foreground">
                              Last used{" "}
                              {formatDistanceToNow(
                                new Date(device.lastUsedAt),
                                {
                                  addSuffix: true,
                                }
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      {!device.isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveDevice(device.id)}
                          disabled={removingDeviceId === device.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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

            {!isEnabled && permission !== "denied" && devices.length === 0 && (
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
