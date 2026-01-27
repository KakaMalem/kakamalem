"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Volume2,
  VolumeX,
  Smartphone,
  Info,
  Moon,
  ChevronDown,
  Package,
  XCircle,
  AlertTriangle,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NotificationSoundSettings } from "@/components/dashboard/settings/notification-sound-settings";

interface NotificationSettingsProps {
  stores: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

// Event types with their labels and icons
const EVENT_TYPES = [
  { id: "new_order", label: "New Orders", icon: Package, defaultPush: true },
  {
    id: "order_cancelled",
    label: "Order Cancellations",
    icon: XCircle,
    defaultPush: true,
  },
  {
    id: "low_stock",
    label: "Low Stock Alerts",
    icon: AlertTriangle,
    defaultPush: false,
  },
  { id: "new_review", label: "New Reviews", icon: Star, defaultPush: false },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["id"];

interface EventPreference {
  push: boolean;
  inApp: boolean;
}

interface StoreNotificationPrefs {
  storeId: string;
  notificationsEnabled: boolean;
  eventPreferences: Record<EventType, EventPreference>;
}

interface GlobalPrefs {
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export function NotificationSettings({ stores }: NotificationSettingsProps) {
  const [globalPrefs, setGlobalPrefs] = useState<GlobalPrefs>({
    pushEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });
  const [storePrefs, setStorePrefs] = useState<StoreNotificationPrefs[]>(
    stores.map((s) => ({
      storeId: s.id,
      notificationsEnabled: true,
      eventPreferences: EVENT_TYPES.reduce(
        (acc, event) => ({
          ...acc,
          [event.id]: { push: event.defaultPush, inApp: true },
        }),
        {} as Record<EventType, EventPreference>
      ),
    }))
  );
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>("default");

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications/preferences");
      if (response.ok) {
        const data = await response.json();
        if (data.global) {
          setGlobalPrefs({
            pushEnabled: data.global.pushEnabled ?? true,
            quietHoursEnabled: data.global.quietHoursEnabled ?? false,
            quietHoursStart: data.global.quietHoursStart ?? "22:00",
            quietHoursEnd: data.global.quietHoursEnd ?? "08:00",
          });
        }
        if (data.stores) {
          setStorePrefs(
            stores.map((s) => {
              const storePref = data.stores.find(
                (p: { storeId: string }) => p.storeId === s.id
              );
              return {
                storeId: s.id,
                notificationsEnabled: storePref?.notificationsEnabled ?? true,
                eventPreferences:
                  storePref?.eventPreferences ??
                  EVENT_TYPES.reduce(
                    (acc, event) => ({
                      ...acc,
                      [event.id]: { push: event.defaultPush, inApp: true },
                    }),
                    {} as Record<EventType, EventPreference>
                  ),
              };
            })
          );
        }
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, [stores]);

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setPushSupported(supported);

      if (supported) {
        setPushPermission(Notification.permission);
      }
    };

    checkPushSupport();
    loadPreferences();
  }, [loadPreferences]);

  async function requestPushPermission() {
    if (!pushSupported) return;

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted") {
        // Register service worker and subscribe
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!vapidKey) {
          toast.error("Push notifications are not configured on this server");
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        // Subscribe for all stores with notifications enabled
        for (const store of stores) {
          const pref = storePrefs.find((p) => p.storeId === store.id);
          if (pref?.notificationsEnabled) {
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: store.id,
                subscription: subscription.toJSON(),
              }),
            });
          }
        }

        toast.success("Push notifications enabled");
      }
    } catch (error) {
      console.error("Failed to enable push:", error);
      toast.error("Failed to enable push notifications");
    }
  }

  async function savePreferences() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          global: globalPrefs,
          stores: storePrefs.map((sp) => ({
            storeId: sp.storeId,
            notificationsEnabled: sp.notificationsEnabled,
            eventPreferences: sp.eventPreferences,
          })),
        }),
      });

      if (response.ok) {
        toast.success("Notification preferences saved");
      } else {
        toast.error("Failed to save preferences");
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  }

  function updateStorePref(
    storeId: string,
    field: "notificationsEnabled",
    value: boolean
  ) {
    setStorePrefs((prev) =>
      prev.map((p) => (p.storeId === storeId ? { ...p, [field]: value } : p))
    );
  }

  function updateEventPref(
    storeId: string,
    eventId: EventType,
    channel: "push" | "inApp",
    value: boolean
  ) {
    setStorePrefs((prev) =>
      prev.map((p) => {
        if (p.storeId !== storeId) return p;
        return {
          ...p,
          eventPreferences: {
            ...p.eventPreferences,
            [eventId]: {
              ...p.eventPreferences[eventId],
              [channel]: value,
            },
          },
        };
      })
    );
  }

  function toggleStoreExpanded(storeId: string) {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        next.add(storeId);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>
            Configure browser push notification settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Push Permission Status */}
          {pushSupported && pushPermission !== "granted" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Enable browser push notifications to get real-time alerts
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestPushPermission}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Enable Push
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {pushPermission === "denied" && (
            <Alert variant="destructive">
              <VolumeX className="h-4 w-4" />
              <AlertDescription>
                Push notifications are blocked. Please enable them in your
                browser settings.
              </AlertDescription>
            </Alert>
          )}

          {/* Push Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Browser Push Notifications
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              checked={globalPrefs.pushEnabled}
              onCheckedChange={(checked) =>
                setGlobalPrefs((prev) => ({ ...prev, pushEnabled: checked }))
              }
              disabled={pushPermission !== "granted"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Pause notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Enable Quiet Hours
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pause push notifications during specific hours
                </p>
              </div>
              <Switch
                checked={globalPrefs.quietHoursEnabled}
                onCheckedChange={(checked) =>
                  setGlobalPrefs((prev) => ({
                    ...prev,
                    quietHoursEnabled: checked,
                  }))
                }
              />
            </div>

            {globalPrefs.quietHoursEnabled && (
              <div className="flex items-center gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-start" className="text-xs">
                    From
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={globalPrefs.quietHoursStart}
                    onChange={(e) =>
                      setGlobalPrefs((prev) => ({
                        ...prev,
                        quietHoursStart: e.target.value,
                      }))
                    }
                    className="w-28"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-end" className="text-xs">
                    To
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={globalPrefs.quietHoursEnd}
                    onChange={(e) =>
                      setGlobalPrefs((prev) => ({
                        ...prev,
                        quietHoursEnd: e.target.value,
                      }))
                    }
                    className="w-28"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Sound Settings */}
      <NotificationSoundSettings />

      {/* Per-Store Settings Card */}
      {stores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Store Notifications</CardTitle>
            <CardDescription>
              Configure which notifications you receive for each store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stores.map((store) => {
              const pref = storePrefs.find((p) => p.storeId === store.id);
              const isExpanded = expandedStores.has(store.id);

              return (
                <Collapsible
                  key={store.id}
                  open={isExpanded}
                  onOpenChange={() => toggleStoreExpanded(store.id)}
                >
                  <div className="rounded-lg border">
                    {/* Store Header */}
                    <div className="flex items-center justify-between p-4">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-left">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                          <span className="font-medium">{store.name}</span>
                        </button>
                      </CollapsibleTrigger>
                      <Switch
                        checked={pref?.notificationsEnabled ?? true}
                        onCheckedChange={(checked) =>
                          updateStorePref(
                            store.id,
                            "notificationsEnabled",
                            checked
                          )
                        }
                      />
                    </div>

                    {/* Event Preferences */}
                    <CollapsibleContent>
                      {pref?.notificationsEnabled && (
                        <div className="border-t px-4 py-3 space-y-3">
                          {/* Header Row */}
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="flex-1">Event Type</span>
                            <span className="w-16 text-center">In-App</span>
                            <span className="w-16 text-center">Push</span>
                          </div>

                          {/* Event Rows */}
                          {EVENT_TYPES.map((event) => {
                            const Icon = event.icon;
                            const eventPref = pref.eventPreferences[event.id];

                            return (
                              <div key={event.id} className="flex items-center">
                                <div className="flex-1 flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{event.label}</span>
                                </div>
                                <div className="w-16 flex justify-center">
                                  <Switch
                                    checked={eventPref?.inApp ?? true}
                                    onCheckedChange={(checked) =>
                                      updateEventPref(
                                        store.id,
                                        event.id,
                                        "inApp",
                                        checked
                                      )
                                    }
                                    className="scale-75"
                                  />
                                </div>
                                <div className="w-16 flex justify-center">
                                  <Switch
                                    checked={
                                      eventPref?.push ?? event.defaultPush
                                    }
                                    onCheckedChange={(checked) =>
                                      updateEventPref(
                                        store.id,
                                        event.id,
                                        "push",
                                        checked
                                      )
                                    }
                                    disabled={
                                      !globalPrefs.pushEnabled ||
                                      pushPermission !== "granted"
                                    }
                                    className="scale-75"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!pref?.notificationsEnabled && (
                        <div className="border-t px-4 py-3">
                          <p className="text-sm text-muted-foreground text-center">
                            Notifications disabled for this store
                          </p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button onClick={savePreferences} disabled={isSaving}>
              {isSaving && <Spinner className="mr-2" />}
              Save Preferences
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Save button when no stores */}
      {stores.length === 0 && (
        <div className="flex justify-end">
          <Button onClick={savePreferences} disabled={isSaving}>
            {isSaving && <Spinner className="mr-2" />}
            Save Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
