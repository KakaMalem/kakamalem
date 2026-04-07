"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { isPlatformAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { escrowTransactions, disputes, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createEscrow,
  fundEscrow,
  markShipped,
  confirmDeliveryAndRelease,
  openDispute,
  resolveDispute,
} from "@/lib/escrow";

/**
 * Create escrow for an order at checkout.
 * Called after order is created — links escrow to order.
 */
export async function createOrderEscrow(
  orderId: string,
  tenantId: string,
  amount: string,
  currency: "usdt" | "usdc",
  network: "trc20" | "erc20" | "bep20",
  walletAddress: string
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Get store owner (seller) for this tenant
  const ownerMember = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.role, "owner")
    ),
    columns: { userId: true },
  });

  if (!ownerMember) {
    return { success: false, error: "Store owner not found" };
  }

  const result = await createEscrow({
    orderId,
    tenantId,
    buyerId: user.id,
    sellerId: ownerMember.userId,
    amount,
    currency,
    network,
    walletAddress,
  });

  if (result.success) {
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * Confirm buyer's crypto payment — mark escrow as funded.
 * Called when tx hash is verified (admin or automated).
 */
export async function confirmEscrowPayment(escrowId: string, txHash: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Only admin can confirm payments
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: "Only platform admin can confirm payments",
    };
  }

  const result = await fundEscrow({ escrowId, txHash });

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/admin");
  }

  return result;
}

/**
 * Seller marks order as shipped with tracking info.
 */
export async function sellerMarkShipped(
  escrowId: string,
  trackingNumber: string,
  trackingCarrier?: string
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Verify the user is the seller on this escrow
  const escrow = await db.query.escrowTransactions.findFirst({
    where: eq(escrowTransactions.id, escrowId),
  });

  if (!escrow) {
    return { success: false, error: "Escrow not found" };
  }

  // Check user is store owner/admin for this tenant
  const canManage = await canManageStore(escrow.tenantId);
  if (!canManage) {
    return {
      success: false,
      error: "You don't have permission to manage this store",
    };
  }

  const result = await markShipped({
    escrowId,
    trackingNumber,
    trackingCarrier,
  });

  if (result.success) {
    revalidatePath(`/dashboard`);
  }

  return result;
}

/**
 * Buyer confirms delivery — releases escrow to seller.
 */
export async function buyerConfirmDelivery(escrowId: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Verify the user is the buyer on this escrow
  const escrow = await db.query.escrowTransactions.findFirst({
    where: eq(escrowTransactions.id, escrowId),
  });

  if (!escrow) {
    return { success: false, error: "Escrow not found" };
  }

  if (escrow.buyerId !== user.id) {
    return { success: false, error: "Only the buyer can confirm delivery" };
  }

  const result = await confirmDeliveryAndRelease(escrowId);

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/store");
  }

  return result;
}

/**
 * Open a dispute on an escrow transaction.
 * Can be opened by buyer or seller.
 */
export async function openEscrowDispute(
  escrowId: string,
  reason: string,
  description?: string,
  evidenceUrls?: string[]
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Determine if user is buyer or seller
  const escrow = await db.query.escrowTransactions.findFirst({
    where: eq(escrowTransactions.id, escrowId),
  });

  if (!escrow) {
    return { success: false, error: "Escrow not found" };
  }

  let role: "buyer" | "seller";
  if (escrow.buyerId === user.id) {
    role = "buyer";
  } else if (escrow.sellerId === user.id) {
    role = "seller";
  } else {
    // Check if user is store staff
    const canManage = await canManageStore(escrow.tenantId);
    if (canManage) {
      role = "seller";
    } else {
      return {
        success: false,
        error: "You are not a party to this transaction",
      };
    }
  }

  const result = await openDispute({
    escrowId,
    openedBy: user.id,
    openedByRole: role,
    reason,
    description,
    evidenceUrls,
  });

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/admin");
  }

  return result;
}

/**
 * Admin resolves a dispute — refund to buyer or release to seller.
 */
export async function adminResolveDispute(
  disputeId: string,
  resolution: "buyer" | "seller",
  resolutionNote: string
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    return {
      success: false,
      error: "Only platform admin can resolve disputes",
    };
  }

  const result = await resolveDispute({
    disputeId,
    resolvedBy: user.id,
    resolution,
    resolutionNote,
  });

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/admin");
  }

  return result;
}

/**
 * Add a message to a dispute thread.
 * Buyer, seller, or admin can post messages.
 */
export async function addDisputeMessage(
  disputeId: string,
  body: string,
  attachmentUrls?: string[]
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const dispute = await db.query.disputes.findFirst({
    where: eq(disputes.id, disputeId),
    with: { escrowTransaction: true },
  });

  if (!dispute) {
    return { success: false, error: "Dispute not found" };
  }

  if (dispute.status !== "open") {
    return { success: false, error: "Cannot message on a resolved dispute" };
  }

  const escrow = dispute.escrowTransaction;

  // Determine role
  let role: "buyer" | "seller" | "admin";
  const isAdmin = await isPlatformAdmin();

  if (isAdmin) {
    role = "admin";
  } else if (escrow?.buyerId === user.id) {
    role = "buyer";
  } else if (escrow?.sellerId === user.id) {
    role = "seller";
  } else {
    // Check store access
    if (escrow) {
      const canManage = await canManageStore(escrow.tenantId);
      if (canManage) {
        role = "seller";
      } else {
        return { success: false, error: "You are not a party to this dispute" };
      }
    } else {
      return { success: false, error: "Escrow not found" };
    }
  }

  const { disputeMessages } = await import("@/lib/db/schema");

  await db.insert(disputeMessages).values({
    disputeId,
    authorId: user.id,
    role,
    body,
    attachmentUrls: attachmentUrls || [],
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");

  return { success: true };
}
