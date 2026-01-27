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
  };

  // Play custom notification sound via open clients
  const playSound = clients
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
