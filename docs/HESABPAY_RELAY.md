# HesabPay notifications forwarded by Kaata

The endpoint remains `https://kakamalem.com/api/webhooks/hesabpay`. Keep the
existing `HESABPAY_API_KEY`. This change does not enable routing, change portal
receivers, or enable Kaata checkout.

## Acceptance and ownership

- Verify the original JSON `signature` and `timestamp` with Kaka Malem's own
  HesabPay credentials. Incoming relay headers confer no trust.
- Resolve an exact saved HesabPay gateway session, or an unambiguous saved
  order/invoice UUID echoed in the items. All supplied item references and any
  recognized gateway references must agree. A supplied `session_id` must resolve.
  Tenant query parameters are ownership checks, never matching fallbacks.
- Never match by amount, customer details, tenant, or recency. An unknown payment
  is durably audited as `ignored`, receives HTTP 200, and changes no payment.
  This includes late notifications from deleted Kaata accounts. Inspect ignored
  events for reconciliation if a real Kaka payment cannot be resolved.
- Validate expected AFN charge, item totals, target ownership, invoice total and
  invoice currency, and the order's locked FX rate when needed. Contradictory
  references/details return 409/422 and do not change records. Missing/ambiguous
  targets need reconciliation; no attempt is guessed from the newest row.
- New sessions save the exact rounded line-item sum sent to HesabPay in
  `metadata.hesabpayChargeAmount`. Legacy sessions assume the existing single-line
  path's `Math.round(session.amount)`; inspect unusual historical multi-line or
  non-AFN sessions manually.
- Payment, order ledger, seller earnings, invoice/subscription, audit event, and
  unique invoice job commit together. Database errors roll everything back and
  return 503. PDF generation and SMTP never run on the webhook path.
- Gateway transaction advisory locks, order/session row locks, stable audit IDs,
  and the unique gateway-payment index prevent repeated/concurrent credits.
  Failures cannot change a completed session. Redirect verification shares this
  same persistence path and also durably queues subscription invoices.

Signature verification aborts after 1.5 seconds. Acceptance uses transaction-local
1.2-second statement, 0.5-second lock and 1.5-second idle-in-transaction timeouts.
PostgreSQL 17+ also enforces a 1.5-second total transaction timeout. PostgreSQL 16
has no such server setting: an elapsed-time check rejects work exceeding 1.5
seconds before allowing commit. The full transaction, including rollback, is
awaited; no timeout response abandons work that can later commit. On PG16 this
commit guard does not interrupt cumulative active work exactly at 1.5 seconds,
and neither version's transaction timer bounds pool queues or a network stall.
Actual end-to-end latency must still be measured against the five-second relay
budget. A reserved pool admits up to 16 webhook requests with a
one-second connection timeout; overload returns 503 instead of waiting in the app
pool. Busy/unavailable dependencies fail instead of acknowledging incomplete work.
Monitor actual VPS end-to-end latency, including TLS, before enabling the relay.
If the runtime URL uses PgBouncer, its backend queue is outside the PostgreSQL
transaction timer: configure/confirm a short `query_wait_timeout` (one second for
the webhook pool) and sufficient backend capacity to keep the full request inside
the relay deadline. No live VPS latency or PgBouncer configuration was changed.

## Deployment

1. Back up the database and inspect historical duplicate gateway payment IDs:

   ```sql
   SELECT gateway, gateway_transaction_id, COUNT(*)
   FROM order_transactions
   WHERE type = 'payment' AND gateway_transaction_id IS NOT NULL
   GROUP BY gateway, gateway_transaction_id HAVING COUNT(*) > 1;
   ```

   Reconcile any results before migration. Migration fails safely rather than
   deleting or merging financial history.

2. Deploy migration `drizzle/0053_youthful_skin.sql` with the application. It
   creates `subscription_invoice_jobs` and the unique gateway-payment index.
   The current Docker entrypoint applies committed migrations on startup; for a
   manual deployment use `pnpm db:migrate`. Never use `db:push` in production.
   Keep the existing custom payment ledger migrations applied as well.
3. Configure `CRON_SECRET` and schedule an authenticated
   `GET /api/cron/subscription-invoices` at least every minute, using
   `Authorization: Bearer <CRON_SECRET>`. Each call processes one due job.
   Increase the cadence if queue volume requires it. Scheduling is required;
   merely deploying the endpoint does not run a worker.
4. Keep SMTP settings and writable persistent `STORAGE_PATH` available to the
   app. Allow worker HTTP requests, PostgreSQL transactions and PgBouncer idle
   transactions to last through PDF generation and SMTP; the worker route declares
   a 300-second duration. The webhook's short timeouts are transaction-local and
   do not apply to the worker. The application pool must have at least two
   connections. The reserved webhook pool adds up to 16 connections per replica;
   include those in the PgBouncer connection budget. A global worker advisory lock
   permits one sender across replicas.
5. Monitor pending job age, `attempts`, `last_error`, worker 5xx responses, ignored
   webhook events, and acceptance latency. Pending jobs retry indefinitely with
   backoff from 30 seconds to one hour. Completed rows retain enqueue deduplication;
   do not routinely delete them. Existing historical paid invoices are not
   automatically bulk emailed by this migration.
6. Confirm the verification assumptions below before routing is enabled. An
   authorized sandbox or captured-notification verification check may be used;
   none was performed against a live account as part of this change.

## Worker delivery guarantees

The worker holds its transaction/advisory/row locks while awaiting the sender.
Concurrent invocations do not duplicate work. A restart or lost database
connection releases the locks and leaves the committed job pending. Failures
record an attempt, error and next eligible time. PDF failure prevents email;
email failure retries using the stored paid PDF. Transitioning an invoice to paid
invalidates an older unpaid PDF.

There is one job per invoice, but SMTP delivery is **at least once**. A crash
after SMTP accepts mail and before the job-completion commit may send it again.
Exactly-once external email requires a provider that accepts an idempotency key;
plain SMTP cannot close that crash window. The worker does not use an untracked
background promise.

## Verification assumptions that remain unresolved

- Kaata and Kaka Malem use the same existing merchant API key. Keep it unchanged
  and server-only. There is no cross-key verification requirement. Verify a real
  notification through the full route before enabling shared production routing;
  mocked tests and receiver-validation challenges do not prove payment delivery.
- That documented verification request does not include the payment body. The
  precise cryptographic binding of amount/reference/status is not documented.
  This implementation retains the provider's existing verification contract and
  adds strict local ownership/expected-charge checks; ask HesabPay to confirm the
  signature's scope. It does not infer ownership merely from a valid signature.
- Kaka retains its five-minute timestamp freshness rule. Upstream
  [HesabPay retries](https://docs.hesab.com/webhooks/event-payloads/) refresh the
  signature/timestamp. Kaata retries that preserve an original JSON body beyond
  five minutes will fail verification and require a fresh upstream attempt or
  reconciliation. Confirm Kaata's retry retention behavior before rollout.
- Legacy payloads without a resolvable gateway session and with several attempts
  for the same item reference are rejected as ambiguous. A future explicit
  per-attempt merchant reference can improve this without loose matching.

## Tests

`pnpm test:hesabpay` runs isolated, mocked signature/PDF/email tests. No provider
requests, payments or emails are sent.

On Windows, `powershell -NoProfile -ExecutionPolicy Bypass -File
tests/run-hesabpay-tests.ps1` starts and removes a disposable PostgreSQL cluster
using locally installed binaries (PG16 and newer are supported). It never reads `.env` or uses an existing app
database. Alternatively, provide `HESABPAY_TEST_DATABASE_URL` for a disposable
loopback database named `kakamalem_hesabpay_test`, then run
`pnpm test:hesabpay:integration`. That suite truncates its test tables.

CI runs the integration suite on PostgreSQL 16 and 18. It also checks portable,
transaction-local timeout settings and rollback after several individually
bounded statements exceed the acceptance budget.

The integration suite applies committed migrations and the payment-ledger
trigger, and exercises duplicate/concurrent notifications, redirect races,
ownership and amount conflicts, unmatched/deleted targets, rollback on enqueue
failure, slow/failing workers, backoff and recovery after actual database backend
termination. CI supplies an isolated PostgreSQL 18 service for the same suite.
The fresh test database also installs the historical inventory function
prerequisite before schema migration 0012, matching that migration's existing
dependency on custom SQL.
