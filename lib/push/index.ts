import webpush from "web-push";
import { db } from "@/lib/db";
import {
  pushSubscriptions,
  tenantMembers,
  notifications,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

// Initialize web-push with VAPID keys
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:kakamalem.team@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// =============================================================================
// TYPES
// =============================================================================

export type PushNotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  orderId?: string;
  tenantSlug?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
  type?: "order" | "review" | "lowStock" | "default"; // For custom notification sounds
};

export type SendNotificationResult = {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
};

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Send push notification to all owners/admins of a tenant
 * Used for order alerts
 */
export async function sendOrderNotificationToTenant(
  tenantId: string,
  tenantSlug: string,
  payload: {
    orderNumber: string;
    orderId: string;
    customerName: string;
    total: string;
    currency: string;
    isOffline?: boolean;
    city?: string;
    storeName?: string;
    productNames?: string[]; // First 3 product names
  }
): Promise<SendNotificationResult> {
  // Get all users with owner/admin/staff role for this tenant
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin", "staff"])
    ),
    columns: { userId: true },
  });

  if (eligibleMembers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const userIds = eligibleMembers.map((m) => m.userId);

  // Build concise, scannable notification
  // Title format: "New order #1234" or "POS sale #1234"
  const orderType = payload.isOffline ? "POS sale" : "New order";
  const title = `${orderType} #${payload.orderNumber}`;

  // Build informative body: customer, items, total
  const productList =
    payload.productNames && payload.productNames.length > 0
      ? payload.productNames.slice(0, 2).join(", ") +
        (payload.productNames.length > 2
          ? ` +${payload.productNames.length - 2} more`
          : "")
      : "";

  // Format: "John • Blue T-Shirt, Jeans • 1,500 AFN"
  const parts = [payload.customerName];
  if (productList) parts.push(productList);
  parts.push(`${payload.total} ${payload.currency}`);
  const body = parts.join(" • ");

  const actionUrl = `/dashboard/${tenantSlug}/orders/${payload.orderId}`;

  // Store in-app notifications for all eligible users (always)
  await Promise.allSettled(
    userIds.map((userId) =>
      db.insert(notifications).values({
        userId,
        tenantId,
        type: "new_order",
        title,
        body,
        data: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          customerName: payload.customerName,
          total: payload.total,
          currency: payload.currency,
          isOffline: payload.isOffline || false,
          city: payload.city,
          storeName: payload.storeName,
          productNames: payload.productNames,
        },
        actionUrl,
        channelsSent: ["in_app"],
      })
    )
  );

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `order-${payload.orderId}`,
    url: actionUrl,
    orderId: payload.orderId,
    tenantSlug,
    requireInteraction: true,
    type: "order",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

/**
 * Send push notification to specific subscriptions
 */
async function sendPushNotifications(
  subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  payload: PushNotificationPayload
): Promise<SendNotificationResult> {
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          }
        );

        // Update last used timestamp
        await db
          .update(pushSubscriptions)
          .set({
            lastUsedAt: new Date().toISOString(),
            failCount: 0,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(pushSubscriptions.id, sub.id));

        return { success: true, id: sub.id };
      } catch (error) {
        // Handle subscription expiration/unsubscription
        if (error instanceof webpush.WebPushError) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            // Subscription no longer valid - deactivate
            await db
              .update(pushSubscriptions)
              .set({
                isActive: false,
                failedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(pushSubscriptions.id, sub.id));
          } else {
            // Other error - increment fail count
            await db
              .update(pushSubscriptions)
              .set({
                failCount: sql`${pushSubscriptions.failCount} + 1`,
                failedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(pushSubscriptions.id, sub.id));
          }
        }
        throw error;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message || "Unknown error");

  return {
    success: failed === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Check if web push is configured
 */
export function isPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  );
}

/**
 * Send order cancelled notification to all owners/admins of a tenant
 * @param excludeUserId - Optional user ID to exclude (e.g., the person who cancelled)
 */
export async function sendOrderCancelledNotification(
  tenantId: string,
  tenantSlug: string,
  payload: {
    orderNumber: string;
    orderId: string;
    customerName: string;
    total: string;
    currency: string;
    storeName?: string;
    reason?: string;
  },
  excludeUserId?: string
): Promise<SendNotificationResult> {
  // Get all users with owner/admin/staff role for this tenant
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin", "staff"])
    ),
    columns: { userId: true },
  });

  if (eligibleMembers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Exclude the user who performed the action (they already know)
  const userIds = eligibleMembers
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);

  // No one left to notify after excluding the actor
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Concise title with order number
  const title = `Cancelled #${payload.orderNumber}`;

  // Body: customer, reason (if any), total
  const bodyParts = [payload.customerName];
  if (payload.reason) {
    bodyParts.push(
      payload.reason.slice(0, 50) + (payload.reason.length > 50 ? "..." : "")
    );
  }
  bodyParts.push(`${payload.total} ${payload.currency}`);
  const body = bodyParts.join(" • ");

  const actionUrl = `/dashboard/${tenantSlug}/orders/${payload.orderId}`;

  // Store in-app notifications for all eligible users (always)
  await Promise.allSettled(
    userIds.map((userId) =>
      db.insert(notifications).values({
        userId,
        tenantId,
        type: "order_cancelled",
        title,
        body,
        data: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          customerName: payload.customerName,
          total: payload.total,
          currency: payload.currency,
          storeName: payload.storeName,
          reason: payload.reason,
        },
        actionUrl,
        channelsSent: ["in_app"],
      })
    )
  );

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `order-cancelled-${payload.orderId}`,
    url: actionUrl,
    orderId: payload.orderId,
    tenantSlug,
    requireInteraction: true,
    type: "order",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

/**
 * Send low stock alert notification to all owners/admins of a tenant
 */
export async function sendLowStockNotification(
  tenantId: string,
  tenantSlug: string,
  payload: {
    productId: string;
    productName: string;
    currentStock: number;
    lowStockThreshold: number;
    storeName?: string;
    variantName?: string;
  }
): Promise<SendNotificationResult> {
  // Get all users with owner/admin/staff role for this tenant
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin", "staff"])
    ),
    columns: { userId: true },
  });

  if (eligibleMembers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const userIds = eligibleMembers.map((m) => m.userId);

  // Direct, actionable title
  const productDisplay = payload.variantName
    ? `${payload.productName} - ${payload.variantName}`
    : payload.productName;
  const title = `Low stock alert`;
  const body = `${productDisplay} • ${payload.currentStock} left`;

  const actionUrl = `/dashboard/${tenantSlug}/products/${payload.productId}`;

  // Store in-app notifications for all eligible users (always)
  await Promise.allSettled(
    userIds.map((userId) =>
      db.insert(notifications).values({
        userId,
        tenantId,
        type: "low_stock",
        title,
        body,
        data: {
          productId: payload.productId,
          productName: payload.productName,
          variantName: payload.variantName,
          currentStock: payload.currentStock,
          lowStockThreshold: payload.lowStockThreshold,
          storeName: payload.storeName,
        },
        actionUrl,
        channelsSent: ["in_app"],
      })
    )
  );

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `low-stock-${payload.productId}`,
    url: actionUrl,
    tenantSlug,
    requireInteraction: false,
    type: "lowStock",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

/**
 * Send new review notification to all owners/admins of a tenant
 */
export async function sendNewReviewNotification(
  tenantId: string,
  tenantSlug: string,
  payload: {
    reviewId: string;
    productId: string;
    productName: string;
    customerName: string;
    rating: number;
    comment?: string;
    storeName?: string;
  }
): Promise<SendNotificationResult> {
  // Get all users with owner/admin/staff role for this tenant
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin", "staff"])
    ),
    columns: { userId: true },
  });

  if (eligibleMembers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const userIds = eligibleMembers.map((m) => m.userId);

  // Concise title with rating
  const stars = "★".repeat(payload.rating);
  const title = `${stars} New review`;
  // Body: product name, customer, and comment preview
  const bodyParts = [payload.productName, payload.customerName];
  if (payload.comment) {
    const preview =
      payload.comment.slice(0, 60) + (payload.comment.length > 60 ? "..." : "");
    bodyParts.push(`"${preview}"`);
  }
  const body = bodyParts.join(" • ");

  const actionUrl = `/dashboard/${tenantSlug}/products/${payload.productId}#reviews`;

  // Store in-app notifications for all eligible users (always)
  await Promise.allSettled(
    userIds.map((userId) =>
      db.insert(notifications).values({
        userId,
        tenantId,
        type: "new_review",
        title,
        body,
        data: {
          reviewId: payload.reviewId,
          productId: payload.productId,
          productName: payload.productName,
          customerName: payload.customerName,
          rating: payload.rating,
          comment: payload.comment,
          storeName: payload.storeName,
        },
        actionUrl,
        channelsSent: ["in_app"],
      })
    )
  );

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `review-${payload.reviewId}`,
    url: actionUrl,
    tenantSlug,
    requireInteraction: false,
    type: "review",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

// =============================================================================
// CUSTOMER NOTIFICATIONS
// =============================================================================

export type OrderStatusNotificationType =
  | "order_confirmed"
  | "order_shipped"
  | "out_for_delivery"
  | "order_delivered"
  | "order_cancelled";

// Modern, concise notification messages for customers
// Following patterns: short title, informative body, actionable context
const ORDER_STATUS_MESSAGES: Record<
  OrderStatusNotificationType,
  { title: string; bodyTemplate: string }
> = {
  order_confirmed: {
    title: "Order confirmed",
    bodyTemplate: "#{orderNumber} is being prepared • {storeName}",
  },
  order_shipped: {
    title: "Order shipped",
    bodyTemplate: "#{orderNumber} is on its way{tracking} • {storeName}",
  },
  out_for_delivery: {
    title: "Arriving today",
    bodyTemplate: "#{orderNumber} is out for delivery • {storeName}",
  },
  order_delivered: {
    title: "Delivered",
    bodyTemplate: "#{orderNumber} has been delivered • {storeName}",
  },
  order_cancelled: {
    title: "Order cancelled",
    bodyTemplate: "#{orderNumber} has been cancelled • {storeName}",
  },
};

/**
 * Send order status notification to a customer
 */
export async function sendCustomerOrderStatusNotification(
  userId: string,
  tenantId: string,
  storeSlug: string,
  payload: {
    type: OrderStatusNotificationType;
    orderId: string;
    orderNumber: string;
    storeName: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  }
): Promise<SendNotificationResult> {
  const messageConfig = ORDER_STATUS_MESSAGES[payload.type];
  const title = messageConfig.title;

  // Build body with template substitution
  let body = messageConfig.bodyTemplate
    .replace("{orderNumber}", payload.orderNumber)
    .replace("{storeName}", payload.storeName);

  // Add tracking info inline if available
  if (payload.trackingNumber) {
    body = body.replace("{tracking}", ` • Track: ${payload.trackingNumber}`);
  } else {
    body = body.replace("{tracking}", "");
  }

  const actionUrl = `/store/${storeSlug}/account/orders/${payload.orderId}`;

  // Store in-app notification
  await db.insert(notifications).values({
    userId,
    tenantId,
    type: payload.type,
    title,
    body,
    data: {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      storeName: payload.storeName,
      trackingNumber: payload.trackingNumber,
      estimatedDelivery: payload.estimatedDelivery,
    },
    actionUrl,
    channelsSent: ["in_app"],
  });

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for this user for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.isActive, true)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `order-status-${payload.orderId}`,
    url: actionUrl,
    orderId: payload.orderId,
    tenantSlug: storeSlug,
    requireInteraction: payload.type === "out_for_delivery",
    type: "order",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

// =============================================================================
// GENERIC USER NOTIFICATION
// =============================================================================

export type GenericNotificationPayload = {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  avatarUrl?: string;
};

/**
 * Send a notification to a specific user (with optional push)
 * Used for user-targeted notifications like transfer requests, invitations, etc.
 */
export async function sendNotificationToUser({
  userId,
  tenantId,
  payload,
}: {
  userId: string;
  tenantId?: string;
  payload: GenericNotificationPayload;
}): Promise<SendNotificationResult> {
  // Store in-app notification
  await db.insert(notifications).values({
    userId,
    tenantId: tenantId || null,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    actionUrl: payload.actionUrl,
    avatarUrl: payload.avatarUrl,
    channelsSent: ["in_app"],
  });

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for this user
  const whereConditions = [
    eq(pushSubscriptions.userId, userId),
    eq(pushSubscriptions.isActive, true),
  ];
  if (tenantId) {
    whereConditions.push(eq(pushSubscriptions.tenantId, tenantId));
  }

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(...whereConditions),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title: payload.title,
    body: payload.body,
    tag: `${payload.type}-${Date.now()}`,
    url: payload.actionUrl,
    requireInteraction: false,
    type: "default",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}

/**
 * Send back in stock notification to customers who have it on their wishlist
 */
export async function sendBackInStockNotification(
  tenantId: string,
  tenantSlug: string,
  payload: {
    productId: string;
    productName: string;
    productSlug: string;
    price: string;
    currency: string;
    storeName: string;
    imageUrl?: string;
  }
): Promise<SendNotificationResult> {
  // Import wishlist items to find interested customers
  const { wishlistItems } = await import("@/lib/db/schema");

  // Get all users who have this product in their wishlist for this store
  const interestedUsers = await db.query.wishlistItems.findMany({
    where: and(
      eq(wishlistItems.tenantId, tenantId),
      eq(wishlistItems.productId, payload.productId)
    ),
    with: {
      wishlist: {
        columns: { userId: true },
      },
    },
  });

  if (interestedUsers.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const userIds = [
    ...new Set(
      interestedUsers.map((item) => item.wishlist?.userId).filter(Boolean)
    ),
  ] as string[];

  // Concise, actionable notification
  const title = "Back in stock";
  const body = `${payload.productName} • ${payload.price} ${payload.currency} • ${payload.storeName}`;
  const actionUrl = `/store/${tenantSlug}/product/${payload.productSlug}`;

  // Store in-app notifications for all interested users
  await Promise.allSettled(
    userIds.map((userId) =>
      db.insert(notifications).values({
        userId,
        tenantId,
        type: "back_in_stock",
        title,
        body,
        data: {
          productId: payload.productId,
          productName: payload.productName,
          price: payload.price,
          currency: payload.currency,
          storeName: payload.storeName,
        },
        actionUrl,
        avatarUrl: payload.imageUrl,
        channelsSent: ["in_app"],
      })
    )
  );

  // Check if push is configured
  if (!isPushConfigured()) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Get active push subscriptions for these users for this tenant
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
      inArray(pushSubscriptions.userId, userIds)
    ),
  });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const notificationPayload: PushNotificationPayload = {
    title,
    body,
    tag: `back-in-stock-${payload.productId}`,
    url: actionUrl,
    tenantSlug,
    requireInteraction: false,
    type: "default",
  };

  return sendPushNotifications(subscriptions, notificationPayload);
}
