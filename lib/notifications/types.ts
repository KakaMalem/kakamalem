// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

/**
 * Notification object as returned from the database
 */
export interface Notification {
  id: string;
  userId: string;
  tenantId: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  actionUrl: string | null;
  actionLabel: string | null;
  avatarUrl: string | null;
  readAt: string | null;
  archivedAt: string | null;
  channelsSent: string[] | null;
  novuMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * SSE message types
 */
export type SSEMessageType =
  | "notification" // New notification
  | "read" // Notification marked as read
  | "read_all" // All notifications marked as read
  | "connected" // Initial connection acknowledgment
  | "heartbeat"; // Keep-alive

/**
 * SSE message payload
 */
export interface SSEMessage {
  type: SSEMessageType;
  notification?: Notification;
  notificationId?: string;
  tenantId?: string;
  timestamp?: string;
}

/**
 * Notification types for store owners/staff
 */
export const OWNER_NOTIFICATION_TYPES = [
  "new_order",
  "order_cancelled",
  "low_stock",
  "new_review",
] as const;

/**
 * Notification types for customers
 */
export const CUSTOMER_NOTIFICATION_TYPES = [
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "back_in_stock",
] as const;

export type OwnerNotificationType = (typeof OWNER_NOTIFICATION_TYPES)[number];
export type CustomerNotificationType =
  (typeof CUSTOMER_NOTIFICATION_TYPES)[number];
export type NotificationType = OwnerNotificationType | CustomerNotificationType;
