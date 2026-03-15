/**
 * Unified Order Calculation Utilities
 *
 * Single source of truth for all order financial calculations.
 * Handles: subtotals, discounts, taxes, shipping, payments, refunds, and overpayments.
 */

import { z } from "zod";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Order financial state - all money values as numbers for calculations
 */
export interface OrderFinancials {
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  amountPaid: number;
  amountRefunded: number;
}

/**
 * Payment state derived from financials
 */
export interface PaymentState {
  /** Total amount paid (after refunds) */
  netPaid: number;
  /** Amount remaining to be paid (0 if fully paid or overpaid) */
  amountDue: number;
  /** Amount overpaid (0 if not overpaid) */
  creditAmount: number;
  /** Has overpayment (customer credit due) */
  hasOverpayment: boolean;
  /** Percentage paid (capped at 100) */
  paidPercentage: number;
  /** Raw percentage (can exceed 100) */
  rawPercentage: number;
  /** Payment status label */
  status: PaymentStatus;
  /** Is fully paid (including overpaid) */
  isFullyPaid: boolean;
  /** Has any payment */
  hasPayment: boolean;
}

export type PaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "overpaid"
  | "refunded"
  | "partial_refund";

/**
 * Discount calculation input
 */
export interface DiscountInput {
  type: "percent" | "amount";
  value: number;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const orderFinancialsSchema = z.object({
  subtotal: z.number().min(0),
  shippingTotal: z.number().min(0),
  taxTotal: z.number().min(0),
  discountTotal: z.number(),
  total: z.number().min(0),
  amountPaid: z.number().min(0),
  amountRefunded: z.number().min(0),
});

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate order total from components
 */
export function calculateOrderTotal(
  subtotal: number,
  shipping: number = 0,
  tax: number = 0,
  discount: number = 0
): number {
  const total = subtotal + shipping + tax - discount;
  return Math.max(0, roundMoney(total));
}

/**
 * Calculate discount amount from percentage or fixed value
 */
export function calculateDiscount(
  baseAmount: number,
  discount: DiscountInput
): number {
  if (discount.value <= 0) return 0;

  if (discount.type === "percent") {
    const percentage = Math.min(100, Math.max(0, discount.value));
    return roundMoney((baseAmount * percentage) / 100);
  }

  // Fixed amount - can't exceed base amount
  return roundMoney(Math.min(discount.value, baseAmount));
}

/**
 * Calculate payment state from order financials
 */
export function calculatePaymentState(
  financials: OrderFinancials
): PaymentState {
  const { total, amountPaid, amountRefunded } = financials;

  // Net amount paid after refunds
  const netPaid = Math.max(0, amountPaid - amountRefunded);

  // Check for overpayment
  const hasOverpayment = netPaid > total && total > 0;
  const creditAmount = hasOverpayment ? roundMoney(netPaid - total) : 0;

  // Amount due (never negative)
  const amountDue = hasOverpayment
    ? 0
    : roundMoney(Math.max(0, total - netPaid));

  // Percentage calculations
  const rawPercentage =
    total > 0 ? (netPaid / total) * 100 : netPaid > 0 ? 100 : 0;
  const paidPercentage = Math.min(100, rawPercentage);

  // Determine status
  const status = derivePaymentStatus(total, netPaid, amountRefunded);

  return {
    netPaid,
    amountDue,
    creditAmount,
    hasOverpayment,
    paidPercentage,
    rawPercentage,
    status,
    isFullyPaid: amountDue < 0.01, // 1 cent tolerance
    hasPayment: netPaid > 0,
  };
}

/**
 * Derive payment status from values
 */
function derivePaymentStatus(
  total: number,
  netPaid: number,
  amountRefunded: number
): PaymentStatus {
  // Handle refund states first
  if (amountRefunded > 0) {
    if (amountRefunded >= total) return "refunded";
    return "partial_refund";
  }

  // Handle payment states
  if (netPaid <= 0.01) return "unpaid";
  if (netPaid > total) return "overpaid";
  if (netPaid >= total - 0.01) return "paid"; // 1 cent tolerance
  return "partial";
}

/**
 * Get payment status display config
 */
export function getPaymentStatusConfig(status: PaymentStatus): {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
} {
  const configs: Record<
    PaymentStatus,
    ReturnType<typeof getPaymentStatusConfig>
  > = {
    unpaid: {
      label: "Unpaid",
      color: "bg-red-500",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
    },
    partial: {
      label: "Partially Paid",
      color: "bg-amber-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-700",
    },
    paid: {
      label: "Paid",
      color: "bg-green-500",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
    },
    overpaid: {
      label: "Overpaid",
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
    },
    refunded: {
      label: "Refunded",
      color: "bg-gray-500",
      bgColor: "bg-gray-50",
      textColor: "text-gray-700",
    },
    partial_refund: {
      label: "Partial Refund",
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
    },
  };

  return configs[status];
}

/**
 * Calculate maximum refundable amount
 */
export function calculateMaxRefund(financials: OrderFinancials): number {
  const { amountPaid, amountRefunded } = financials;
  return roundMoney(Math.max(0, amountPaid - amountRefunded));
}

/**
 * Calculate change due (for cash payments)
 */
export function calculateChangeDue(
  amountReceived: number,
  amountDue: number
): number {
  const change = amountReceived - amountDue;
  return change > 0 ? roundMoney(change) : 0;
}

/**
 * Validate payment amount against remaining balance
 */
export function validatePaymentAmount(
  amount: number,
  remainingBalance: number,
  allowOverpayment: boolean = false
): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  if (!allowOverpayment && amount > remainingBalance + 0.01) {
    return {
      valid: false,
      error: `Amount exceeds remaining balance (${remainingBalance.toFixed(2)})`,
    };
  }

  return { valid: true };
}

/**
 * Parse string amounts to numbers (handles legacy string storage)
 */
export function parseOrderFinancials(raw: {
  subtotal?: string | number | null;
  shippingTotal?: string | number | null;
  taxTotal?: string | number | null;
  discountTotal?: string | number | null;
  total?: string | number | null;
  amountPaid?: string | number | null;
  amountRefunded?: string | number | null;
}): OrderFinancials {
  const parse = (val: string | number | null | undefined): number => {
    if (val === null || val === undefined) return 0;
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  return {
    subtotal: parse(raw.subtotal),
    shippingTotal: parse(raw.shippingTotal),
    taxTotal: parse(raw.taxTotal),
    discountTotal: parse(raw.discountTotal),
    total: parse(raw.total),
    amountPaid: parse(raw.amountPaid),
    amountRefunded: parse(raw.amountRefunded),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Round to 2 decimal places (money precision)
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Format price for display
 */
export function formatOrderPrice(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/**
 * Check if two money amounts are effectively equal (within tolerance)
 */
export function moneyEquals(
  a: number,
  b: number,
  tolerance: number = 0.01
): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Calculate item line total
 */
export function calculateLineTotal(price: number, quantity: number): number {
  return roundMoney(price * quantity);
}

/**
 * Calculate items subtotal from line items
 */
export function calculateItemsSubtotal(
  items: Array<{ price: number; quantity: number }>
): number {
  return items.reduce(
    (sum, item) => sum + calculateLineTotal(item.price, item.quantity),
    0
  );
}

/**
 * Calculate total discount from items (comparing original vs actual price)
 */
export function calculateItemsDiscount(
  items: Array<{ price: number; originalPrice: number; quantity: number }>
): number {
  return items.reduce((sum, item) => {
    const discount = (item.originalPrice - item.price) * item.quantity;
    return sum + discount;
  }, 0);
}
