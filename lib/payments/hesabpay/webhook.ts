import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Database, type Transaction } from "@/lib/db";
import { webhookDatabase, WEBHOOK_CONCURRENCY } from "@/lib/db/webhook";
import { withWebhookAcceptanceTransaction } from "@/lib/db/webhook-transaction";
import {
  billingTransactions,
  invoices,
  orders,
  orderTransactions,
  paymentSessions,
  paymentWebhookEvents,
  subscriptionInvoiceJobs,
  tenants,
} from "@/lib/db/schema";
import { recordGatewayPaymentForOrder } from "@/lib/payments/order-payment";
import type { WebhookVerificationResult } from "@/lib/payments/types";
import { hesabPayClient } from "./client";
import type { HesabPayWebhookPayload } from "./types";

const uuid = z.uuid();
const signedEnvelope = z
  .object({
    signature: z.string().min(1).max(4096),
    timestamp: z.string().regex(/^\d+$/).max(20),
  })
  .passthrough();
const notification = signedEnvelope
  .extend({
    success: z.boolean(),
    status_code: z.union([z.number(), z.string(), z.null()]),
    transaction_id: z.string().min(1).max(100).nullable(),
    amount: z.number().finite().positive(),
    currency: z.string().optional(),
    session_id: z.string().min(1).max(255).optional(),
    memo: z.string().max(4096).optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(255),
            name: z.string(),
            price: z.union([
              z.number().finite().nonnegative(),
              z
                .string()
                .regex(/^\d+(\.\d+)?$/)
                .transform(Number),
            ]),
          })
          .passthrough()
      )
      .min(1)
      .optional(),
    error: z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.success &&
      (!value.transaction_id || Number(value.status_code) !== 10)
    )
      ctx.addIssue({
        code: "custom",
        message: "Successful payment needs a transaction and status 10",
      });
    if (!value.success && Number(value.status_code) === 10)
      ctx.addIssue({ code: "custom", message: "Contradictory payment status" });
  });

export class WebhookRejection extends Error {
  constructor(
    message: string,
    public readonly status = 422
  ) {
    super(message);
  }
}
type Acceptance = {
  outcome: "processed" | "duplicate" | "ignored";
  orderId?: string;
  transactionId?: string;
};
type AcceptanceOptions = {
  database?: Database;
  tenantId?: string;
  localSessionId?: string;
};
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
// The signature and timestamp change on upstream retries; payment identity does not.
function paymentIdentity(payload: HesabPayWebhookPayload) {
  return {
    transaction: payload.transaction_id,
    success: payload.success,
    amount: payload.amount,
    session: payload.session_id || null,
    references: [
      ...new Set(payload.items?.map((item) => item.id) || []),
    ].sort(),
  };
}

async function findSession(
  tx: Transaction,
  payload: HesabPayWebhookPayload,
  localSessionId?: string
) {
  const references = [...new Set(payload.items?.map((item) => item.id) || [])];
  const uuidReferences = references.filter((id) => uuid.safeParse(id).success);
  const gatewayIds = [
    ...new Set(
      [payload.session_id, payload.memo].filter(
        (id): id is string => !!id && id.length <= 255
      )
    ),
  ];
  const predicates = [];
  if (localSessionId) predicates.push(eq(paymentSessions.id, localSessionId));
  else {
    if (gatewayIds.length)
      predicates.push(inArray(paymentSessions.gatewaySessionId, gatewayIds));
    if (uuidReferences.length)
      predicates.push(
        or(
          inArray(paymentSessions.orderId, uuidReferences),
          inArray(paymentSessions.invoiceId, uuidReferences)
        )!
      );
  }
  if (!predicates.length) return null;
  const candidates = await tx
    .select()
    .from(paymentSessions)
    .where(and(eq(paymentSessions.gateway, "hesabpay"), or(...predicates)))
    .orderBy(paymentSessions.id)
    .for("update");
  if (!candidates.length) return null;
  let selected = candidates;
  if (payload.session_id)
    selected = selected.filter(
      (s) => s.gatewaySessionId === payload.session_id
    );
  else {
    const byMemo = candidates.filter(
      (s) => s.gatewaySessionId === payload.memo
    );
    if (byMemo.length) selected = byMemo;
  }
  if (selected.length !== 1)
    throw new WebhookRejection(
      "Ambiguous or conflicting payment reference",
      409
    );
  const session = selected[0];
  const target = session.orderId || session.invoiceId;
  if (!target || Boolean(session.orderId) === Boolean(session.invoiceId))
    throw new WebhookRejection("Payment target is missing or ambiguous", 409);
  if (references.some((reference) => reference !== target))
    throw new WebhookRejection("Payment item references disagree", 409);
  if (
    candidates.some(
      (candidate) =>
        candidate.orderId !== session.orderId ||
        candidate.invoiceId !== session.invoiceId ||
        candidate.tenantId !== session.tenantId
    )
  )
    throw new WebhookRejection(
      "Payment references resolve to different owners",
      409
    );
  return session;
}

/** Caller must verify the original signature, or query HesabPay directly first. */
export async function acceptHesabPayNotification(
  payload: HesabPayWebhookPayload,
  options: AcceptanceOptions = {}
): Promise<Acceptance> {
  if (payload.currency && payload.currency.toUpperCase() !== "AFN")
    throw new WebhookRejection("HesabPay charge currency must be AFN");
  return withWebhookAcceptanceTransaction(options.database || db, async (tx) => {
    if (payload.transaction_id)
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`hesabpay:${payload.transaction_id}`}, 0))`
      );
    const eventId = `v2:${payload.success ? "success" : "failure"}:${digest(payload.success ? payload.transaction_id : paymentIdentity(payload))}`;
    const [existing] = await tx
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.gateway, "hesabpay"),
          eq(paymentWebhookEvents.eventId, eventId)
        )
      );
    if (existing?.status === "processed") {
      const accepted = existing.payload.acceptance as
        | {
            sessionId: string;
            gatewaySessionId: string | null;
            targetId: string;
          }
        | undefined;
      if (
        !accepted ||
        existing.payload.amount !== payload.amount ||
        (options.localSessionId &&
          options.localSessionId !== accepted.sessionId) ||
        (options.tenantId && options.tenantId !== existing.tenantId) ||
        (payload.session_id &&
          payload.session_id !== accepted.gatewaySessionId) ||
        payload.items?.some((item) => item.id !== accepted.targetId)
      )
        throw new WebhookRejection(
          "Transaction was already delivered with different payment details",
          409
        );
      return {
        outcome: "duplicate",
        orderId: existing.orderId || undefined,
        transactionId: existing.transactionId || undefined,
      };
    }
    const session = await findSession(tx, payload, options.localSessionId);
    const now = new Date().toISOString();
    const audit = async (
      outcome: "processed" | "ignored",
      details: {
        orderId?: string;
        transactionId?: string;
        errorMessage?: string;
      } = {}
    ) => {
      await tx
        .insert(paymentWebhookEvents)
        .values({
          gateway: "hesabpay",
          eventId,
          eventType: payload.success ? "payment.success" : "payment.failure",
          payload: {
            ...payload,
            acceptance: session
              ? {
                  sessionId: session.id,
                  gatewaySessionId: session.gatewaySessionId,
                  targetId: session.orderId || session.invoiceId,
                }
              : null,
          },
          tenantId: session?.tenantId,
          status: outcome,
          processedAt: now,
          ...details,
        })
        .onConflictDoUpdate({
          target: [paymentWebhookEvents.gateway, paymentWebhookEvents.eventId],
          targetWhere: sql`event_id IS NOT NULL`,
          set: {
            status: outcome,
            processedAt: now,
            payload: {
              ...payload,
              acceptance: session
                ? {
                    sessionId: session.id,
                    gatewaySessionId: session.gatewaySessionId,
                    targetId: session.orderId || session.invoiceId,
                  }
                : null,
            },
            tenantId: session?.tenantId,
            ...details,
          },
        });
    };
    if (!session) {
      await audit("ignored", {
        errorMessage: "No exact Kaka Malem payment reference",
      });
      return { outcome: "ignored" };
    }
    if (options.tenantId && options.tenantId !== session.tenantId)
      throw new WebhookRejection("Tenant does not own this payment", 409);
    // Legacy paths sent one rounded AFN line; new sessions store the exact sum.
    const storedCharge = session.metadata?.hesabpayChargeAmount;
    const expected =
      typeof storedCharge === "number"
        ? storedCharge
        : Math.round(Number(session.amount));
    if (
      session.currency !== "AFN" ||
      !Number.isFinite(expected) ||
      expected <= 0 ||
      Math.abs(payload.amount - expected) > 0.000001
    )
      throw new WebhookRejection(
        "Payment amount or currency does not match the expected charge"
      );
    if (
      payload.items &&
      Math.abs(
        payload.items.reduce((total, item) => total + item.price, 0) - expected
      ) > 0.000001
    )
      throw new WebhookRejection(
        "Payment items do not match the expected charge"
      );

    const [order] = session.orderId
      ? await tx
          .select()
          .from(orders)
          .where(eq(orders.id, session.orderId))
          .for("update")
      : [];
    const [invoice] = session.invoiceId
      ? await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, session.invoiceId))
          .for("update")
      : [];
    if (
      (!order && !invoice) ||
      (order || invoice)!.tenantId !== session.tenantId ||
      order?.deletedAt
    )
      throw new WebhookRejection(
        "Payment target does not belong to this store",
        409
      );
    if (
      invoice &&
      (invoice.currency !== "AFN" ||
        Math.round(Number(invoice.total)) !== expected ||
        invoice.status === "void")
    )
      throw new WebhookRejection("Invoice does not match this payment");
    if (
      order &&
      order.currencyCode !== "AFN" &&
      !(Number(order.exchangeRateUsed) > 0)
    )
      throw new WebhookRejection("Order has no locked exchange rate");
    if (!payload.success) {
      await tx
        .update(paymentSessions)
        .set({
          status: "failed",
          failedAt: now,
          updatedAt: now,
          failureReason: payload.error?.message || "Payment failed at gateway",
          gatewayResponse: payload as unknown as Record<string, unknown>,
        })
        .where(
          and(
            eq(paymentSessions.id, session.id),
            sql`${paymentSessions.status} <> 'completed'`
          )
        );
      await audit("processed", { orderId: session.orderId || undefined });
      return { outcome: "processed", orderId: session.orderId || undefined };
    }
    const transactionId = payload.transaction_id!;
    // Respect payments accepted by the pre-outbox handler too. A signature from
    // the shared merchant account is never evidence of a new target's ownership.
    const [legacyOrderPayment] = await tx
      .select()
      .from(orderTransactions)
      .where(
        and(
          eq(orderTransactions.gateway, "hesabpay"),
          eq(orderTransactions.type, "payment"),
          eq(orderTransactions.gatewayTransactionId, transactionId)
        )
      )
      .limit(1);
    if (legacyOrderPayment && legacyOrderPayment.orderId !== session.orderId)
      throw new WebhookRejection(
        "Transaction already belongs to another payment target",
        409
      );
    const legacySessions = await tx
      .select({
        id: paymentSessions.id,
        orderId: paymentSessions.orderId,
        invoiceId: paymentSessions.invoiceId,
        tenantId: paymentSessions.tenantId,
      })
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.gateway, "hesabpay"),
          eq(paymentSessions.status, "completed"),
          sql`(${paymentSessions.gatewayResponse}->>'transaction_id' = ${transactionId} OR ${paymentSessions.gatewayResponse}->>'transactionId' = ${transactionId})`
        )
      );
    if (
      legacySessions.some(
        (previous) =>
          previous.orderId !== session.orderId ||
          previous.invoiceId !== session.invoiceId ||
          previous.tenantId !== session.tenantId
      )
    )
      throw new WebhookRejection(
        "Transaction already belongs to another payment target",
        409
      );
    let ledgerTransactionId: string | undefined;
    if (order) {
      const result = await recordGatewayPaymentForOrder({
        tx,
        orderId: order.id,
        expectedTenantId: session.tenantId,
        gateway: "hesabpay",
        amount: payload.amount,
        currency: "AFN",
        transactionId,
        gatewayResponse: payload as unknown as Record<string, unknown>,
      });
      if (
        result.reason === "invalid_amount" ||
        result.reason === "order_not_found"
      )
        throw new WebhookRejection("Order cannot accept this payment");
      if (result.reason === "already_paid")
        throw new WebhookRejection(
          "Order already paid; new transaction requires reconciliation",
          409
        );
      ledgerTransactionId = result.transactionId;
    }
    if (invoice) {
      if (invoice.status === "paid" && !legacySessions.length)
        throw new WebhookRejection(
          "Invoice already paid; new transaction requires reconciliation",
          409
        );
      if (invoice.status !== "paid") {
        await tx
          .update(invoices)
          .set({
            status: "paid",
            paidAt: now,
            paidAmount: payload.amount.toFixed(2),
            pdfUrl: null,
            updatedAt: now,
          })
          .where(eq(invoices.id, invoice.id));
        const [tenant] = await tx
          .select()
          .from(tenants)
          .where(eq(tenants.id, session.tenantId))
          .for("update");
        if (!tenant)
          throw new WebhookRejection(
            "Subscription owner no longer exists",
            409
          );
        const isYearly = invoice.items?.some((item) =>
          item.description.toLowerCase().includes("yearly")
        );
        await tx
          .update(tenants)
          .set({
            subscriptionStatus: "active",
            subscriptionPlan: "pro",
            subscriptionStartedAt: tenant.subscriptionStartedAt || now,
            subscriptionEndsAt:
              tenant.subscriptionEndsAt &&
              invoice.periodEnd &&
              new Date(tenant.subscriptionEndsAt) > new Date(invoice.periodEnd)
                ? tenant.subscriptionEndsAt
                : invoice.periodEnd,
            billingInterval: isYearly ? "yearly" : "monthly",
            updatedAt: now,
          })
          .where(eq(tenants.id, session.tenantId));
        await tx
          .update(billingTransactions)
          .set({ status: "completed", updatedAt: now })
          .where(
            and(
              eq(billingTransactions.invoiceId, invoice.id),
              eq(billingTransactions.tenantId, session.tenantId)
            )
          );
      }
      await tx
        .insert(subscriptionInvoiceJobs)
        .values({
          invoiceId: invoice.id,
          tenantId: session.tenantId,
          gatewayTransactionId: transactionId,
        })
        .onConflictDoNothing({ target: subscriptionInvoiceJobs.invoiceId });
    }
    await tx
      .update(paymentSessions)
      .set({
        status: "completed",
        completedAt: session.completedAt || now,
        updatedAt: now,
        gatewayResponse: payload as unknown as Record<string, unknown>,
      })
      .where(eq(paymentSessions.id, session.id));
    await audit("processed", {
      orderId: session.orderId || undefined,
      transactionId: ledgerTransactionId,
    });
    return {
      outcome: "processed",
      orderId: session.orderId || undefined,
      transactionId: ledgerTransactionId,
    };
  });
}

/** Direct authenticated payment lookups use the same durable persistence path. */
export async function acceptVerifiedHesabPayPayment(params: {
  localSessionId: string;
  transactionId: string;
  amount: number;
  currency?: string;
  gatewayResponse?: Record<string, unknown>;
}): Promise<Acceptance> {
  if (
    !params.transactionId ||
    !Number.isFinite(params.amount) ||
    params.amount <= 0 ||
    (params.currency && params.currency !== "AFN")
  )
    throw new WebhookRejection("Incomplete verified payment details");
  return acceptHesabPayNotification(
    {
      success: true,
      status_code: 10,
      transaction_id: params.transactionId,
      amount: params.amount,
      signature: "",
      timestamp: "",
      verification_source: "payment.verify",
      gateway_response: params.gatewayResponse,
    } as HesabPayWebhookPayload,
    { localSessionId: params.localSessionId }
  );
}

export function createHesabPayWebhookHandler(
  dependencies: {
    database?: Database;
    verify?: (payload: unknown) => Promise<WebhookVerificationResult>;
  } = {}
) {
  let active = 0;
  const handle = async function (request: Request): Promise<Response> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!signedEnvelope.safeParse(raw).success)
      return Response.json(
        { error: "Missing signature or timestamp" },
        { status: 400 }
      );
    try {
      // Incoming headers are neither trusted nor required. The original JSON is
      // verified independently with Kaka Malem's unchanged platform API key.
      const verification = await (
        dependencies.verify ||
        ((body) => hesabPayClient.verifyWebhook(body, {}))
      )(raw);
      if (!verification.valid)
        return Response.json(
          { error: "Webhook verification failed" },
          { status: verification.unavailable ? 503 : 401 }
        );
      const envelope = raw as Record<string, unknown>;
      if (envelope.type === "webhook.validation" && envelope.test === true)
        return Response.json({ received: true });
      const parsed = notification.safeParse(raw);
      if (!parsed.success)
        return Response.json(
          { error: "Invalid payment notification" },
          { status: 400 }
        );
      const tenantId =
        new URL(request.url).searchParams.get("tenantId") || undefined;
      if (tenantId && !uuid.safeParse(tenantId).success)
        return Response.json(
          { error: "Invalid tenant reference" },
          { status: 400 }
        );
      const accepted = await acceptHesabPayNotification(parsed.data, {
        database: dependencies.database || webhookDatabase,
        tenantId,
      });
      return Response.json({ received: true, outcome: accepted.outcome });
    } catch (error) {
      if (error instanceof WebhookRejection)
        return Response.json(
          { error: error.message },
          { status: error.status }
        );
      console.error("[HesabPay Webhook] Acceptance failed", error);
      return Response.json(
        { error: "Webhook acceptance unavailable" },
        { status: 503 }
      );
    }
  };
  return async function POST(request: Request): Promise<Response> {
    // Reject overload instead of waiting behind the reserved connection pool.
    if (active >= WEBHOOK_CONCURRENCY)
      return Response.json({ error: "Webhook receiver busy" }, { status: 503 });
    active++;
    try {
      return await handle(request);
    } finally {
      active--;
    }
  };
}
