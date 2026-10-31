import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import type { Database } from "../lib/db";
import { withWebhookAcceptanceTransaction } from "../lib/db/webhook-transaction";

// Deliberately do not load dotenv. This suite creates/destroys data and must
// never fall back to the application's configured database.
const testUrl = process.env.HESABPAY_TEST_DATABASE_URL;
if (!testUrl)
  throw new Error(
    "HESABPAY_TEST_DATABASE_URL is required; use tests/run-hesabpay-tests.ps1"
  );
const parsedUrl = new URL(testUrl);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(parsedUrl.hostname) ||
  parsedUrl.pathname !== "/kakamalem_hesabpay_test"
) {
  throw new Error(
    "Refusing tests outside the explicitly named local disposable database"
  );
}
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_URL_UNPOOLED = testUrl;
Object.assign(process.env, { NODE_ENV: "test" });

const raw = postgres(testUrl, {
  max: 3,
  prepare: false,
  onnotice: () => undefined,
});
let database: Database;
let closeApplicationDatabase: () => Promise<void>;
let createHandler: typeof import("../lib/payments/hesabpay/webhook").createHesabPayWebhookHandler;
let acceptVerified: typeof import("../lib/payments/hesabpay/webhook").acceptVerifiedHesabPayPayment;
let worker: typeof import("../lib/invoice/subscription-invoice-worker").processSubscriptionInvoiceJob;
let recordPayment: typeof import("../lib/payments/order-payment").recordGatewayPaymentForOrder;
let post: (request: Request) => Promise<Response>;

type Fixture = {
  tenantId: string;
  reference: string;
  sessionId: string;
  gatewaySessionId: string;
  transactionId: string;
  kind: "order" | "invoice";
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function within<T>(promise: Promise<T>, milliseconds = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Operation exceeded ${milliseconds}ms`)),
          milliseconds
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fixture(kind: Fixture["kind"] = "order"): Promise<Fixture> {
  const ownerId = randomUUID();
  const tenantId = randomUUID();
  const reference = randomUUID();
  const sessionId = randomUUID();
  const gatewaySessionId = randomUUID();
  await database.insert(schema.user).values({
    id: ownerId,
    name: "Test Owner",
    email: `${ownerId}@example.invalid`,
  });
  await database.insert(schema.tenants).values({
    id: tenantId,
    ownerId,
    slug: `test-${tenantId}`,
    name: "Isolated Test Store",
    status: "active",
    subscriptionPlan: "free",
  });
  if (kind === "order") {
    await database.insert(schema.orders).values({
      id: reference,
      tenantId,
      orderNumber: `TEST-${reference.slice(0, 8)}`,
      customerSnapshot: { name: "Test Customer" },
      subtotal: "100",
      total: "100",
      amountDue: "100",
      currencyCode: "AFN",
    });
  } else {
    await database.insert(schema.invoices).values({
      id: reference,
      tenantId,
      invoiceNumber: `TEST-${reference}`,
      subtotal: "100",
      total: "100",
      currency: "AFN",
      status: "unpaid",
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-11-01T00:00:00.000Z",
      items: [
        {
          description: "Pro monthly",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      billingEmail: "nobody@example.invalid",
    });
    await database.insert(schema.billingTransactions).values({
      tenantId,
      invoiceId: reference,
      type: "subscription_payment",
      amount: "100",
      currency: "AFN",
      status: "pending",
    });
  }
  await database.insert(schema.paymentSessions).values({
    id: sessionId,
    tenantId,
    orderId: kind === "order" ? reference : null,
    invoiceId: kind === "invoice" ? reference : null,
    gateway: "hesabpay",
    amount: "100",
    currency: "AFN",
    gatewaySessionId,
    status: "pending",
    metadata: { hesabpayChargeAmount: 100 },
  });
  return {
    tenantId,
    reference,
    sessionId,
    gatewaySessionId,
    transactionId: `txn-${randomUUID()}`,
    kind,
  };
}

function payload(f: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    status_code: 10,
    transaction_id: f.transactionId,
    amount: 100,
    session_id: f.gatewaySessionId,
    items: [{ id: f.reference, name: "Test payment", price: 100 }],
    signature: "fixture-signature-only",
    timestamp: Math.floor(Date.now() / 1000).toString(),
    ...overrides,
  };
}

function request(body: unknown, tenantId?: string) {
  return new Request(
    `https://kakamalem.com/api/webhooks/hesabpay${tenantId ? `?tenantId=${tenantId}` : ""}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

async function session(f: Fixture) {
  return database.query.paymentSessions.findFirst({
    where: eq(schema.paymentSessions.id, f.sessionId),
  });
}

async function assertOrderCreditedOnce(f: Fixture) {
  const order = await database.query.orders.findFirst({
    where: eq(schema.orders.id, f.reference),
  });
  assert.equal(order?.paymentStatus, "paid");
  assert.equal(Number(order?.amountPaid), 100);
  assert.equal((await database.select().from(schema.orderPayments)).length, 1);
  assert.equal(
    (await database.select().from(schema.orderTransactions)).length,
    1
  );
  assert.equal(
    (await database.select().from(schema.sellerLedgerEntries)).length,
    1
  );
  const balance = await database.query.sellerBalances.findFirst({
    where: eq(schema.sellerBalances.tenantId, f.tenantId),
  });
  assert.equal(Number(balance?.available), 100);
}

describe(
  "HesabPay durable acceptance with real PostgreSQL",
  { concurrency: false },
  () => {
    before(async () => {
      // Every committed Drizzle migration, including the outbox migration, runs
      // against the new cluster. Historical migration 0012 assumes the inventory
      // functions from custom/0001 already exist, so install those definitions
      // after 0011 using a temporary prefix of the normal migration journal.
      const bootstrap = await mkdtemp(
        join(tmpdir(), "kakamalem-hesabpay-migrations-")
      );
      try {
        const journal = JSON.parse(
          await readFile(
            join(process.cwd(), "drizzle/meta/_journal.json"),
            "utf8"
          )
        ) as { entries: Array<{ idx: number; tag: string }> };
        const prefix = {
          ...journal,
          entries: journal.entries.filter((entry) => entry.idx <= 11),
        };
        await mkdir(join(bootstrap, "meta"));
        await writeFile(
          join(bootstrap, "meta/_journal.json"),
          JSON.stringify(prefix)
        );
        for (const entry of prefix.entries) {
          await copyFile(
            join(process.cwd(), "drizzle", `${entry.tag}.sql`),
            join(bootstrap, `${entry.tag}.sql`)
          );
        }
        await migrate(drizzle(raw), { migrationsFolder: bootstrap });
      } finally {
        if (!resolve(bootstrap).startsWith(resolve(tmpdir()) + sep))
          throw new Error("Unexpected migration bootstrap path");
        await rm(bootstrap, { recursive: true, force: true });
      }
      const inventorySql = await readFile(
        join(
          process.cwd(),
          "drizzle/custom/0001_order_cancellation_stock_triggers.sql"
        ),
        "utf8"
      );
      const triggerStart = inventorySql.indexOf(
        "-- TRIGGER: Fire on order status updates"
      );
      assert.ok(
        triggerStart > 0,
        "Historical inventory functions precede their trigger"
      );
      await raw.unsafe(inventorySql.slice(0, triggerStart));
      await migrate(drizzle(raw), {
        migrationsFolder: join(process.cwd(), "drizzle"),
      });
      // Exercise the production payment-ledger triggers as well.
      await raw.unsafe(
        await readFile(
          join(process.cwd(), "drizzle/custom/0005_payment_ledger_cleanup.sql"),
          "utf8"
        )
      );
      const appDatabase = await import("../lib/db");
      database = appDatabase.db;
      // Timeout tests deliberately terminate pooled sessions. Bound teardown
      // rather than waiting indefinitely for the driver's dead connection.
      closeApplicationDatabase = () => appDatabase.sql.end({ timeout: 2 });
      ({
        createHesabPayWebhookHandler: createHandler,
        acceptVerifiedHesabPayPayment: acceptVerified,
      } = await import("../lib/payments/hesabpay/webhook"));
      ({ recordGatewayPaymentForOrder: recordPayment } =
        await import("../lib/payments/order-payment"));
      ({ processSubscriptionInvoiceJob: worker } =
        await import("../lib/invoice/subscription-invoice-worker"));
      // Verification is injected; no request is sent to HesabPay.
      post = createHandler({ database, verify: async () => ({ valid: true }) });
    });

    beforeEach(async () => {
      await raw.unsafe('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE');
    });

    after(async () => {
      if (closeApplicationDatabase) await closeApplicationDatabase();
      await raw.end({ timeout: 2 });
    });

    test("repeated deliveries with refreshed signatures acknowledge once and credit one ledger entry", async () => {
      const f = await fixture();
      assert.equal((await post(request(payload(f)))).status, 200);
      assert.equal(
        (
          await post(
            request(
              payload(f, {
                signature: "refreshed-signature",
                timestamp: (Math.floor(Date.now() / 1000) + 1).toString(),
              })
            )
          )
        ).status,
        200
      );
      await assertOrderCreditedOnce(f);
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        1
      );
    });

    test("ten simultaneous deliveries serialize without duplicate payments or earnings", async () => {
      const f = await fixture();
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => post(request(payload(f))))
      );
      assert.deepEqual(
        responses.map((response) => response.status),
        Array(10).fill(200)
      );
      await assertOrderCreditedOnce(f);
      assert.equal((await session(f))?.status, "completed");
    });

    test("concurrent subscription deliveries persist one invoice job and activate once", async () => {
      const f = await fixture("invoice");
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => post(request(payload(f))))
      );
      assert.ok(responses.every((response) => response.status === 200));
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        1
      );
      const invoice = await database.query.invoices.findFirst({
        where: eq(schema.invoices.id, f.reference),
      });
      assert.equal(invoice?.status, "paid");
      const tenant = await database.query.tenants.findFirst({
        where: eq(schema.tenants.id, f.tenantId),
      });
      assert.equal(tenant?.subscriptionStatus, "active");
      assert.equal(tenant?.subscriptionPlan, "pro");
      assert.equal(
        (await database.select().from(schema.billingTransactions))[0]?.status,
        "completed"
      );
    });

    test("amount and line totals must match the exact expected AFN charge", async () => {
      const f = await fixture();
      assert.equal(
        (await post(request(payload(f, { amount: 99 })))).status,
        422
      );
      assert.equal(
        (
          await post(
            request(
              payload(f, {
                items: [{ id: f.reference, name: "Wrong amount", price: 99 }],
              })
            )
          )
        ).status,
        422
      );
      assert.equal((await session(f))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
    });

    test("explicit foreign currency is rejected before initial and duplicate acceptance", async () => {
      const f = await fixture();
      assert.equal(
        (await post(request(payload(f, { currency: "USD" })))).status,
        422
      );
      assert.equal((await session(f))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        0
      );
      assert.equal(
        (await post(request(payload(f, { currency: "AFN" })))).status,
        200
      );
      assert.equal(
        (await post(request(payload(f, { currency: "USD" })))).status,
        422
      );
      await assertOrderCreditedOnce(f);
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        1
      );
      assert.equal((await session(f))?.gatewayResponse?.currency, "AFN");
    });

    test("a second transaction on an already paid order requires reconciliation", async () => {
      const f = await fixture();
      assert.equal((await post(request(payload(f)))).status, 200);
      assert.equal(
        (
          await post(
            request(payload(f, { transaction_id: `second-${randomUUID()}` }))
          )
        ).status,
        409
      );
      await assertOrderCreditedOnce(f);
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        1
      );
      assert.equal(
        (await session(f))?.gatewayResponse?.transaction_id,
        f.transactionId
      );
    });

    test("a second transaction on an already paid invoice cannot replace its durable job", async () => {
      const f = await fixture("invoice");
      assert.equal((await post(request(payload(f)))).status, 200);
      const [original] = await database
        .select()
        .from(schema.subscriptionInvoiceJobs);
      assert.equal(
        (
          await post(
            request(payload(f, { transaction_id: `second-${randomUUID()}` }))
          )
        ).status,
        409
      );
      const jobs = await database.select().from(schema.subscriptionInvoiceJobs);
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].id, original.id);
      assert.equal(jobs[0].gatewayTransactionId, f.transactionId);
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.orderTransactions)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        1
      );
      assert.equal(
        (await session(f))?.gatewayResponse?.transaction_id,
        f.transactionId
      );
      const invoice = await database.query.invoices.findFirst({
        where: eq(schema.invoices.id, f.reference),
      });
      assert.equal(invoice?.status, "paid");
      assert.equal(Number(invoice?.paidAmount), 100);
    });

    test("tenant query and stored target ownership must agree", async () => {
      const f = await fixture();
      const other = await fixture();
      assert.equal(
        (await post(request(payload(f), other.tenantId))).status,
        409
      );
      await database
        .update(schema.paymentSessions)
        .set({ tenantId: other.tenantId })
        .where(eq(schema.paymentSessions.id, f.sessionId));
      assert.equal((await post(request(payload(f)))).status, 409);
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal((await session(f))?.status, "pending");
    });

    test("unmatched deleted-Kaata references never fall back to tenant and amount", async () => {
      const f = await fixture();
      const unknown = payload(f, {
        session_id: undefined,
        items: [
          { id: randomUUID(), name: "Deleted Kaata account", price: 100 },
        ],
      });
      const response = await post(request(unknown, f.tenantId));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).outcome, "ignored");
      assert.equal((await session(f))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents))[0]?.status,
        "ignored"
      );
    });

    test("unknown or conflicting explicit session references cannot attach to an order", async () => {
      const f = await fixture();
      const other = await fixture();
      assert.equal(
        (await post(request(payload(f, { session_id: randomUUID() })))).status,
        409
      );
      assert.equal(
        (
          await post(
            request(payload(f, { session_id: other.gatewaySessionId }))
          )
        ).status,
        409
      );
      assert.equal(
        (
          await post(
            request(
              payload(f, {
                items: [
                  { id: f.reference, name: "First", price: 50 },
                  { id: other.reference, name: "Other order", price: 50 },
                ],
              })
            )
          )
        ).status,
        409
      );
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
    });

    test("ambiguous legacy item references do not select the newest checkout attempt", async () => {
      const f = await fixture();
      await database.insert(schema.paymentSessions).values({
        tenantId: f.tenantId,
        orderId: f.reference,
        gateway: "hesabpay",
        amount: "100",
        currency: "AFN",
        gatewaySessionId: randomUUID(),
      });
      assert.equal(
        (await post(request(payload(f, { session_id: undefined })))).status,
        409
      );
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal((await post(request(payload(f)))).status, 200);
      await assertOrderCreditedOnce(f);
    });

    test("a deleted Kaka Malem target cannot redirect payment to a surviving same-amount order", async () => {
      const removed = await fixture();
      const survivor = await fixture();
      await database
        .delete(schema.orders)
        .where(eq(schema.orders.id, removed.reference));
      assert.equal((await post(request(payload(removed)))).status, 409);
      assert.equal((await session(survivor))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
    });

    test("concurrent success and failure, then a late failure, never downgrade completion", async () => {
      const f = await fixture();
      const failure = payload(f, {
        success: false,
        status_code: null,
        transaction_id: null,
        error: { code: "declined", message: "Declined" },
      });
      const responses = await Promise.all([
        post(request(failure)),
        post(request(payload(f))),
      ]);
      assert.ok(responses.every((response) => response.status === 200));
      assert.equal((await post(request(failure))).status, 200);
      assert.equal((await session(f))?.status, "completed");
      await assertOrderCreditedOnce(f);
    });

    test("one gateway transaction cannot be credited concurrently to two orders", async () => {
      const first = await fixture();
      const second = await fixture();
      second.transactionId = first.transactionId;
      const responses = await Promise.all([
        post(request(payload(first))),
        post(request(payload(second))),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409]
      );
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        1
      );
      assert.equal(
        (await database.select().from(schema.sellerLedgerEntries)).length,
        1
      );
    });

    test("authenticated verification and webhook races share payment deduplication", async () => {
      const f = await fixture();
      await acceptVerified({
        localSessionId: f.sessionId,
        transactionId: f.transactionId,
        amount: 100,
        currency: "AFN",
      });
      assert.equal((await post(request(payload(f)))).status, 200);
      await assertOrderCreditedOnce(f);
    });

    test("a legacy recorded order transaction cannot be reused for an invoice", async () => {
      const paidOrder = await fixture();
      const unpaidInvoice = await fixture("invoice");
      await recordPayment({
        orderId: paidOrder.reference,
        expectedTenantId: paidOrder.tenantId,
        gateway: "hesabpay",
        amount: 100,
        currency: "AFN",
        transactionId: paidOrder.transactionId,
      });
      unpaidInvoice.transactionId = paidOrder.transactionId;
      assert.equal((await post(request(payload(unpaidInvoice)))).status, 409);
      assert.equal((await session(unpaidInvoice))?.status, "pending");
      assert.equal(
        (
          await database.query.invoices.findFirst({
            where: eq(schema.invoices.id, unpaidInvoice.reference),
          })
        )?.status,
        "unpaid"
      );
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        0
      );
      await assertOrderCreditedOnce(paidOrder);
    });

    test("a legacy completed invoice session transaction cannot pay another order", async () => {
      const paidInvoice = await fixture("invoice");
      const unpaidOrder = await fixture();
      await database
        .update(schema.paymentSessions)
        .set({
          status: "completed",
          gatewayResponse: { transaction_id: paidInvoice.transactionId },
        })
        .where(eq(schema.paymentSessions.id, paidInvoice.sessionId));
      await database
        .update(schema.invoices)
        .set({ status: "paid", paidAmount: "100" })
        .where(eq(schema.invoices.id, paidInvoice.reference));
      unpaidOrder.transactionId = paidInvoice.transactionId;
      assert.equal((await post(request(payload(unpaidOrder)))).status, 409);
      assert.equal((await session(unpaidOrder))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.sellerLedgerEntries)).length,
        0
      );
    });

    test("concurrent order and invoice requests cannot claim the same transaction", async () => {
      const order = await fixture();
      const invoice = await fixture("invoice");
      invoice.transactionId = order.transactionId;
      const responses = await Promise.all([
        post(request(payload(order))),
        post(request(payload(invoice))),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409]
      );
      const orderPayments = await database.select().from(schema.orderPayments);
      const invoiceJobs = await database
        .select()
        .from(schema.subscriptionInvoiceJobs);
      assert.equal(orderPayments.length + invoiceJobs.length, 1);
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        1
      );
    });

    test("payment invalidates an unpaid invoice's cached PDF before enqueueing", async () => {
      const f = await fixture("invoice");
      await database
        .update(schema.invoices)
        .set({ pdfUrl: "/stale-unpaid-invoice.pdf" })
        .where(eq(schema.invoices.id, f.reference));
      assert.equal((await post(request(payload(f)))).status, 200);
      const invoice = await database.query.invoices.findFirst({
        where: eq(schema.invoices.id, f.reference),
      });
      assert.equal(invoice?.status, "paid");
      assert.equal(invoice?.pdfUrl, null);
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        1
      );
    });

    test("forwarded failures accept decimal-string line prices and null transaction IDs", async () => {
      const f = await fixture();
      const failure = payload(f, {
        success: false,
        status_code: null,
        transaction_id: null,
        items: [{ id: f.reference, name: "Forwarded item", price: "100.00" }],
      });
      assert.equal((await post(request(failure))).status, 200);
      assert.equal((await post(request(failure))).status, 200);
      assert.equal((await session(f))?.status, "failed");
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal((await post(request(payload(f)))).status, 200);
      assert.equal((await session(f))?.status, "completed");
      await assertOrderCreditedOnce(f);
    });

    test("overload rejects the seventeenth held verification promptly without touching storage", async () => {
      const f = await fixture();
      const allStarted = deferred();
      const release = deferred();
      let active = 0;
      const limitedPost = createHandler({
        database,
        verify: async () => {
          active++;
          if (active === 16) allStarted.resolve();
          await release.promise;
          return { valid: true };
        },
      });
      const pending = Array.from({ length: 16 }, () =>
        limitedPost(request(payload(f)))
      );
      try {
        await within(allStarted.promise);
        assert.equal(
          (await within(limitedPost(request(payload(f))), 250)).status,
          503
        );
        assert.equal(active, 16);
        assert.equal((await session(f))?.status, "pending");
        assert.equal(
          (await database.select().from(schema.paymentWebhookEvents)).length,
          0
        );
        assert.equal(
          (await database.select().from(schema.orderPayments)).length,
          0
        );
      } finally {
        release.resolve();
        const responses = await Promise.all(pending);
        assert.ok(responses.every((response) => response.status === 200));
      }
      await assertOrderCreditedOnce(f);
    });

    test("acceptance limits work on PG16 and newer and remain transaction-local", async () => {
      const settings = sql`
        SELECT current_setting('statement_timeout') AS statement,
          current_setting('lock_timeout') AS lock,
          current_setting('idle_in_transaction_session_timeout') AS idle,
          current_setting('transaction_timeout', true) AS transaction
      `;
      const [before] = await database.execute(settings);
      const [inside] = await withWebhookAcceptanceTransaction(database, (tx) =>
        tx.execute(settings)
      );
      assert.equal(inside.statement, "1200ms");
      assert.equal(inside.lock, "500ms");
      assert.equal(inside.idle, "1500ms");
      assert.equal(
        inside.transaction,
        before.transaction === null ? null : "1500ms"
      );
      const [after] = await database.execute(settings);
      assert.deepEqual({ ...after }, { ...before });
    });

    test("cumulative work over the acceptance budget rolls back before returning", async () => {
      const f = await fixture("invoice");
      await assert.rejects(
        withWebhookAcceptanceTransaction(database, async (tx) => {
          await tx
            .update(schema.paymentSessions)
            .set({ status: "completed" })
            .where(eq(schema.paymentSessions.id, f.sessionId));
          await tx.insert(schema.subscriptionInvoiceJobs).values({
            invoiceId: f.reference,
            tenantId: f.tenantId,
            gatewayTransactionId: f.transactionId,
          });
          // Each query fits the statement limit; their combined duration does
          // not. PG17+ aborts server-side; PG16 must reject before COMMIT.
          for (let attempt = 0; attempt < 3; attempt++)
            await tx.execute(sql`SELECT pg_sleep(0.6)`);
        })
      );
      assert.equal((await session(f))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        0
      );
      // A subsequent real webhook can still fulfill exactly once.
      assert.equal((await post(request(payload(f)))).status, 200);
      assert.equal((await session(f))?.status, "completed");
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        1
      );
    });

    test("a contended order lock returns retryable failure within the relay budget", async () => {
      const f = await fixture();
      const locked = deferred();
      const release = deferred();
      const holder = database.transaction(async (tx) => {
        await tx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, f.reference))
          .for("update");
        locked.resolve();
        await release.promise;
      });
      try {
        await within(locked.promise);
        assert.equal(
          (await within(post(request(payload(f))), 1500)).status,
          503
        );
        assert.equal((await session(f))?.status, "pending");
        assert.equal(
          (await database.select().from(schema.orderPayments)).length,
          0
        );
        assert.equal(
          (await database.select().from(schema.paymentWebhookEvents)).length,
          0
        );
      } finally {
        release.resolve();
        await holder;
      }
      assert.equal((await post(request(payload(f)))).status, 200);
      await assertOrderCreditedOnce(f);
    });

    test("enqueue failure rolls back invoice, subscription, session and audit before acknowledgement", async () => {
      const f = await fixture("invoice");
      await raw.unsafe(
        "CREATE FUNCTION test_reject_invoice_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox unavailable'; END $$"
      );
      await raw.unsafe(
        "CREATE TRIGGER test_reject_invoice_job BEFORE INSERT ON subscription_invoice_jobs FOR EACH ROW EXECUTE FUNCTION test_reject_invoice_job()"
      );
      try {
        assert.equal((await post(request(payload(f)))).status, 503);
        assert.equal((await session(f))?.status, "pending");
        assert.equal(
          (
            await database.query.invoices.findFirst({
              where: eq(schema.invoices.id, f.reference),
            })
          )?.status,
          "unpaid"
        );
        assert.equal(
          (
            await database.query.tenants.findFirst({
              where: eq(schema.tenants.id, f.tenantId),
            })
          )?.subscriptionPlan,
          "free"
        );
        assert.equal(
          (await database.select().from(schema.billingTransactions))[0]?.status,
          "pending"
        );
        assert.equal(
          (await database.select().from(schema.subscriptionInvoiceJobs)).length,
          0
        );
        assert.equal(
          (await database.select().from(schema.paymentWebhookEvents)).length,
          0
        );
      } finally {
        await raw.unsafe(
          "DROP TRIGGER test_reject_invoice_job ON subscription_invoice_jobs"
        );
        await raw.unsafe("DROP FUNCTION test_reject_invoice_job()");
      }
      assert.equal((await post(request(payload(f)))).status, 200);
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        1
      );
    });

    test("verification rejects invalid and unavailable responses without any storage or payment effects", async () => {
      const f = await fixture();
      const invalid = createHandler({
        database,
        verify: async () => ({ valid: false }),
      });
      const unavailable = createHandler({
        database,
        verify: async () => ({ valid: false, unavailable: true }),
      });
      assert.equal((await invalid(request(payload(f)))).status, 401);
      assert.equal((await unavailable(request(payload(f)))).status, 503);
      assert.equal((await session(f))?.status, "pending");
      assert.equal(
        (await database.select().from(schema.paymentWebhookEvents)).length,
        0
      );
    });

    test("signed receiver-validation challenges never change payments", async () => {
      await fixture();
      const response = await post(
        request({
          type: "webhook.validation",
          test: true,
          validation_id: randomUUID(),
          signature: "fixture",
          timestamp: Math.floor(Date.now() / 1000).toString(),
        })
      );
      assert.equal(response.status, 200);
      assert.equal(
        (await database.select().from(schema.orderPayments)).length,
        0
      );
      assert.equal(
        (await database.select().from(schema.subscriptionInvoiceJobs)).length,
        0
      );
    });

    test("slow PDF/email work and overlapping workers leave webhook acknowledgement prompt", async () => {
      const f = await fixture("invoice");
      assert.equal((await within(post(request(payload(f))))).status, 200);
      const started = deferred();
      const release = deferred();
      let deliveries = 0;
      const pending = worker({
        database,
        send: async () => {
          deliveries++;
          started.resolve();
          await release.promise;
          return { success: true };
        },
      });
      await within(started.promise);
      try {
        // The sender remains unresolved indefinitely while the webhook returns.
        assert.equal((await within(post(request(payload(f))))).status, 200);
        assert.deepEqual(
          await within(
            worker({
              database,
              send: async () => {
                assert.fail("Must not run the locked invoice job");
              },
            })
          ),
          { status: "idle" }
        );
        assert.equal(
          (await database.select().from(schema.subscriptionInvoiceJobs))[0]
            ?.completedAt,
          null
        );
      } finally {
        release.resolve();
        assert.equal((await pending).status, "completed");
      }
      assert.equal(deliveries, 1);
      assert.equal(
        (
          await worker({
            database,
            send: async () => {
              assert.fail("Completed job must not repeat");
            },
          })
        ).status,
        "idle"
      );
    });

    test("worker persists PDF/SMTP failures and retries with backoff until completion", async () => {
      const f = await fixture("invoice");
      assert.equal((await post(request(payload(f)))).status, 200);
      const first = await worker({
        database,
        send: async () => ({ success: false, error: "PDF failed" }),
      });
      assert.equal(first.status, "retrying");
      let [job] = await database.select().from(schema.subscriptionInvoiceJobs);
      assert.equal(job.attempts, 1);
      assert.equal(job.lastError, "PDF failed");
      assert.ok(new Date(job.availableAt).getTime() > Date.now());
      assert.equal(
        (
          await worker({
            database,
            send: async () => {
              assert.fail("Backoff must delay retry");
            },
          })
        ).status,
        "idle"
      );
      const second = await worker({
        database,
        now: () => new Date(new Date(job.availableAt).getTime() + 1),
        send: async () => {
          throw new Error("SMTP failed");
        },
      });
      assert.equal(second.status, "retrying");
      [job] = await database.select().from(schema.subscriptionInvoiceJobs);
      assert.equal(job.attempts, 2);
      assert.equal(job.lastError, "SMTP failed");
      assert.equal(
        (
          await worker({
            database,
            now: () => new Date(new Date(job.availableAt).getTime() + 1),
            send: async () => ({ success: true }),
          })
        ).status,
        "completed"
      );
      [job] = await database.select().from(schema.subscriptionInvoiceJobs);
      assert.equal(job.attempts, 3);
      assert.ok(job.completedAt);
      assert.equal(job.lastError, null);
    });

    test("abrupt worker connection loss releases its job for a fresh worker pool", async () => {
      const f = await fixture("invoice");
      assert.equal((await post(request(payload(f)))).status, 200);
      const applicationName = `hesabpay-worker-crash-${randomUUID()}`;
      const dyingClient = postgres(testUrl, {
        max: 1,
        prepare: false,
        connection: { application_name: applicationName },
      });
      const dyingDatabase = drizzle(dyingClient, { schema });
      const started = deferred();
      const release = deferred();
      const pending = worker({
        database: dyingDatabase,
        send: async () => {
          started.resolve();
          await release.promise;
          return { success: true };
        },
      }).then(
        (result) => ({ result, error: undefined }),
        (error: unknown) => ({ result: undefined, error })
      );
      try {
        await within(started.promise);
        const [backend] =
          await raw`SELECT pid FROM pg_stat_activity WHERE application_name = ${applicationName}`;
        assert.ok(
          backend?.pid,
          "Test worker backend exists in the disposable cluster"
        );
        await raw`SELECT pg_terminate_backend(${backend.pid})`;
        release.resolve();
        const stopped = await within(pending, 3000);
        assert.ok(stopped.error, "Killed worker cannot commit completion");
      } finally {
        release.resolve();
        await dyingClient.end({ timeout: 1 });
      }
      const [persisted] = await database
        .select()
        .from(schema.subscriptionInvoiceJobs);
      assert.equal(persisted.completedAt, null);
      assert.equal(persisted.attempts, 0);
      const freshClient = postgres(testUrl, { max: 2, prepare: false });
      try {
        const freshDatabase = drizzle(freshClient, { schema });
        assert.equal(
          (
            await worker({
              database: freshDatabase,
              send: async () => ({ success: true }),
            })
          ).status,
          "completed"
        );
      } finally {
        await freshClient.end();
      }
      assert.ok(
        (await database.select().from(schema.subscriptionInvoiceJobs))[0]
          ?.completedAt
      );
    });
  }
);
