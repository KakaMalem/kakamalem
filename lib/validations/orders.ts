import { z } from "zod";

// =============================================================================
// ORDER VALIDATION SCHEMAS
// =============================================================================

// Order status represents FULFILLMENT/DELIVERY status only
// Payment status is tracked separately via paymentStatus field
export const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
]);

export type OrderStatusType = z.infer<typeof orderStatusSchema>;

export const STATUS_LABELS: Record<OrderStatusType, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

// Statuses that require confirmation before changing
export const DESTRUCTIVE_STATUSES: OrderStatusType[] = [
  "cancelled",
  "returned",
];

export const ALL_STATUSES: OrderStatusType[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
];

// Valid status transitions for fulfillment workflow
// Note: Refunds are handled separately via payment status, not order status
export const STATUS_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned", "cancelled"],
  delivered: ["returned"], // Can mark as returned after delivery (RTO, return request)
  returned: [], // Terminal state for fulfillment
  cancelled: [], // Terminal state
};

export function isValidStatusTransition(
  currentStatus: OrderStatusType,
  newStatus: OrderStatusType
): boolean {
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

export function getValidNextStatuses(
  currentStatus: OrderStatusType
): OrderStatusType[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

// Schema for updating order status
export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  status: orderStatusSchema,
  staffNote: z
    .string()
    .max(1000, "Note must be 1000 characters or less")
    .optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Schema for bulk status update
export const bulkUpdateOrderStatusSchema = z.object({
  orderIds: z.array(z.string().uuid("Invalid order ID")).min(1),
  status: orderStatusSchema,
});

export type BulkUpdateOrderStatusInput = z.infer<
  typeof bulkUpdateOrderStatusSchema
>;

// Schema for updating staff notes
export const updateStaffNotesSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  notes: z.string().max(5000, "Notes must be 5000 characters or less"),
});

export type UpdateStaffNotesInput = z.infer<typeof updateStaffNotesSchema>;

// Schema for order filters (URL search params)
export const orderFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  status: orderStatusSchema.or(z.literal("all")).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(25).max(500).optional(),
  sort: z.enum(["createdAt", "total", "status", "orderNumber"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>;
