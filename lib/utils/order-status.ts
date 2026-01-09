// =============================================================================
// ORDER STATUS UTILITIES
// =============================================================================
// Shared utilities for order status display - can be used in client components

export type OrderStatusColor = "default" | "secondary" | "destructive" | "outline";

export interface OrderStatusInfo {
  label: string;
  color: OrderStatusColor;
}

/**
 * Get order status display info
 */
export function getOrderStatusInfo(status: string): OrderStatusInfo {
  const statusMap: Record<string, OrderStatusInfo> = {
    pending: { label: "Pending", color: "secondary" },
    confirmed: { label: "Confirmed", color: "default" },
    processing: { label: "Processing", color: "default" },
    shipped: { label: "Shipped", color: "default" },
    delivered: { label: "Delivered", color: "default" },
    cancelled: { label: "Cancelled", color: "destructive" },
    refunded: { label: "Refunded", color: "destructive" },
    partially_refunded: { label: "Partially Refunded", color: "outline" },
  };

  return statusMap[status] || { label: status, color: "secondary" };
}
