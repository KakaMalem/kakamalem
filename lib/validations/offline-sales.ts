import { z } from "zod";

// =============================================================================
// OFFLINE SALES VALIDATION SCHEMAS
// =============================================================================

/**
 * Payment method enum schema
 */
export const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "mobile_money",
  "bank_transfer",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Individual line item for offline sale
 */
export const offlineSaleItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid("Invalid variant ID").optional().nullable(),
  productName: z.string().min(1, "Product name is required"),
  variantName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  price: z.number().positive("Price must be positive"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  trackInventory: z.boolean().default(true),
});

export type OfflineSaleItem = z.infer<typeof offlineSaleItemSchema>;

/**
 * Full offline sale submission schema
 *
 * Simplified payment model:
 * - amountPaid: How much customer is paying now (0 = pay later, total = full payment)
 * - paymentMethod: Required only when amountPaid > 0
 *
 * Payment status is derived:
 * - amountPaid >= total: Fully paid
 * - amountPaid > 0 && amountPaid < total: Partially paid
 * - amountPaid === 0: Unpaid (pay later)
 */
export const recordOfflineSaleSchema = z
  .object({
    // Payment: amount received now (0 = pay later)
    amountPaid: z.number().min(0).default(0),

    // Payment method (required when amountPaid > 0)
    paymentMethod: paymentMethodSchema.optional().nullable(),

    // Customer info (optional for walk-in sales)
    customerName: z.string().max(255).optional().nullable(),
    customerPhone: z.string().max(50).optional().nullable(),
    customerEmail: z.string().email().optional().nullable(),

    // Line items
    items: z
      .array(offlineSaleItemSchema)
      .min(1, "At least one item is required"),

    // Financials
    discountAmount: z.number().min(0).default(0),

    // Notes
    staffNotes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      // Payment method is required when amount paid is greater than 0
      if (data.amountPaid > 0 && !data.paymentMethod) {
        return false;
      }
      return true;
    },
    {
      message: "Payment method is required when receiving payment",
      path: ["paymentMethod"],
    }
  );

export type RecordOfflineSaleInput = z.infer<typeof recordOfflineSaleSchema>;

/**
 * Schema for marking an order as paid (full payment)
 */
export const markOrderPaidSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  paymentMethod: paymentMethodSchema,
});

export type MarkOrderPaidInput = z.infer<typeof markOrderPaidSchema>;

/**
 * Schema for recording a partial payment on an order
 */
export const recordOrderPaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  amount: z.number().positive("Payment amount must be positive"),
  paymentMethod: paymentMethodSchema,
  notes: z.string().max(500).optional().nullable(),
});

export type RecordOrderPaymentInput = z.infer<typeof recordOrderPaymentSchema>;

/**
 * Filters for offline sales queries
 */
export const offlineSalesFiltersSchema = z.object({
  channel: z.enum(["pos", "all"]).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  isPaid: z.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type OfflineSalesFilters = z.infer<typeof offlineSalesFiltersSchema>;
