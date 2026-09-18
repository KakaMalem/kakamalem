/**
 * Backfill the seller earnings ledger from past card payments.
 *
 * Earnings are credited when a HesabPay payment is recorded, so orders paid
 * before that existed have money sitting in the platform's HesabPay account
 * with nothing in the ledger to say who it belongs to. This walks the completed
 * HesabPay payments already in `order_transactions` and credits each one.
 *
 * Safe to re-run: every credit is keyed on the transaction row through the
 * ledger's unique (reference_type, reference_id) index, so a second run inserts
 * nothing and no seller is paid twice.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-seller-earnings.ts --dry-run
 *   pnpm tsx scripts/backfill-seller-earnings.ts
 */
import dotenv from "dotenv";

// Load .env.local first (like Next.js), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Imported after dotenv so the db client sees DATABASE_URL.
  const { db } = await import("../lib/db");
  const { orderTransactions, orders, tenants } = await import(
    "../lib/db/schema"
  );
  const { creditSellerEarning } = await import("../lib/payouts/ledger");
  const { and, eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      transactionId: orderTransactions.id,
      tenantId: orderTransactions.tenantId,
      orderId: orderTransactions.orderId,
      amount: orderTransactions.amount,
      currency: orderTransactions.currencyCode,
      processedAt: orderTransactions.processedAt,
      orderNumber: orders.orderNumber,
      storeName: tenants.name,
    })
    .from(orderTransactions)
    .innerJoin(orders, eq(orders.id, orderTransactions.orderId))
    .innerJoin(tenants, eq(tenants.id, orderTransactions.tenantId))
    .where(
      and(
        eq(orderTransactions.gateway, "hesabpay"),
        eq(orderTransactions.type, "payment"),
        eq(orderTransactions.status, "completed")
      )
    );

  if (rows.length === 0) {
    console.log("No completed HesabPay payments found. Nothing to backfill.");
    process.exit(0);
  }

  console.log(
    `Found ${rows.length} completed HesabPay payment(s)${dryRun ? " (dry run)" : ""}:\n`
  );

  let credited = 0;
  let alreadyPresent = 0;
  let skipped = 0;
  let total = 0;

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    const currency = (row.currency || "AFN").toUpperCase();
    const label = `${row.storeName} · order ${row.orderNumber} · ${amount} ${currency}`;

    // The platform only ever receives AFN from HesabPay. Anything else in this
    // column is a data problem, not an earning, so leave it alone.
    if (currency !== "AFN" || !(amount > 0)) {
      console.log(`  skip     ${label} (not a positive AFN amount)`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  would credit  ${label}`);
      total += amount;
      credited += 1;
      continue;
    }

    const result = await creditSellerEarning({
      tenantId: row.tenantId,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      amountAfn: amount,
      paymentTransactionId: row.transactionId,
    });

    if (result.applied) {
      console.log(`  credited ${label}`);
      credited += 1;
      total += amount;
    } else {
      console.log(`  already  ${label}`);
      alreadyPresent += 1;
    }
  }

  console.log(
    `\n${dryRun ? "Would credit" : "Credited"}: ${credited}` +
      `  |  already in ledger: ${alreadyPresent}` +
      `  |  skipped: ${skipped}` +
      `  |  total: ${total.toFixed(2)} AFN`
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
