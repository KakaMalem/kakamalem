import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import type { Database, Transaction } from "@/lib/db";

const ACCEPTANCE_BUDGET_MS = 1500;

/** Await commit/rollback; never abandon a transaction after an HTTP timeout. */
export async function withWebhookAcceptanceTransaction<T>(
  database: Database,
  work: (tx: Transaction) => Promise<T>
): Promise<T> {
  return database.transaction(async (tx) => {
    const startedAt = performance.now();
    const assertBudget = () => {
      if (performance.now() - startedAt >= ACCEPTANCE_BUDGET_MS)
        throw new Error("Webhook acceptance exceeded its transaction budget");
    };
    // transaction_timeout was introduced in PG17. CASE avoids setting an
    // unknown GUC on PG16, while the other limits are supported on both.
    await tx.execute(sql`
      SELECT
        set_config('statement_timeout', '1200ms', true),
        set_config('lock_timeout', '500ms', true),
        set_config('idle_in_transaction_session_timeout', '1500ms', true),
        CASE WHEN current_setting('transaction_timeout', true) IS NOT NULL
          THEN set_config('transaction_timeout', '1500ms', true)
          ELSE NULL
        END
    `);
    assertBudget();
    const result = await work(tx);
    // PG16 lacks the server's total transaction timer. All callback returns,
    // including duplicate/ignored events, pass this guard before COMMIT.
    // Running work is still awaited: no late detached callback can commit.
    assertBudget();
    return result;
  });
}
