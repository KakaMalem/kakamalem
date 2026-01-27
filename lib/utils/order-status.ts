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
export type OrderChannel = "online" | "pos" | "marketplace" | "social";

/**
 * Get order status display info
 * Note: Order status represents FULFILLMENT status only.
 * Payment status (refunded, partial_refund) is tracked separately.
 */
export function getOrderStatusInfo(status: string): OrderStatusInfo {
  const statusMap: Record<string, OrderStatusInfo> = {
    pending: { label: "Pending", color: "secondary" },
    confirmed: { label: "Confirmed", color: "default" },
    processing: { label: "Processing", color: "default" },
    shipped: { label: "Shipped", color: "default" },
    delivered: { label: "Delivered", color: "default" },
    returned: { label: "Returned", color: "outline" },
    cancelled: { label: "Cancelled", color: "destructive" },
  };

  return statusMap[status] || { label: status, color: "secondary" };
}

/**
 * Get order status display info with context-aware labels
 * For instant/POS fulfillment, uses more appropriate terminology
 */
export function getOrderStatusInfoWithContext(
  status: string,
  fulfillmentType?: FulfillmentType | null,
  channel?: OrderChannel | null
): OrderStatusInfo {
  const isInstant = fulfillmentType === "instant" || channel === "pos";
  const isPickup =
    fulfillmentType === "pickup" || fulfillmentType === "curbside";

  // For instant fulfillment (POS), use different labels
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

  // For pickup orders (BOPIS, curbside)
  if (isPickup) {
    const pickupStatusMap: Record<string, OrderStatusInfo> = {
      pending: { label: "Pending", color: "secondary" },
      confirmed: { label: "Confirmed", color: "default" },
      processing: { label: "Ready for Pickup", color: "default" },
      shipped: { label: "Picked Up", color: "default" },
      delivered: { label: "Picked Up", color: "default" },
      returned: { label: "Returned", color: "outline" },
      cancelled: { label: "Cancelled", color: "destructive" },
    };
    return pickupStatusMap[status] || { label: status, color: "secondary" };
  }

  // Default: standard shipping status labels
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
    marketplace: "Marketplace",
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
