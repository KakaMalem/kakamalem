/**
 * Recording gateway payments against an order.
 *
 * Shared by the HesabPay webhook and the payment-verification server action so
 * both credit an order the same way. Three things make this non-trivial:
 *
 * 1. **Currency.** HesabPay always charges in AFN. When the store prices in
 *    another currency the payment arrives in AFN and has to be converted back
 *    with the rate locked onto the order before it can be compared to the
 *    order total.
 * 2. **Idempotency.** Gateways retry webhooks, and the customer may also land
 *    back on the site. Replaying the same gateway transaction must not credit
 *    the order twice.
 * 3. **The ledger.** `order_payments` is the source of truth for how much an
 *    order has been paid (see drizzle/custom/0005_payment_ledger_cleanup.sql);
 *    `orders.amount_paid` is a cached value kept in sync by a trigger. Online
 *    payments have to land in that ledger too, otherwise the dashboard's
 *    payment and refund maths silently disagrees with reality.
 *
 * This module is deliberately not a "use server" file so it can be imported
 * from both route handlers and server actions.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderPayments,
  orderTransactions,
  orders,
  type PaymentGateway,
} from "@/lib/db/schema";
import { fromAfnAmount, parseExchangeRate } from "./currency";

/** Rounding slack: converting AFN back to the store currency is not exact. */
const FULLY_PAID_TOLERANCE = 0.99;

export type RecordGatewayPaymentParams = {
  orderId: string;
  gateway: PaymentGateway;
  /** Amount actually captured by the gateway, in `currency`. */
  amount: number;
  /** Currency the gateway charged in. Defaults to the order's currency. */
  currency?: string;
  /** Gateway's transaction id — the idempotency key. */
  transactionId?: string;
  cardLastFour?: string;
  cardBrand?: string;
  gatewayResponse?: Record<string, unknown>;
};

export type RecordGatewayPaymentResult = {
  /** False when nothing was written (order missing, already paid, replay). */
  recorded: boolean;
  reason?: "order_not_found" | "already_paid" | "duplicate" | "invalid_amount";
  orderId?: string;
  /** The `order_transactions` row id, when one was created. */
  transactionId?: string;
  /** Payment amount expressed in the order's own currency. */
  amountInOrderCurrency?: number;
  isFullyPaid?: boolean;
};

/**
 * Credit a completed gateway payment to an order, converting currency,
 * de-duplicating replays, and writing to the payment ledger.
 */
export async function recordGatewayPaymentForOrder(
  params: RecordGatewayPaymentParams
): Promise<RecordGatewayPaymentResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  if (!order) {
    return { recorded: false, reason: "order_not_found" };
  }

  if (order.paymentStatus === "paid") {
    return { recorded: false, reason: "already_paid", orderId: order.id };
  }

  // Idempotency: the same gateway transaction must only ever be credited once.
  if (params.transactionId) {
    const [existing] = await db
      .select({ id: orderTransactions.id })
      .from(orderTransactions)
      .where(
        and(
          eq(orderTransactions.orderId, order.id),
          eq(orderTransactions.type, "payment"),
          eq(orderTransactions.gatewayTransactionId, params.transactionId)
        )
      )
      .limit(1);

    if (existing) {
      return { recorded: false, reason: "duplicate", orderId: order.id };
    }
  }

  const orderCurrency = (order.currencyCode || "AFN").toUpperCase();
  const paymentCurrency = (params.currency || orderCurrency).toUpperCase();
  const orderTotal = parseFloat(order.total);

  // Convert the captured amount into the order's own currency.
  let amountInOrderCurrency: number;
  if (paymentCurrency === orderCurrency) {
    amountInOrderCurrency = params.amount;
  } else {
    const rate = parseExchangeRate(order.exchangeRateUsed);
    if (rate) {
      amountInOrderCurrency = fromAfnAmount(params.amount, rate);
    } else {
      // No locked rate to convert with. The gateway confirmed the payment, so
      // trust the order total rather than writing a number in the wrong
      // currency into the ledger.
      console.warn(
        `[payments] Order ${order.orderNumber} paid in ${paymentCurrency} but priced in ${orderCurrency} with no locked rate — crediting the order total`
      );
      amountInOrderCurrency = orderTotal;
    }
  }

  if (!Number.isFinite(amountInOrderCurrency) || amountInOrderCurrency <= 0) {
    return { recorded: false, reason: "invalid_amount", orderId: order.id };
  }

  // What was already paid. Read both the ledger and the cached column: legacy
  // orders may have one without the other.
  const [ledgerRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${orderPayments.amount}), '0')`,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, order.id));

  const priorPaid = Math.max(
    parseFloat(ledgerRow?.total || "0"),
    parseFloat(order.amountPaid || "0")
  );

  const rawAmountPaid = priorPaid + amountInOrderCurrency;
  const isFullyPaid = rawAmountPaid >= orderTotal * FULLY_PAID_TOLERANCE;
  // Snap to the total once fully paid so rounding never shows as an overpayment.
  const finalAmountPaid = isFullyPaid ? orderTotal : rawAmountPaid;

  // 1. The ledger row (in the order's currency). Triggers sync the cached
  //    amount_paid / payment_status / amount_due columns from this.
  await db.insert(orderPayments).values({
    orderId: order.id,
    amount: amountInOrderCurrency.toFixed(2),
    paymentMethod: params.gateway === "cod" ? "cash" : "card",
    notes: `${params.gateway} payment${
      params.transactionId ? ` · ${params.transactionId}` : ""
    }${
      paymentCurrency !== orderCurrency
        ? ` · charged ${params.amount} ${paymentCurrency}`
        : ""
    }`,
  });

  // 2. The gateway transaction record, kept in the currency actually charged.
  const [transaction] = await db
    .insert(orderTransactions)
    .values({
      orderId: order.id,
      tenantId: order.tenantId,
      type: "payment",
      amount: params.amount.toString(),
      currencyCode: paymentCurrency,
      paymentMethod: params.gateway === "cod" ? "cash" : "card",
      status: "completed",
      gateway: params.gateway,
      gatewayTransactionId: params.transactionId,
      gatewayResponse: params.gatewayResponse,
      cardLastFour: params.cardLastFour,
      cardBrand: params.cardBrand,
      processedAt: new Date().toISOString(),
    })
    .returning();

  // 3. Order status. The ledger trigger owns the cached payment columns, but
  //    set them explicitly too so this is correct even where the custom SQL
  //    migrations have not been applied. Order status is ours either way.
  await db
    .update(orders)
    .set({
      amountPaid: finalAmountPaid.toFixed(2),
      amountDue: Math.max(0, orderTotal - finalAmountPaid).toFixed(2),
      paymentStatus: isFullyPaid ? "paid" : "partial",
      isPaid: isFullyPaid,
      paidAt: isFullyPaid ? new Date().toISOString() : order.paidAt,
      status:
        isFullyPaid && order.status === "pending" ? "confirmed" : order.status,
      confirmedAt:
        isFullyPaid && order.status === "pending"
          ? new Date().toISOString()
          : order.confirmedAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, order.id));

  return {
    recorded: true,
    orderId: order.id,
    transactionId: transaction?.id,
    amountInOrderCurrency,
    isFullyPaid,
  };
}
