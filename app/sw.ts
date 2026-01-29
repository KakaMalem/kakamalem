import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Type declarations for the service worker global scope
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Initialize Serwist with precaching and runtime caching
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ============================================================================
// PUSH NOTIFICATION HANDLERS (migrated from public/sw.js)
// ============================================================================

interface PushData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  url?: string;
  orderId?: string;
  tenantSlug?: string;
  type?: string;
  actions?: Array<{ action: string; title: string }>;
}

// Push event - receives notification from server
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let data: PushData;
  try {
    data = event.data.json() as PushData;
  } catch (e) {
    console.error("Failed to parse push data:", e);
    return;
  }

  // Note: Some notification options (renotify, actions, vibrate, timestamp) are
  // valid in browsers but not in TypeScript's NotificationOptions type
  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/badge-72x72.png",
    tag: data.tag || "order-notification",
    renotify: true,
    requireInteraction: data.requireInteraction ?? true,
    silent: true, // Disable default browser sound - we play our own
    data: {
      url: data.url,
      orderId: data.orderId,
      tenantSlug: data.tenantSlug,
    },
    actions: data.actions || [
      { action: "view", title: "View Order" },
      { action: "dismiss", title: "Dismiss" },
    ],
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  } satisfies NotificationOptions & Record<string, unknown>;

  // Play custom notification sound via open clients
  const playSound = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      // Send message to all open windows to play sound
      // Only one will actually play it (the first to receive)
      windowClients.forEach((client) => {
        client.postMessage({
          type: "PLAY_NOTIFICATION_SOUND",
          notificationType: data.type || "order",
        });
      });
    });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      playSound,
    ])
  );
});

// Notification click event
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const notificationData = event.notification.data as {
    url?: string;
    orderId?: string;
    tenantSlug?: string;
  } | null;

  const { url, orderId, tenantSlug } = notificationData || {};

  if (event.action === "dismiss") {
    return;
  }

  // Default action or 'view' action - open the order
  const targetUrl = url || `/dashboard/${tenantSlug}/orders/${orderId}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if dashboard is already open
        for (const client of windowClients) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            (client as WindowClient).navigate(targetUrl);
            return (client as WindowClient).focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Push subscription change event (handles browser subscription refresh)
self.addEventListener("pushsubscriptionchange", (event: Event) => {
  const pushEvent = event as PushSubscriptionChangeEvent;

  (event as ExtendableEvent).waitUntil(
    self.registration.pushManager
      .subscribe(
        pushEvent.oldSubscription?.options as PushSubscriptionOptionsInit
      )
      .then((subscription) => {
        // Re-register with server
        return fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint: pushEvent.oldSubscription?.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
      .catch((error) => {
        console.error("Failed to resubscribe:", error);
      })
  );
});
