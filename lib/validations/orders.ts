import { z } from "zod";

// =============================================================================
// ORDER VALIDATION SCHEMAS
// =============================================================================

export const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

export type OrderStatusType = z.infer<typeof orderStatusSchema>;

// Valid status transitions for basic workflow
export const STATUS_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["refunded", "partially_refunded"],
  cancelled: [], // Terminal state
  refunded: [], // Terminal state
  partially_refunded: ["refunded"],
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
