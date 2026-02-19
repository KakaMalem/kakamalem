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

// =============================================================================
// WEB PUSH NOTIFICATIONS
// =============================================================================

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "New notification";
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body || "",
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
    data: { actionUrl: data.actionUrl },
    tag: data.type || "default",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl =
    (event.notification.data as { actionUrl?: string })?.actionUrl ||
    "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus any existing tab from our origin
        for (const client of windowClients) {
          if ("focus" in client) {
            return client.focus().then((c) => c.navigate(actionUrl));
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(actionUrl);
      })
  );
});
