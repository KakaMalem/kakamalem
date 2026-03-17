import { db } from "@/lib/db";
import { notifications, tenantMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendPushToUsers, isVapidConfigured } from "@/lib/push";
import { filterByPreferences } from "@/lib/notifications/preferences";

// =============================================================================
// TYPES (same as original for backward compatibility)
// =============================================================================

export type SendNotificationResult = {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
};

export type OrderStatusNotificationType =
  | "order_confirmed"
  | "order_shipped"
  | "out_for_delivery"
  | "order_delivered"
  | "order_cancelled";

export type GenericNotificationPayload = {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  avatarUrl?: string;
};

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function insertNotificationsForUsers(
  userIds: string[],
  params: {
    tenantId: string | null;
    type: string;
    title: string;
    body: string;
    actionUrl?: string;
    actionLabel?: string;
    avatarUrl?: string;
    data?: Record<string, unknown>;
  }
): Promise<SendNotificationResult> {
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Filter by user/store preferences (if tenant-scoped)
  let inAppUserIds = userIds;
  let pushUserIds = userIds;

  if (params.tenantId) {
    const filtered = await filterByPreferences(
      userIds,
      params.tenantId,
      params.type
    );
    inAppUserIds = filtered.inAppUserIds;
    pushUserIds = filtered.pushUserIds;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Insert in-app notifications only for eligible users
  if (inAppUserIds.length > 0) {
    const hasPush = isVapidConfigured() && pushUserIds.length > 0;
    const rows = inAppUserIds.map((userId) => ({
      userId,
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      avatarUrl: params.avatarUrl,
      data: params.data || {},
      channelsSent:
        hasPush && pushUserIds.includes(userId)
          ? ["in_app", "push"]
          : ["in_app"],
    }));

    try {
      await db.insert(notifications).values(rows);
      sent = inAppUserIds.length;
    } catch (err) {
      console.error("[Notifications] Batch insert failed:", err);
      failed = inAppUserIds.length;
      errors.push(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Fire push notifications only for eligible users (non-blocking)
  if (pushUserIds.length > 0) {
    sendPushToUsers(pushUserIds, {
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      type: params.type,
    }).catch((err) => console.error("Push send failed:", err));
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function getEligibleStaffIds(
  tenantId: string,
  excludeUserId?: string
): Promise<string[]> {
  const eligibleMembers = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.role, ["owner", "admin", "staff"])
    ),
    columns: { userId: true },
  });

  return eligibleMembers
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);
}

// =============================================================================
// OWNER/STAFF NOTIFICATIONS
// =============================================================================

/**
 * Send new order notification to all owners/admins/staff of a tenant
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
    productNames?: string[];
  },
  excludeUserId?: string
): Promise<SendNotificationResult> {
  const userIds = await getEligibleStaffIds(tenantId, excludeUserId);
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const orderType = payload.isOffline ? "POS sale" : "New order";
  const title = `${orderType} #${payload.orderNumber}`;

  const productList =
    payload.productNames && payload.productNames.length > 0
      ? payload.productNames.slice(0, 2).join(", ") +
        (payload.productNames.length > 2
          ? ` +${payload.productNames.length - 2} more`
          : "")
      : "";

  const parts = [payload.customerName];
  if (productList) parts.push(productList);
  parts.push(`${payload.total} ${payload.currency}`);
  const body = parts.join(" • ");

  const actionUrl = `/dashboard/${tenantSlug}/orders/${payload.orderId}`;

  return insertNotificationsForUsers(userIds, {
    tenantId,
    type: "new_order",
    title,
    body,
    actionUrl,
    data: {
      soundType: "order",
      notificationType: "new_order",
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
  });
}

/**
 * Send order cancelled notification to all owners/admins/staff of a tenant
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
  const userIds = await getEligibleStaffIds(tenantId, excludeUserId);
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const title = `Cancelled #${payload.orderNumber}`;

  const bodyParts = [payload.customerName];
  if (payload.reason) {
    bodyParts.push(
      payload.reason.slice(0, 50) + (payload.reason.length > 50 ? "..." : "")
    );
  }
  bodyParts.push(`${payload.total} ${payload.currency}`);
  const body = bodyParts.join(" • ");

  const actionUrl = `/dashboard/${tenantSlug}/orders/${payload.orderId}`;

  return insertNotificationsForUsers(userIds, {
    tenantId,
    type: "order_cancelled",
    title,
    body,
    actionUrl,
    data: {
      soundType: "order",
      notificationType: "order_cancelled",
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      customerName: payload.customerName,
      total: payload.total,
      currency: payload.currency,
      storeName: payload.storeName,
      reason: payload.reason,
    },
  });
}

/**
 * Send low stock alert notification to all owners/admins/staff of a tenant
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
  const userIds = await getEligibleStaffIds(tenantId);
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const productDisplay = payload.variantName
    ? `${payload.productName} - ${payload.variantName}`
    : payload.productName;
  const title = `Low stock alert`;
  const body = `${productDisplay} • ${payload.currentStock} left`;
  const actionUrl = `/dashboard/${tenantSlug}/products/${payload.productId}`;

  return insertNotificationsForUsers(userIds, {
    tenantId,
    type: "low_stock",
    title,
    body,
    actionUrl,
    data: {
      soundType: "lowStock",
      notificationType: "low_stock",
      productId: payload.productId,
      productName: payload.productName,
      variantName: payload.variantName,
      currentStock: payload.currentStock,
      lowStockThreshold: payload.lowStockThreshold,
      storeName: payload.storeName,
    },
  });
}

/**
 * Send new review notification to all owners/admins/staff of a tenant
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
  const userIds = await getEligibleStaffIds(tenantId);
  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const stars = "★".repeat(payload.rating);
  const title = `${stars} New review`;
  const bodyParts = [payload.productName, payload.customerName];
  if (payload.comment) {
    const preview =
      payload.comment.slice(0, 60) + (payload.comment.length > 60 ? "..." : "");
    bodyParts.push(`"${preview}"`);
  }
  const body = bodyParts.join(" • ");
  const actionUrl = `/dashboard/${tenantSlug}/reviews?reviewId=${payload.reviewId}`;

  return insertNotificationsForUsers(userIds, {
    tenantId,
    type: "new_review",
    title,
    body,
    actionUrl,
    data: {
      soundType: "review",
      notificationType: "new_review",
      reviewId: payload.reviewId,
      productId: payload.productId,
      productName: payload.productName,
      customerName: payload.customerName,
      rating: payload.rating,
      comment: payload.comment,
      storeName: payload.storeName,
    },
  });
}

// =============================================================================
// CUSTOMER NOTIFICATIONS
// =============================================================================

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
    title: "Completed",
    bodyTemplate: "#{orderNumber} has been completed • {storeName}",
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

  let body = messageConfig.bodyTemplate
    .replace("{orderNumber}", payload.orderNumber)
    .replace("{storeName}", payload.storeName);

  if (payload.trackingNumber) {
    body = body.replace("{tracking}", ` • Track: ${payload.trackingNumber}`);
  } else {
    body = body.replace("{tracking}", "");
  }

  const actionUrl = `/store/${storeSlug}/account/orders/${payload.orderId}`;

  return insertNotificationsForUsers([userId], {
    tenantId,
    type: payload.type,
    title,
    body,
    actionUrl,
    data: {
      soundType: "order",
      notificationType: payload.type,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      storeName: payload.storeName,
      trackingNumber: payload.trackingNumber,
      estimatedDelivery: payload.estimatedDelivery,
    },
  });
}

// =============================================================================
// GENERIC USER NOTIFICATION
// =============================================================================

/**
 * Send a notification to a specific user.
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
  return insertNotificationsForUsers([userId], {
    tenantId: tenantId || null,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl,
    actionLabel: payload.actionLabel,
    avatarUrl: payload.avatarUrl,
    data: {
      soundType: "default",
      notificationType: payload.type,
      ...payload.data,
    },
  });
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
  const { wishlistItems } = await import("@/lib/db/schema");

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

  const title = "Back in stock";
  const body = `${payload.productName} • ${payload.price} ${payload.currency} • ${payload.storeName}`;
  const actionUrl = `/store/${tenantSlug}/product/${payload.productSlug}`;

  return insertNotificationsForUsers(userIds, {
    tenantId,
    type: "back_in_stock",
    title,
    body,
    actionUrl,
    avatarUrl: payload.imageUrl,
    data: {
      soundType: "default",
      notificationType: "back_in_stock",
      productId: payload.productId,
      productName: payload.productName,
      price: payload.price,
      currency: payload.currency,
      storeName: payload.storeName,
      imageUrl: payload.imageUrl,
    },
  });
}

// =============================================================================
// SUBSCRIPTION NOTIFICATIONS
// =============================================================================

/**
 * Send subscription renewal reminder to store owner/admin
 */
export async function sendSubscriptionRenewalReminder(params: {
  userId: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
  daysUntilExpiry: number;
  expiryDate: string;
}): Promise<SendNotificationResult> {
  const {
    userId,
    tenantId,
    storeName,
    storeSlug,
    daysUntilExpiry,
    expiryDate,
  } = params;

  const expiryDateFormatted = new Date(expiryDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  let title: string;
  let body: string;

  if (daysUntilExpiry === 1) {
    title = `Pro expires tomorrow`;
    body = `${storeName} subscription ends ${expiryDateFormatted}. Renew now to avoid interruption.`;
  } else if (daysUntilExpiry <= 3) {
    title = `Pro expires in ${daysUntilExpiry} days`;
    body = `${storeName} subscription ends ${expiryDateFormatted}. Renew to keep Pro features.`;
  } else {
    title = `Pro renewal reminder`;
    body = `${storeName} subscription expires ${expiryDateFormatted}. Renew early to avoid interruption.`;
  }

  const actionUrl = `/dashboard/${storeSlug}/billing`;

  return insertNotificationsForUsers([userId], {
    tenantId,
    type: "subscription_reminder",
    title,
    body,
    actionUrl,
    data: {
      soundType: "default",
      notificationType: "subscription_reminder",
      daysUntilExpiry,
      expiryDate,
      storeName,
    },
  });
}

/**
 * Send subscription expiration notification
 */
export async function sendSubscriptionExpiredNotification(params: {
  userId: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
}): Promise<SendNotificationResult> {
  const { userId, tenantId, storeName, storeSlug } = params;

  const title = `Pro subscription expired`;
  const body = `${storeName} is now on the Free plan. Upgrade to restore Pro features.`;
  const actionUrl = `/dashboard/${storeSlug}/billing`;

  return insertNotificationsForUsers([userId], {
    tenantId,
    type: "subscription_expired",
    title,
    body,
    actionUrl,
    data: {
      soundType: "default",
      notificationType: "subscription_expired",
      storeName,
    },
  });
}

/**
 * Send subscription paused notification
 */
export async function sendSubscriptionPausedNotification(params: {
  userId: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
  autoResumeDate?: string;
}): Promise<SendNotificationResult> {
  const { userId, tenantId, storeName, storeSlug, autoResumeDate } = params;

  const title = `Pro subscription paused`;
  const body = autoResumeDate
    ? `${storeName} is paused until ${new Date(autoResumeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
    : `${storeName} subscription is paused. Resume anytime from billing settings.`;
  const actionUrl = `/dashboard/${storeSlug}/billing`;

  return insertNotificationsForUsers([userId], {
    tenantId,
    type: "subscription_paused",
    title,
    body,
    actionUrl,
    data: {
      soundType: "default",
      notificationType: "subscription_paused",
      storeName,
      autoResumeDate,
    },
  });
}

/**
 * Send subscription resumed notification
 */
export async function sendSubscriptionResumedNotification(params: {
  userId: string;
  tenantId: string;
  storeName: string;
  storeSlug: string;
  creditsDays: number;
  newEndDate: string;
}): Promise<SendNotificationResult> {
  const { userId, tenantId, storeName, storeSlug, creditsDays, newEndDate } =
    params;

  const title = `Pro subscription resumed`;
  const creditsText =
    creditsDays > 0
      ? ` You've been credited ${creditsDays} days for the pause period.`
      : "";
  const body = `${storeName} is back to Pro.${creditsText} Next renewal: ${new Date(newEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`;
  const actionUrl = `/dashboard/${storeSlug}/billing`;

  return insertNotificationsForUsers([userId], {
    tenantId,
    type: "subscription_resumed",
    title,
    body,
    actionUrl,
    data: {
      soundType: "default",
      notificationType: "subscription_resumed",
      storeName,
      creditsDays,
      newEndDate,
    },
  });
}
