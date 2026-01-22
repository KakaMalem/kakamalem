// Service Worker for Web Push Notifications
// Kaka Malem Order Alerts

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Push event - receives notification from server
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error("Failed to parse push data:", e);
    return;
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/badge-72x72.png",
    tag: data.tag || "order-notification",
    renotify: true,
    requireInteraction: data.requireInteraction ?? true,
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
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { url, orderId, tenantSlug } = event.notification.data || {};

  if (event.action === "dismiss") {
    return;
  }

  // Default action or 'view' action - open the order
  const targetUrl = url || `/dashboard/${tenantSlug}/orders/${orderId}`;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if dashboard is already open
        for (const client of windowClients) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Push subscription change event (handles browser subscription refresh)
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Re-register with server
        return fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
      .catch((error) => {
        console.error("Failed to resubscribe:", error);
      })
  );
});
