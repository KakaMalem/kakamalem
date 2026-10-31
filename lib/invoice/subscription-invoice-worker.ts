import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { subscriptionInvoiceJobs } from "@/lib/db/schema";

export type SubscriptionInvoiceSender = (params: {
  invoiceId: string;
  tenantId: string;
  paymentMethod: string;
  transactionId?: string;
}) => Promise<{ success: boolean; error?: string }>;

export type SubscriptionInvoiceJobResult =
  | { status: "idle" }
  | { status: "completed"; jobId: string }
  | { status: "retrying"; jobId: string; attempts: number };

/** Retry indefinitely, with backoff capped at one hour. Keep failures visible. */
export function subscriptionInvoiceRetryDelay(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempts - 1, 7));
}

/**
 * Process one durable invoice job. The row lock is held through the awaited
 * sender: overlapping workers skip it, and a process restart rolls back this
 * transaction so another worker can retry. No work outlives this promise.
 *
 * SMTP is at least once: a crash after SMTP accepts the email but before the
 * completion commit can send it again. A unique invoice job prevents duplicate
 * enqueueing, but exactly-once delivery needs a mail provider idempotency key.
 */
export async function processSubscriptionInvoiceJob(
  options: {
    database?: Database;
    send?: SubscriptionInvoiceSender;
    now?: () => Date;
  } = {}
): Promise<SubscriptionInvoiceJobResult> {
  const database = options.database ?? (await import("@/lib/db")).db;
  const now = options.now ?? (() => new Date());

  return database.transaction(async (tx) => {
    // The sender uses the normal application pool. Cap workers at one across
    // replicas so long-running worker transactions cannot fill that pool and
    // starve the sender's own queries. Transaction pooling supports this lock.
    const [lock] = await tx.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(1377968460, 1) AS acquired`
    );
    if (!lock.acquired) return { status: "idle" };

    const [job] = await tx
      .select()
      .from(subscriptionInvoiceJobs)
      .where(
        and(
          isNull(subscriptionInvoiceJobs.completedAt),
          lte(subscriptionInvoiceJobs.availableAt, now().toISOString())
        )
      )
      .orderBy(subscriptionInvoiceJobs.availableAt, subscriptionInvoiceJobs.id)
      .for("update", { skipLocked: true })
      .limit(1);

    if (!job) return { status: "idle" };

    let errorMessage: string | undefined;
    try {
      const send =
        options.send ??
        (await import("@/lib/invoice/send-subscription-invoice"))
          .sendSubscriptionInvoice;
      const result = await send({
        invoiceId: job.invoiceId,
        tenantId: job.tenantId,
        paymentMethod: "HesabPay",
        transactionId: job.gatewayTransactionId,
      });
      if (!result.success)
        errorMessage = result.error || "Invoice delivery failed";
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Invoice delivery failed";
    }

    const attempts = job.attempts + 1;
    if (errorMessage) {
      await tx
        .update(subscriptionInvoiceJobs)
        .set({
          attempts,
          availableAt: new Date(
            now().getTime() + subscriptionInvoiceRetryDelay(attempts)
          ).toISOString(),
          lastError: errorMessage.slice(0, 2000),
        })
        .where(eq(subscriptionInvoiceJobs.id, job.id));
      console.error("[SubscriptionInvoiceWorker] Job scheduled for retry", {
        jobId: job.id,
        attempts,
      });
      return { status: "retrying", jobId: job.id, attempts };
    }

    await tx
      .update(subscriptionInvoiceJobs)
      .set({
        attempts,
        completedAt: now().toISOString(),
        lastError: null,
      })
      .where(eq(subscriptionInvoiceJobs.id, job.id));
    return { status: "completed", jobId: job.id };
  });
}
