"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  saveCustomerPushSubscription,
  getCustomerPushStatus,
} from "@/lib/actions/push-notifications";

interface NotificationPromptProps {
  tenantId: string;
  storeName: string;
  isLoggedIn: boolean;
  className?: string;
}

type PromptState =
  | "checking" // Checking browser support and existing subscription
  | "show" // Show the prompt
  | "subscribing" // Subscribing in progress
  | "subscribed" // Successfully subscribed
  | "denied" // User denied or browser blocked
  | "hidden"; // Don't show (unsupported, already subscribed, etc.)

export function NotificationPrompt({
  tenantId,
  storeName,
  isLoggedIn,
  className,
}: NotificationPromptProps) {
  const [state, setState] = useState<PromptState>("checking");
  const [dismissed, setDismissed] = useState(false);

  // Check if push notifications are supported
  const checkSupport = useCallback(async () => {
    // Not logged in - can't save subscription
    if (!isLoggedIn) {
      setState("hidden");
      return;
    }

    // Check browser support
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("hidden");
      return;
    }

    // Check VAPID key is configured
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState("hidden");
      return;
    }

    // Check if already denied
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Check if already granted and subscribed
    if (Notification.permission === "granted") {
      try {
        const status = await getCustomerPushStatus(tenantId);
        if (status.hasSubscription && status.pushEnabled) {
          setState("hidden"); // Already subscribed
          return;
        }
      } catch {
        // Ignore errors, show prompt anyway
      }
    }

    // Show the prompt
    setState("show");
  }, [tenantId, isLoggedIn]);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  // Handle subscribe
  const handleSubscribe = async () => {
    setState("subscribing");

    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState("denied");
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });

      // Extract keys
      const json = subscription.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };

      // Save to server
      const result = await saveCustomerPushSubscription({
        tenantId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });

      if (result.success) {
        setState("subscribed");
        toast.success("You'll receive order updates as push notifications");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      setState("show"); // Allow retry
      toast.error("Could not enable notifications. Please try again.");
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setDismissed(true);
    setState("hidden");
  };

  // Don't render if checking, hidden, or dismissed
  if (state === "checking" || state === "hidden" || dismissed) {
    return null;
  }

  // Subscribed state - show success message briefly
  if (state === "subscribed") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm",
          className
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100">
          <Check className="size-4 text-green-600" />
        </div>
        <p className="text-green-700">
          You&apos;ll receive order updates as push notifications
        </p>
      </div>
    );
  }

  // Denied state - show info message
  if (state === "denied") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-3 text-sm",
          className
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <BellOff className="size-4 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">
          Notifications are blocked. You can enable them in your browser
          settings.
        </p>
      </div>
    );
  }

  // Show/subscribing state - show prompt
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3",
        className
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Get order updates</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Receive push notifications when {storeName} ships your order
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleDismiss}
          disabled={state === "subscribing"}
        >
          <X className="size-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={handleSubscribe}
          disabled={state === "subscribing"}
        >
          {state === "subscribing" ? "..." : "Enable"}
        </Button>
      </div>
    </div>
  );
}
