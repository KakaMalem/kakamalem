/**
 * Payment Status Utility Functions
 *
 * This module provides consistent payment status computation across the application.
 * The source of truth for payment data is the order_payments and refunds tables.
 * The amount_paid and amount_refunded fields on orders are cached values auto-synced by database triggers.
 *
 * IMPORTANT: Never rely on is_paid or payment_status fields directly.
 * Always compute status from amounts using these functions.
 */

export type ComputedPaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "partial_refund"
  | "refunded";

export interface PaymentAmounts {
  total: number | string;
  amountPaid: number | string;
  amountRefunded: number | string;
}

export interface PaymentStatusInfo {
  status: ComputedPaymentStatus;
  isPaid: boolean;
  hasRefund: boolean;
  isFullyRefunded: boolean;
  isPartiallyRefunded: boolean;
  amountDue: number;
  amountPaid: number;
  amountRefunded: number;
  total: number;
}

/**
 * Parse a numeric value from string or number
 */
function parseAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Compute comprehensive payment status from amounts
 *
 * @param amounts - Object containing total, amountPaid, and amountRefunded
 * @returns PaymentStatusInfo with all computed values
 *
 * @example
 * const status = computePaymentStatus({
 *   total: order.total,
 *   amountPaid: order.amountPaid,
 *   amountRefunded: order.amountRefunded
 * });
 *
 * if (status.isPaid) {
 *   console.log('Order is paid!');
 * }
 */
export function computePaymentStatus(
  amounts: PaymentAmounts
): PaymentStatusInfo {
  const total = parseAmount(amounts.total);
  const amountPaid = parseAmount(amounts.amountPaid);
  const amountRefunded = parseAmount(amounts.amountRefunded);

  // Small tolerance for floating point comparison (1 cent)
  const TOLERANCE = 0.01;

  const hasRefund = amountRefunded > 0;
  const isFullyRefunded = hasRefund && amountRefunded >= amountPaid - TOLERANCE;
  const isPartiallyRefunded = hasRefund && !isFullyRefunded;
  const isPaid = !isFullyRefunded && amountPaid >= total - TOLERANCE;
  const amountDue = Math.max(0, total - amountPaid + amountRefunded);

  let status: ComputedPaymentStatus;
  if (isFullyRefunded) {
    status = "refunded";
  } else if (isPartiallyRefunded) {
    status = "partial_refund";
  } else if (isPaid) {
    status = "paid";
  } else if (amountPaid > 0) {
    status = "partial";
  } else {
    status = "unpaid";
  }

  return {
    status,
    isPaid,
    hasRefund,
    isFullyRefunded,
    isPartiallyRefunded,
    amountDue,
    amountPaid,
    amountRefunded,
    total,
  };
}

/**
 * Get just the payment status string
 *
 * @example
 * const status = getPaymentStatus(order); // 'paid' | 'unpaid' | etc.
 */
export function getPaymentStatus(
  amounts: PaymentAmounts
): ComputedPaymentStatus {
  return computePaymentStatus(amounts).status;
}

/**
 * Check if an order is considered paid
 *
 * @example
 * if (isOrderPaid(order)) {
 *   // Ship the order
 * }
 */
export function isOrderPaid(amounts: PaymentAmounts): boolean {
  return computePaymentStatus(amounts).isPaid;
}

/**
 * Check if an order has any refunds
 */
export function hasOrderRefund(amounts: PaymentAmounts): boolean {
  return computePaymentStatus(amounts).hasRefund;
}

/**
 * Calculate amount due on an order
 */
export function getAmountDue(amounts: PaymentAmounts): number {
  return computePaymentStatus(amounts).amountDue;
}

/**
 * Payment status display configuration
 */
export const PAYMENT_STATUS_CONFIG: Record<
  ComputedPaymentStatus,
  {
    label: string;
    shortLabel: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  unpaid: {
    label: "Unpaid",
    shortLabel: "Unpaid",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  partial: {
    label: "Partially Paid",
    shortLabel: "Partial",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
  },
  paid: {
    label: "Paid",
    shortLabel: "Paid",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  partial_refund: {
    label: "Partially Refunded",
    shortLabel: "Part. Refund",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
  },
  refunded: {
    label: "Refunded",
    shortLabel: "Refunded",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
  },
};

/**
 * Get display configuration for a payment status
 */
export function getPaymentStatusConfig(amounts: PaymentAmounts) {
  const status = getPaymentStatus(amounts);
  return PAYMENT_STATUS_CONFIG[status];
}

/**
 * Format payment status for display with amount if applicable
 *
 * @example
 * formatPaymentStatusDisplay(order, 'AFN'); // "Amount Due: AFN 500" or "PAID"
 */
export function formatPaymentStatusDisplay(
  amounts: PaymentAmounts,
  formatCurrency: (amount: number) => string
): string {
  const info = computePaymentStatus(amounts);

  switch (info.status) {
    case "refunded":
      return "REFUNDED";
    case "partial_refund":
      return `PARTIALLY REFUNDED (${formatCurrency(info.amountRefunded)})`;
    case "paid":
      return "PAID";
    case "partial":
      return `Partial Payment (${formatCurrency(info.amountPaid)} of ${formatCurrency(info.total)})`;
    case "unpaid":
    default:
      return `Amount Due: ${formatCurrency(info.amountDue)}`;
  }
}
