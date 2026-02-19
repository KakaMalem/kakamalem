"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  BellRing,
  Clock,
  Loader2,
  Monitor,
  Moon,
  Smartphone,
  Store,
  Tablet,
  Trash2,
} from "lucide-react";
import { NotificationSoundSettings } from "@/components/dashboard/settings/notification-sound-settings";
import {
  updateGlobalPreferences,
  updateStorePreferences,
  removeDevice,
  type NotificationPreferencesData,
  type GlobalPreferences,
  type StorePreferences,
  type DeviceInfo,
} from "@/lib/actions/notification-preferences";
import { getDeviceType } from "@/lib/utils/device";

// =============================================================================
// CONSTANTS
// =============================================================================

const OWNER_EVENT_LABELS: Record<
  string,
  { label: string; description: string }
> = {
  new_order: {
    label: "New Orders",
    description: "When a customer places an order",
  },
  order_cancelled: {
    label: "Cancellations",
    description: "When an order is cancelled",
  },
  low_stock: {
    label: "Low Stock Alerts",
    description: "When a product is running low",
  },
  out_of_stock: {
    label: "Out of Stock",
    description: "When a product runs out",
  },
  new_review: {
    label: "New Reviews",
    description: "When a customer leaves a review",
  },
  payment_received: {
    label: "Payments",
    description: "When a payment is received",
  },
  refund_processed: {
    label: "Refunds",
    description: "When a refund is processed",
  },
};

const TIMEZONES = [
  { value: "Asia/Kabul", label: "Kabul (UTC+4:30)" },
  { value: "Asia/Tehran", label: "Tehran (UTC+3:30)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Karachi", label: "Karachi (UTC+5)" },
  { value: "Asia/Kolkata", label: "India (UTC+5:30)" },
  { value: "Europe/Istanbul", label: "Istanbul (UTC+3)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "America/New_York", label: "New York (UTC-5)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8)" },
];

// =============================================================================
// TYPES
// =============================================================================

interface NotificationSettingsProps {
  stores: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  initialPreferences: NotificationPreferencesData;
}

// =============================================================================
// PUSH NOTIFICATION CARD (browser-level enable/disable)
// =============================================================================

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState =
  | "loading"
  | "unsupported"
  | "denied"
  | "prompt"
  | "subscribed"
  | "unsubscribed";

function PushNotificationCard({
  onSubscriptionChange,
}: {
  onSubscriptionChange?: () => void;
}) {
  const [state, setState] = useState<PushState>("loading");
  const [isToggling, setIsToggling] = useState(false);

  const checkPushState = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    if (Notification.permission === "default") {
      setState("prompt");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, []);

  useEffect(() => {
    checkPushState();
  }, [checkPushState]);

  const enablePush = async () => {
    setIsToggling(true);
    try {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "prompt");
          return;
        }
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("VAPID public key not configured");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });

      if (res.ok) {
        setState("subscribed");
        onSubscriptionChange?.();
      }
    } catch (err) {
      console.error("Failed to enable push:", err);
    } finally {
      setIsToggling(false);
    }
  };

  const disablePush = async () => {
    setIsToggling(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("unsubscribed");
      onSubscriptionChange?.();
    } catch (err) {
      console.error("Failed to disable push:", err);
    } finally {
      setIsToggling(false);
    }
  };

  if (state === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (state === "unsupported") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified even when the dashboard is closed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "denied" && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              Push notifications are blocked
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You previously blocked notifications for this site. To enable
              them, click the lock icon in your browser&apos;s address bar and
              allow notifications.
            </p>
          </div>
        )}

        {(state === "prompt" || state === "unsubscribed") && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {state === "prompt"
                ? "Receive instant alerts for new orders, low stock, and other important events — even when this tab is closed."
                : "Push notifications are allowed but not active on this device."}
            </p>
            <Button onClick={enablePush} disabled={isToggling}>
              {isToggling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4 mr-2" />
              )}
              Enable Push Notifications
            </Button>
          </div>
        )}

        {state === "subscribed" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-green-500/5 border-green-500/20 p-3">
              <BellRing className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">
                Push notifications are enabled on this device
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disablePush}
              disabled={isToggling}
            >
              {isToggling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disable Push Notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// GLOBAL PREFERENCES CARD
// =============================================================================

function GlobalPreferencesCard({
  preferences,
  onChange,
}: {
  preferences: GlobalPreferences;
  onChange: (updated: GlobalPreferences) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (partial: Partial<GlobalPreferences>) => {
    const updated = { ...preferences, ...partial };
    onChange(updated); // Optimistic
    startTransition(async () => {
      const result = await updateGlobalPreferences({
        quietHoursEnabled: updated.quietHoursEnabled,
        quietHoursStart: updated.quietHoursStart,
        quietHoursEnd: updated.quietHoursEnd,
        timezone: updated.timezone || "Asia/Kabul",
        inAppEnabled: updated.inAppEnabled,
        pushEnabled: updated.pushEnabled,
      });
      if (!result.success) {
        // Revert on failure
        onChange(preferences);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        <CardDescription>
          Default settings applied across all your stores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel Defaults */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Notification channels</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="global-inapp"
                className="flex flex-col gap-0.5 cursor-pointer"
              >
                <span className="text-sm">In-app notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Show in the notification bell
                </span>
              </Label>
              <Switch
                id="global-inapp"
                checked={preferences.inAppEnabled}
                onCheckedChange={(checked) =>
                  handleChange({ inAppEnabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="global-push"
                className="flex flex-col gap-0.5 cursor-pointer"
              >
                <span className="text-sm">Push notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  System notifications on your device
                </span>
              </Label>
              <Switch
                id="global-push"
                checked={preferences.pushEnabled}
                onCheckedChange={(checked) =>
                  handleChange({ pushEnabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between opacity-50">
              <Label className="flex flex-col gap-0.5">
                <span className="text-sm">Email notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Coming soon
                </span>
              </Label>
              <Switch disabled checked={false} />
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="quiet-hours"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Moon className="h-4 w-4" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Quiet hours</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Pause push notifications during set hours
                </span>
              </div>
            </Label>
            <Switch
              id="quiet-hours"
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) =>
                handleChange({ quietHoursEnabled: checked })
              }
            />
          </div>

          {preferences.quietHoursEnabled && (
            <div className="ml-6 space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="quiet-start" className="text-xs shrink-0">
                    From
                  </Label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHoursStart || "22:00"}
                    onChange={(e) =>
                      handleChange({ quietHoursStart: e.target.value })
                    }
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="quiet-end" className="text-xs shrink-0">
                    To
                  </Label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHoursEnd || "08:00"}
                    onChange={(e) =>
                      handleChange({ quietHoursEnd: e.target.value })
                    }
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={preferences.timezone || "Asia/Kabul"}
                  onValueChange={(tz) => handleChange({ timezone: tz })}
                >
                  <SelectTrigger className="h-8 text-xs w-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PER-STORE NOTIFICATION CARD
// =============================================================================

function StoreNotificationCard({
  store,
  preferences,
  onChange,
  showSlug = false,
}: {
  store: { id: string; name: string; slug: string };
  preferences: StorePreferences;
  onChange: (updated: StorePreferences) => void;
  showSlug?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const save = (updated: StorePreferences) => {
    onChange(updated); // Optimistic
    startTransition(async () => {
      const result = await updateStorePreferences({
        tenantId: store.id,
        notificationsEnabled: updated.notificationsEnabled,
        eventPreferences: updated.eventPreferences,
      });
      if (!result.success) {
        onChange(preferences); // Revert
      }
    });
  };

  const handleMasterToggle = (enabled: boolean) => {
    save({ ...preferences, notificationsEnabled: enabled });
  };

  const handleEventToggle = (
    eventType: string,
    channel: "inApp" | "push",
    checked: boolean
  ) => {
    const currentEvent = preferences.eventPreferences[eventType] || {};
    const updated: StorePreferences = {
      ...preferences,
      eventPreferences: {
        ...preferences.eventPreferences,
        [eventType]: { ...currentEvent, [channel]: checked },
      },
    };
    save(updated);
  };

  return (
    <AccordionItem value={store.id} className="border-b last:border-b-0">
      <div className="flex items-center gap-2 *:first:flex-1">
        <AccordionTrigger className="py-2 hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{store.name}</span>
            {showSlug && (
              <span className="text-xs text-muted-foreground">
                /{store.slug}
              </span>
            )}
            {isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </AccordionTrigger>
        <Switch
          checked={preferences.notificationsEnabled}
          onCheckedChange={handleMasterToggle}
          aria-label={`Toggle notifications for ${store.name}`}
        />
      </div>
      <AccordionContent className="pb-3">
        <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
          {/* Column headers */}
          <div className="flex items-center justify-end gap-4 pb-1.5 pr-0.5">
            <span className="text-[11px] text-muted-foreground font-medium w-9 text-center">
              In-app
            </span>
            <span className="text-[11px] text-muted-foreground font-medium w-9 text-center">
              Push
            </span>
          </div>
          {Object.entries(OWNER_EVENT_LABELS).map(
            ([eventType, { label, description }]) => {
              const eventPref = preferences.eventPreferences[eventType] || {};
              const disabled = !preferences.notificationsEnabled;

              return (
                <div
                  key={eventType}
                  className={`flex items-center justify-between py-1.5 ${
                    disabled ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm leading-tight">{label}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-9 flex justify-center">
                      <Switch
                        checked={eventPref.inApp !== false}
                        onCheckedChange={(checked) =>
                          handleEventToggle(eventType, "inApp", checked)
                        }
                        disabled={disabled}
                        aria-label={`${label} in-app`}
                        className="scale-[0.85]"
                      />
                    </div>
                    <div className="w-9 flex justify-center">
                      <Switch
                        checked={eventPref.push !== false}
                        onCheckedChange={(checked) =>
                          handleEventToggle(eventType, "push", checked)
                        }
                        disabled={disabled}
                        aria-label={`${label} push`}
                        className="scale-[0.85]"
                      />
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// =============================================================================
// DEVICE MANAGEMENT CARD
// =============================================================================

function DeviceIcon({ deviceName }: { deviceName: string }) {
  const type = getDeviceType(deviceName);
  if (type === "smartphone") return <Smartphone className="h-5 w-5" />;
  if (type === "tablet") return <Tablet className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never used";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DeviceManagementCard({
  devices,
  onDeviceRemoved,
}: {
  devices: DeviceInfo[];
  onDeviceRemoved: (endpoint: string) => void;
}) {
  const [removingEndpoint, setRemovingEndpoint] = useState<string | null>(null);

  const handleRemove = async (device: DeviceInfo) => {
    setRemovingEndpoint(device.endpoint);
    try {
      const result = await removeDevice({ endpoint: device.endpoint });
      if (result.success) {
        onDeviceRemoved(device.endpoint);
      }
    } catch (err) {
      console.error("Failed to remove device:", err);
    } finally {
      setRemovingEndpoint(null);
    }
  };

  if (devices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Your Devices
        </CardTitle>
        <CardDescription>Devices receiving push notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.endpoint}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="text-muted-foreground shrink-0">
                <DeviceIcon deviceName={device.deviceName} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {device.deviceName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last active: {formatLastActive(device.lastUsedAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(device)}
                disabled={removingEndpoint === device.endpoint}
              >
                {removingEndpoint === device.endpoint ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NotificationSettings({
  stores,
  initialPreferences,
}: NotificationSettingsProps) {
  const [globalPrefs, setGlobalPrefs] = useState(initialPreferences.global);
  const [storePrefs, setStorePrefs] = useState(initialPreferences.stores);
  const [devices, setDevices] = useState(initialPreferences.devices);

  // Detect duplicate store names to show slug for disambiguation
  const duplicateNames = new Set(
    stores.map((s) => s.name).filter((name, i, arr) => arr.indexOf(name) !== i)
  );

  const handleStoreChange = (tenantId: string, updated: StorePreferences) => {
    setStorePrefs((prev) => ({ ...prev, [tenantId]: updated }));
  };

  const handleDeviceRemoved = (endpoint: string) => {
    setDevices((prev) => prev.filter((d) => d.endpoint !== endpoint));
  };

  const refreshDevices = useCallback(async () => {
    // Re-fetch preferences to get updated device list
    try {
      const { getNotificationPreferences } =
        await import("@/lib/actions/notification-preferences");
      const data = await getNotificationPreferences();
      setDevices(data.devices);
    } catch {
      // Silently fail — device list will be stale until page refresh
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Global Preferences */}
      <GlobalPreferencesCard
        preferences={globalPrefs}
        onChange={setGlobalPrefs}
      />

      {/* Per-Store Settings */}
      {stores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Per-Store Settings
            </CardTitle>
            <CardDescription>
              Override defaults for individual stores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="-mt-1">
              {stores.map((store) => {
                const prefs = storePrefs[store.id] || {
                  tenantId: store.id,
                  notificationsEnabled: true,
                  eventPreferences: {},
                };
                return (
                  <StoreNotificationCard
                    key={store.id}
                    store={store}
                    preferences={prefs}
                    onChange={(updated) => handleStoreChange(store.id, updated)}
                    showSlug={duplicateNames.has(store.name)}
                  />
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Push Notification Opt-in */}
      <PushNotificationCard onSubscriptionChange={refreshDevices} />

      {/* Device Management */}
      <DeviceManagementCard
        devices={devices}
        onDeviceRemoved={handleDeviceRemoved}
      />

      {/* Notification Sound Settings */}
      <NotificationSoundSettings />
    </div>
  );
}
