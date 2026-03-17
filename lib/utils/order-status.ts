// =============================================================================
// ORDER STATUS UTILITIES
// =============================================================================
// Shared utilities for order status display - can be used in client components

export type OrderStatusColor =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

export interface OrderStatusInfo {
  label: string;
  color: OrderStatusColor;
}

export type FulfillmentType =
  | "shipping"
  | "pickup"
  | "instant"
  | "local_delivery"
  | "curbside";
export type OrderChannel = "online" | "pos" | "social";

/**
 * Get order status display info
 * Note: Order status represents FULFILLMENT status only.
 * Payment status (refunded, partial_refund) is tracked separately.
 */
export function getOrderStatusInfo(status: string): OrderStatusInfo {
  const statusMap: Record<string, OrderStatusInfo> = {
    pending: { label: "Placed", color: "secondary" },
    confirmed: { label: "Confirmed", color: "default" },
    processing: { label: "Preparing", color: "default" },
    shipped: { label: "Shipped", color: "default" },
    delivered: { label: "Completed", color: "default" },
    returned: { label: "Returned", color: "outline" },
    cancelled: { label: "Cancelled", color: "destructive" },
  };

  return statusMap[status] || { label: status, color: "secondary" };
}

/**
 * Get order status display info with context-aware labels
 * For local delivery, pickup, and POS, uses refined modern terminology
 */
export function getOrderStatusInfoWithContext(
  status: string,
  fulfillmentType?: FulfillmentType | null,
  channel?: OrderChannel | null
): OrderStatusInfo {
  const isInstant = fulfillmentType === "instant" || channel === "pos";
  const isPickup =
    fulfillmentType === "pickup" || fulfillmentType === "curbside";
  const isLocalDelivery = fulfillmentType === "local_delivery";

  // POS context: focus on payment and finalization
  if (isInstant) {
    const posStatusMap: Record<string, OrderStatusInfo> = {
      pending: { label: "Awaiting Payment", color: "secondary" },
      confirmed: { label: "Completed", color: "default" },
      processing: { label: "Processing", color: "default" },
      shipped: { label: "Completed", color: "default" },
      delivered: { label: "Completed", color: "default" },
      returned: { label: "Returned", color: "outline" },
      cancelled: { label: "Cancelled", color: "destructive" },
    };
    return posStatusMap[status] || { label: status, color: "secondary" };
  }

  // Pickup context: focus on collection readiness
  if (isPickup) {
    const pickupStatusMap: Record<string, OrderStatusInfo> = {
      pending: { label: "Placed", color: "secondary" },
      confirmed: { label: "Confirmed", color: "default" },
      processing: { label: "Ready for Collection", color: "default" },
      shipped: { label: "Collected", color: "default" },
      delivered: { label: "Collected", color: "default" },
      returned: { label: "Returned", color: "outline" },
      cancelled: { label: "Cancelled", color: "destructive" },
    };
    return pickupStatusMap[status] || { label: status, color: "secondary" };
  }

  // Local Delivery context: focus on real-time transit status
  if (isLocalDelivery) {
    const localStatusMap: Record<string, OrderStatusInfo> = {
      pending: { label: "Placed", color: "secondary" },
      confirmed: { label: "Confirmed", color: "default" },
      processing: { label: "Packing", color: "default" },
      shipped: { label: "Out for Delivery", color: "default" },
      delivered: { label: "Completed", color: "default" },
      returned: { label: "Returned", color: "outline" },
      cancelled: { label: "Cancelled", color: "destructive" },
    };
    return localStatusMap[status] || { label: status, color: "secondary" };
  }

  // Default Shipping context
  return getOrderStatusInfo(status);
}

/**
 * Get channel display label
 */
export function getChannelLabel(channel?: OrderChannel | null): string {
  const labels: Record<string, string> = {
    online: "Online",
    pos: "In-Store",
    phone: "Phone",
    social: "Social",
  };
  return channel ? labels[channel] || channel : "Online";
}

/**
 * Get fulfillment type display label
 */
export function getFulfillmentLabel(
  fulfillmentType?: FulfillmentType | null
): string {
  const labels: Record<string, string> = {
    shipping: "Shipping",
    pickup: "Pickup",
    instant: "In-Store",
    local_delivery: "Local Delivery",
    curbside: "Curbside",
  };
  return fulfillmentType
    ? labels[fulfillmentType] || fulfillmentType
    : "Shipping";
}
