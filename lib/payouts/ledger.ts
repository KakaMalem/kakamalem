/**
 * The seller earnings ledger.
 *
 * HesabPay credentials are platform-level, so a customer paying by card pays
 * into the PLATFORM's HesabPay account, not the seller's. The platform is then
 * holding money that belongs to the seller, and this is the record of it.
 *
 * Three rules keep it honest:
 *
 * 1. **Everything here is AFN.** It is what HesabPay actually settled, not the
 *    order total in the store's display currency. A store pricing in USD still
 *    earns the Afghani that arrived.
 * 2. **Every movement has a source.** `referenceType` + `referenceId` are
 *    unique, so a replayed webhook or a double-clicked button credits a seller
 *    exactly once. This is the single most important property here.
 * 3. **Balances are locked before they are changed.** Reads that precede a
 *    write take `SELECT ... FOR UPDATE`, so two concurrent withdrawals cannot
 *    both see the same available balance.
 *
 * Cash on delivery never appears in this ledger. That money goes straight from
 * the customer to the seller and the platform never touches it.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db, withTransaction, type Transaction } from "@/lib/db";
import {
  sellerBalances,
  sellerLedgerEntries,
  type SellerLedgerEntryType,
} from "@/lib/db/schema";

/** The currency the platform actually holds on a seller's behalf. */
export const PAYOUT_CURRENCY = "AFN";

export type SellerBalanceSummary = {
  currency: string;
  /** Withdrawable right now. */
  available: number;
  /** Held by a payout that is still in flight. */
  reserved: number;
  lifetimeEarned: number;
  lifetimePaidOut: number;
};

const ZERO_BALANCE: SellerBalanceSummary = {
  currency: PAYOUT_CURRENCY,
  available: 0,
  reserved: 0,
  lifetimeEarned: 0,
  lifetimePaidOut: 0,
};

function toNumber(value: string | null | undefined): number {
  const parsed = parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Read a store's balance. Returns zeros for a store that has never earned,
 * rather than null, because "no row yet" and "nothing earned" are the same
 * thing to a seller.
 */
export async function getSellerBalance(
  tenantId: string
): Promise<SellerBalanceSummary> {
  const [row] = await db
    .select()
    .from(sellerBalances)
    .where(eq(sellerBalances.tenantId, tenantId))
    .limit(1);

  if (!row) return { ...ZERO_BALANCE };

  return {
    currency: row.currency,
    available: toNumber(row.available),
    reserved: toNumber(row.reserved),
    lifetimeEarned: toNumber(row.lifetimeEarned),
    lifetimePaidOut: toNumber(row.lifetimePaidOut),
  };
}

/**
 * Fetch the balance row for update, creating it if this store has never had
 * one. The row exists purely so concurrent writers have something to lock.
 */
async function lockBalance(tx: Transaction, tenantId: string) {
  const existing = await tx
    .select()
    .from(sellerBalances)
    .where(eq(sellerBalances.tenantId, tenantId))
    .for("update")
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Another request may be creating it at the same moment; let the unique
  // constraint arbitrate, then re-read under the lock.
  await tx
    .insert(sellerBalances)
    .values({ tenantId, currency: PAYOUT_CURRENCY })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(sellerBalances)
    .where(eq(sellerBalances.tenantId, tenantId))
    .for("update")
    .limit(1);

  return row;
}

type MovementInput = {
  tenantId: string;
  type: SellerLedgerEntryType;
  /** Signed AFN: positive credits the seller, negative takes money back. */
  amount: number;
  referenceType: string;
  referenceId: string;
  orderId?: string | null;
  description?: string;
  /** Run inside an existing transaction instead of opening one. */
  tx?: Transaction;
};

export type MovementResult = {
  /** False when this source event had already been recorded. */
  applied: boolean;
  available: number;
};

/**
 * Apply one movement to a store's balance, exactly once.
 *
 * The ledger's unique index on (referenceType, referenceId) is what makes this
 * safe to call from a webhook that HesabPay may retry: the second call inserts
 * nothing and leaves the balance alone.
 */
async function applyMovement(input: MovementInput): Promise<MovementResult> {
  const run = async (tx: Transaction): Promise<MovementResult> => {
    const balance = await lockBalance(tx, input.tenantId);

    const currentAvailable = toNumber(balance.available);
    // Never let a correction drive the balance negative; the database CHECK
    // would reject it and take the whole transaction down with it.
    const delta =
      input.amount < 0
        ? -Math.min(Math.abs(input.amount), currentAvailable)
        : input.amount;
    const nextAvailable = currentAvailable + delta;

    const inserted = await tx
      .insert(sellerLedgerEntries)
      .values({
        tenantId: input.tenantId,
        type: input.type,
        amount: delta.toFixed(2),
        balanceAfter: nextAvailable.toFixed(2),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        orderId: input.orderId ?? null,
        description: input.description,
      })
      .onConflictDoNothing()
      .returning({ id: sellerLedgerEntries.id });

    if (inserted.length === 0) {
      // Already recorded. Leave the balance exactly as it is.
      return { applied: false, available: currentAvailable };
    }

    await tx
      .update(sellerBalances)
      .set({
        available: nextAvailable.toFixed(2),
        lifetimeEarned:
          delta > 0 && input.type === "earning"
            ? (toNumber(balance.lifetimeEarned) + delta).toFixed(2)
            : balance.lifetimeEarned,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.id, balance.id));

    return { applied: true, available: nextAvailable };
  };

  return input.tx ? run(input.tx) : withTransaction(run);
}

/**
 * Credit a store for an order that was paid into the platform's account.
 *
 * `paymentTransactionId` is the `order_transactions` row for the capture, which
 * gives us a natural once-only key.
 */
export async function creditSellerEarning(params: {
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  /** AFN actually received from HesabPay. */
  amountAfn: number;
  paymentTransactionId: string;
  tx?: Transaction;
}): Promise<MovementResult> {
  if (!(params.amountAfn > 0)) {
    return { applied: false, available: 0 };
  }

  return applyMovement({
    tenantId: params.tenantId,
    type: "earning",
    amount: params.amountAfn,
    referenceType: "order_payment",
    referenceId: params.paymentTransactionId,
    orderId: params.orderId,
    description: params.orderNumber
      ? `Order ${params.orderNumber}`
      : "Card payment received",
    tx: params.tx,
  });
}

/**
 * Take money back off a seller when a customer is refunded.
 *
 * If the seller has already withdrawn more than is left, the debit is capped at
 * their available balance rather than pushing it negative. The shortfall is a
 * real debt that has to be settled off-platform, and it is visible as a refund
 * that exceeded earnings.
 */
export async function debitSellerForRefund(params: {
  tenantId: string;
  orderId: string;
  /** AFN returned to the customer. */
  amountAfn: number;
  refundId: string;
  tx?: Transaction;
}): Promise<MovementResult> {
  if (!(params.amountAfn > 0)) {
    return { applied: false, available: 0 };
  }

  return applyMovement({
    tenantId: params.tenantId,
    type: "refund",
    amount: -params.amountAfn,
    referenceType: "order_refund",
    referenceId: params.refundId,
    orderId: params.orderId,
    description: "Refunded to customer",
    tx: params.tx,
  });
}

export type LedgerEntryView = {
  id: string;
  type: SellerLedgerEntryType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

/** Recent movements, newest first, for the seller's payments page. */
export async function getSellerLedger(
  tenantId: string,
  limit = 50
): Promise<LedgerEntryView[]> {
  const rows = await db
    .select()
    .from(sellerLedgerEntries)
    .where(eq(sellerLedgerEntries.tenantId, tenantId))
    .orderBy(desc(sellerLedgerEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: toNumber(row.amount),
    balanceAfter: toNumber(row.balanceAfter),
    description: row.description,
    orderId: row.orderId,
    createdAt: row.createdAt,
  }));
}

// =============================================================================
// PAYOUT MOVEMENTS
// =============================================================================

/**
 * Move money out of available and into reserved, before a transfer is
 * attempted. Returns false when the balance cannot cover it, which is also how
 * a double-clicked withdraw button is stopped: the second attempt finds the
 * money already reserved.
 */
export async function reserveForPayout(params: {
  tenantId: string;
  amount: number;
  payoutId: string;
  tx: Transaction;
}): Promise<{ ok: boolean; available: number }> {
  const balance = await lockBalance(params.tx, params.tenantId);
  const available = toNumber(balance.available);

  if (params.amount > available) {
    return { ok: false, available };
  }

  await params.tx.insert(sellerLedgerEntries).values({
    tenantId: params.tenantId,
    type: "payout",
    amount: (-params.amount).toFixed(2),
    balanceAfter: (available - params.amount).toFixed(2),
    referenceType: "payout",
    referenceId: params.payoutId,
    description: "Withdrawal requested",
  });

  await params.tx
    .update(sellerBalances)
    .set({
      available: (available - params.amount).toFixed(2),
      reserved: (toNumber(balance.reserved) + params.amount).toFixed(2),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(sellerBalances.id, balance.id));

  return { ok: true, available: available - params.amount };
}

/** The transfer succeeded: release the reservation and count it as paid out. */
export async function settlePayout(params: {
  tenantId: string;
  amount: number;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const balance = await lockBalance(tx, params.tenantId);
    await tx
      .update(sellerBalances)
      .set({
        reserved: Math.max(
          0,
          toNumber(balance.reserved) - params.amount
        ).toFixed(2),
        lifetimePaidOut: (
          toNumber(balance.lifetimePaidOut) + params.amount
        ).toFixed(2),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.id, balance.id));
  });
}

/** The transfer was rejected: give the money back to the seller. */
export async function reversePayout(params: {
  tenantId: string;
  amount: number;
  payoutId: string;
  reason: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const balance = await lockBalance(tx, params.tenantId);

    const inserted = await tx
      .insert(sellerLedgerEntries)
      .values({
        tenantId: params.tenantId,
        type: "payout_reversal",
        amount: params.amount.toFixed(2),
        balanceAfter: (toNumber(balance.available) + params.amount).toFixed(2),
        referenceType: "payout_reversal",
        referenceId: params.payoutId,
        description: `Withdrawal failed: ${params.reason}`.slice(0, 500),
      })
      .onConflictDoNothing()
      .returning({ id: sellerLedgerEntries.id });

    // Only return the money once, however many times this is called.
    if (inserted.length === 0) return;

    await tx
      .update(sellerBalances)
      .set({
        available: (toNumber(balance.available) + params.amount).toFixed(2),
        reserved: Math.max(
          0,
          toNumber(balance.reserved) - params.amount
        ).toFixed(2),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sellerBalances.id, balance.id));
  });
}

/**
 * Total earned by a store from orders, for display next to the balance.
 */
export async function getEarningsTotals(tenantId: string): Promise<{
  orders: number;
  earned: number;
  refunded: number;
}> {
  const [row] = await db
    .select({
      orders: sql<number>`count(*) filter (where ${sellerLedgerEntries.type} = 'earning')::int`,
      earned: sql<string>`COALESCE(sum(${sellerLedgerEntries.amount}) filter (where ${sellerLedgerEntries.type} = 'earning'), '0')`,
      refunded: sql<string>`COALESCE(-sum(${sellerLedgerEntries.amount}) filter (where ${sellerLedgerEntries.type} = 'refund'), '0')`,
    })
    .from(sellerLedgerEntries)
    .where(and(eq(sellerLedgerEntries.tenantId, tenantId)));

  return {
    orders: row?.orders ?? 0,
    earned: toNumber(row?.earned),
    refunded: toNumber(row?.refunded),
  };
}
