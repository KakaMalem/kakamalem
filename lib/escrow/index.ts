import { db } from "@/lib/db";
import { escrowTransactions, disputes, orders } from "@/lib/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { creditSellerEarnings } from "@/lib/actions/earnings";
import {
  AUTO_RELEASE_DAYS,
  type EscrowResult,
  type CreateEscrowInput,
  type FundEscrowInput,
  type ShipEscrowInput,
  type OpenDisputeInput,
  type ResolveDisputeInput,
} from "./types";

/**
 * Create a new escrow transaction for an order.
 * Called when a buyer checks out — escrow starts in "pending" status.
 */
export async function createEscrow(
  input: CreateEscrowInput
): Promise<EscrowResult<{ id: string }>> {
  try {
    const [escrow] = await db
      .insert(escrowTransactions)
      .values({
        orderId: input.orderId,
        tenantId: input.tenantId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        amount: input.amount,
        currency: input.currency,
        network: input.network,
        walletAddress: input.walletAddress,
        platformFeePercent: input.platformFeePercent || "5.00",
        status: "pending",
      })
      .returning({ id: escrowTransactions.id });

    return { success: true, data: { id: escrow.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to create escrow: ${message}` };
  }
}

/**
 * Mark escrow as funded — buyer's crypto payment confirmed.
 * Verifies escrow is in "pending" status before transitioning.
 */
export async function fundEscrow(
  input: FundEscrowInput
): Promise<EscrowResult> {
  try {
    const escrow = await db.query.escrowTransactions.findFirst({
      where: eq(escrowTransactions.id, input.escrowId),
    });

    if (!escrow) {
      return { success: false, error: "Escrow transaction not found" };
    }

    if (escrow.status !== "pending") {
      return {
        success: false,
        error: `Cannot fund escrow in "${escrow.status}" status`,
      };
    }

    const now = new Date().toISOString();

    await db
      .update(escrowTransactions)
      .set({
        status: "funded",
        txHash: input.txHash,
        fundedAt: now,
        updatedAt: now,
      })
      .where(eq(escrowTransactions.id, input.escrowId));

    // Update order payment status to paid
    await db
      .update(orders)
      .set({ paymentStatus: "paid" })
      .where(eq(orders.id, escrow.orderId));

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to fund escrow: ${message}` };
  }
}

/**
 * Mark escrow as shipped — seller provides tracking info.
 * Sets auto-release timer (30 days from now by default).
 */
export async function markShipped(
  input: ShipEscrowInput
): Promise<EscrowResult> {
  try {
    const escrow = await db.query.escrowTransactions.findFirst({
      where: eq(escrowTransactions.id, input.escrowId),
    });

    if (!escrow) {
      return { success: false, error: "Escrow transaction not found" };
    }

    if (escrow.status !== "funded") {
      return {
        success: false,
        error: `Cannot mark as shipped from "${escrow.status}" status`,
      };
    }

    const now = new Date();
    const autoReleaseAt = new Date(now);
    autoReleaseAt.setDate(autoReleaseAt.getDate() + AUTO_RELEASE_DAYS);

    await db
      .update(escrowTransactions)
      .set({
        status: "in_transit",
        trackingNumber: input.trackingNumber,
        trackingCarrier: input.trackingCarrier || null,
        shippedAt: now.toISOString(),
        autoReleaseAt: autoReleaseAt.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(escrowTransactions.id, input.escrowId));

    // Update order status
    await db
      .update(orders)
      .set({ status: "shipped" })
      .where(eq(orders.id, escrow.orderId));

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to mark shipped: ${message}` };
  }
}

/**
 * Confirm delivery and release funds to seller.
 * Called by the buyer or by auto-release cron.
 * Calculates platform fee and seller payout.
 */
export async function confirmDeliveryAndRelease(
  escrowId: string
): Promise<EscrowResult> {
  try {
    const escrow = await db.query.escrowTransactions.findFirst({
      where: eq(escrowTransactions.id, escrowId),
    });

    if (!escrow) {
      return { success: false, error: "Escrow transaction not found" };
    }

    if (escrow.status !== "in_transit" && escrow.status !== "funded") {
      return {
        success: false,
        error: `Cannot release escrow in "${escrow.status}" status`,
      };
    }

    // Calculate fee and payout
    const amount = parseFloat(escrow.amount);
    const feePercent = parseFloat(escrow.platformFeePercent);
    const fee = amount * (feePercent / 100);
    const payout = amount - fee;

    const now = new Date().toISOString();

    await db
      .update(escrowTransactions)
      .set({
        status: "released",
        platformFee: fee.toFixed(8),
        sellerPayout: payout.toFixed(8),
        deliveredAt: now,
        releasedAt: now,
        updatedAt: now,
      })
      .where(eq(escrowTransactions.id, escrowId));

    // Update order status
    const [updatedOrder] = await db
      .update(orders)
      .set({ status: "delivered" })
      .where(eq(orders.id, escrow.orderId))
      .returning({ orderNumber: orders.orderNumber });

    // Credit seller earnings
    await creditSellerEarnings(
      escrow.tenantId,
      escrow.orderId,
      updatedOrder?.orderNumber || "",
      payout,
      escrow.currency.toUpperCase(),
      "crypto_escrow"
    );

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to release escrow: ${message}` };
  }
}

/**
 * Open a dispute on an escrow transaction.
 * Freezes funds — neither buyer nor seller can trigger release.
 */
export async function openDispute(
  input: OpenDisputeInput
): Promise<EscrowResult<{ disputeId: string }>> {
  try {
    const escrow = await db.query.escrowTransactions.findFirst({
      where: eq(escrowTransactions.id, input.escrowId),
    });

    if (!escrow) {
      return { success: false, error: "Escrow transaction not found" };
    }

    // Can only dispute funded or in_transit escrows
    if (escrow.status !== "funded" && escrow.status !== "in_transit") {
      return {
        success: false,
        error: `Cannot dispute escrow in "${escrow.status}" status`,
      };
    }

    const now = new Date().toISOString();

    // Create dispute record and update escrow status in transaction
    const [dispute] = await db.transaction(async (tx) => {
      // Freeze escrow
      await tx
        .update(escrowTransactions)
        .set({
          status: "disputed",
          autoReleaseAt: null, // Cancel auto-release
          updatedAt: now,
        })
        .where(eq(escrowTransactions.id, input.escrowId));

      // Create dispute
      const result = await tx
        .insert(disputes)
        .values({
          escrowTransactionId: input.escrowId,
          tenantId: escrow.tenantId,
          openedBy: input.openedBy,
          openedByRole: input.openedByRole,
          reason: input.reason,
          description: input.description || null,
          evidenceUrls: input.evidenceUrls || [],
          status: "open",
        })
        .returning({ id: disputes.id });

      return result;
    });

    return { success: true, data: { disputeId: dispute.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to open dispute: ${message}` };
  }
}

/**
 * Resolve a dispute — admin decides whether to refund buyer or release to seller.
 */
export async function resolveDispute(
  input: ResolveDisputeInput
): Promise<EscrowResult> {
  try {
    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, input.disputeId),
      with: { escrowTransaction: true },
    });

    if (!dispute) {
      return { success: false, error: "Dispute not found" };
    }

    if (dispute.status !== "open") {
      return {
        success: false,
        error: `Dispute is already resolved: "${dispute.status}"`,
      };
    }

    const escrow = dispute.escrowTransaction;
    if (!escrow || escrow.status !== "disputed") {
      return {
        success: false,
        error: "Escrow is not in disputed state",
      };
    }

    const now = new Date().toISOString();
    const newDisputeStatus =
      input.resolution === "buyer" ? "resolved_buyer" : "resolved_seller";
    const newEscrowStatus =
      input.resolution === "buyer" ? "resolved_buyer" : "resolved_seller";

    let sellerPayout = 0;

    await db.transaction(async (tx) => {
      // Update dispute
      await tx
        .update(disputes)
        .set({
          status: newDisputeStatus as "resolved_buyer" | "resolved_seller",
          resolvedBy: input.resolvedBy,
          resolvedAt: now,
          resolutionNote: input.resolutionNote,
          updatedAt: now,
        })
        .where(eq(disputes.id, input.disputeId));

      if (input.resolution === "seller") {
        // Release to seller — same logic as confirmDeliveryAndRelease
        const amount = parseFloat(escrow.amount);
        const feePercent = parseFloat(escrow.platformFeePercent);
        const fee = amount * (feePercent / 100);
        sellerPayout = amount - fee;

        await tx
          .update(escrowTransactions)
          .set({
            status: newEscrowStatus,
            platformFee: fee.toFixed(8),
            sellerPayout: sellerPayout.toFixed(8),
            releasedAt: now,
            updatedAt: now,
          })
          .where(eq(escrowTransactions.id, escrow.id));
      } else {
        // Refund buyer — no fee charged
        await tx
          .update(escrowTransactions)
          .set({
            status: newEscrowStatus,
            platformFee: "0",
            sellerPayout: "0",
            updatedAt: now,
          })
          .where(eq(escrowTransactions.id, escrow.id));
      }
    });

    // Credit seller earnings if resolved in seller's favor
    if (input.resolution === "seller" && sellerPayout > 0) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, escrow.orderId),
        columns: { orderNumber: true },
      });
      await creditSellerEarnings(
        escrow.tenantId,
        escrow.orderId,
        order?.orderNumber || "",
        sellerPayout,
        escrow.currency.toUpperCase(),
        "crypto_escrow"
      );
    }

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to resolve dispute: ${message}` };
  }
}

/**
 * Auto-release expired escrows.
 * Called by a cron job — finds all in_transit escrows past their autoReleaseAt
 * and releases funds to the seller.
 */
export async function processAutoReleases(): Promise<
  EscrowResult<{ released: number }>
> {
  try {
    const now = new Date().toISOString();

    // Find all escrows past their auto-release deadline
    const expiredEscrows = await db.query.escrowTransactions.findMany({
      where: and(
        eq(escrowTransactions.status, "in_transit"),
        lte(escrowTransactions.autoReleaseAt, now)
      ),
    });

    let released = 0;

    for (const escrow of expiredEscrows) {
      const amount = parseFloat(escrow.amount);
      const feePercent = parseFloat(escrow.platformFeePercent);
      const fee = amount * (feePercent / 100);
      const payout = amount - fee;

      await db
        .update(escrowTransactions)
        .set({
          status: "expired",
          platformFee: fee.toFixed(8),
          sellerPayout: payout.toFixed(8),
          releasedAt: now,
          updatedAt: now,
        })
        .where(eq(escrowTransactions.id, escrow.id));

      const [updatedOrder] = await db
        .update(orders)
        .set({ status: "delivered" })
        .where(eq(orders.id, escrow.orderId))
        .returning({ orderNumber: orders.orderNumber });

      // Credit seller earnings
      await creditSellerEarnings(
        escrow.tenantId,
        escrow.orderId,
        updatedOrder?.orderNumber || "",
        payout,
        escrow.currency.toUpperCase(),
        "crypto_escrow"
      );

      released++;
    }

    return { success: true, data: { released } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to process auto-releases: ${message}`,
    };
  }
}
