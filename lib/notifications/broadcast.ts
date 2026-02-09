// =============================================================================
// REAL-TIME NOTIFICATION BROADCAST SERVICE
// =============================================================================
// Uses Server-Sent Events (SSE) for instant notification delivery
// Sub-100ms latency compared to 30s polling
// =============================================================================

import type { Notification } from "./types";

// Store connected clients per user
// Map<userId, Set<ReadableStreamDefaultController>>
const connectedClients = new Map<
  string,
  Set<ReadableStreamDefaultController<Uint8Array>>
>();

// Store client metadata for debugging
const clientMetadata = new Map<
  ReadableStreamDefaultController<Uint8Array>,
  { userId: string; tenantId?: string; connectedAt: Date }
>();

/**
 * Register a new SSE client connection
 */
export function registerClient(
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  tenantId?: string
): void {
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId)!.add(controller);
  clientMetadata.set(controller, {
    userId,
    tenantId,
    connectedAt: new Date(),
  });

  console.log(
    `[SSE] Client connected: userId=${userId}, tenantId=${tenantId || "all"}, total=${connectedClients.get(userId)!.size}`
  );
}

/**
 * Remove a client connection (on disconnect or error)
 */
export function unregisterClient(
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  const metadata = clientMetadata.get(controller);
  if (metadata) {
    const userClients = connectedClients.get(metadata.userId);
    if (userClients) {
      userClients.delete(controller);
      if (userClients.size === 0) {
        connectedClients.delete(metadata.userId);
      }
    }
    clientMetadata.delete(controller);
    console.log(
      `[SSE] Client disconnected: userId=${metadata.userId}, remaining=${userClients?.size || 0}`
    );
  }
}

/**
 * Broadcast a notification to a specific user's connected clients
 * Returns the number of clients that received the notification
 */
export function broadcastToUser(
  userId: string,
  notification: Notification,
  tenantId?: string
): number {
  const userClients = connectedClients.get(userId);
  if (!userClients || userClients.size === 0) {
    return 0;
  }

  const encoder = new TextEncoder();
  const data = JSON.stringify({
    type: "notification",
    notification,
  });
  const message = encoder.encode(`data: ${data}\n\n`);

  let sentCount = 0;
  const failedControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

  for (const controller of userClients) {
    try {
      // If tenantId filter is specified, check if client is subscribed to that tenant
      const metadata = clientMetadata.get(controller);
      if (tenantId && metadata?.tenantId && metadata.tenantId !== tenantId) {
        continue; // Skip clients subscribed to different tenants
      }

      controller.enqueue(message);
      sentCount++;
    } catch {
      // Client disconnected, mark for removal
      failedControllers.push(controller);
    }
  }

  // Clean up failed connections
  for (const controller of failedControllers) {
    unregisterClient(controller);
  }

  if (sentCount > 0) {
    console.log(
      `[SSE] Broadcast to userId=${userId}: ${sentCount} client(s) received notification`
    );
  }

  return sentCount;
}

/**
 * Broadcast to multiple users (e.g., all store staff)
 */
export function broadcastToUsers(
  userIds: string[],
  notification: Notification,
  tenantId?: string
): number {
  let totalSent = 0;
  for (const userId of userIds) {
    totalSent += broadcastToUser(userId, notification, tenantId);
  }
  return totalSent;
}

/**
 * Send a heartbeat to keep connections alive
 * Should be called periodically (e.g., every 30 seconds)
 */
export function sendHeartbeat(): void {
  const encoder = new TextEncoder();
  const message = encoder.encode(`: heartbeat\n\n`);

  for (const [_userId, controllers] of connectedClients) {
    const failedControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

    for (const controller of controllers) {
      try {
        controller.enqueue(message);
      } catch {
        failedControllers.push(controller);
      }
    }

    for (const controller of failedControllers) {
      unregisterClient(controller);
    }
  }
}

/**
 * Get stats about connected clients (for debugging/monitoring)
 */
export function getConnectionStats(): {
  totalUsers: number;
  totalConnections: number;
  userBreakdown: Record<string, number>;
} {
  const userBreakdown: Record<string, number> = {};
  let totalConnections = 0;

  for (const [userId, controllers] of connectedClients) {
    userBreakdown[userId] = controllers.size;
    totalConnections += controllers.size;
  }

  return {
    totalUsers: connectedClients.size,
    totalConnections,
    userBreakdown,
  };
}

// Start heartbeat interval (keeps connections alive through proxies/load balancers)
if (typeof setInterval !== "undefined") {
  setInterval(sendHeartbeat, 30000);
}
