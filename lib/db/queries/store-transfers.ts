"use server";

import { db } from "@/lib/db";
import {
  storeTransferRequests,
  tenants,
  tenantMembers,
  user,
} from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";

// Transfer expiration in days
const TRANSFER_EXPIRATION_DAYS = 7;

export type TransferRequestWithDetails = {
  id: string;
  tenantId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  message: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  fromUser: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  toUser: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
};

/**
 * Get pending transfer request for a store (if any)
 */
export async function getPendingTransferRequest(
  tenantId: string
): Promise<TransferRequestWithDetails | null> {
  const result = await db
    .select({
      id: storeTransferRequests.id,
      tenantId: storeTransferRequests.tenantId,
      status: storeTransferRequests.status,
      message: storeTransferRequests.message,
      expiresAt: storeTransferRequests.expiresAt,
      createdAt: storeTransferRequests.createdAt,
      respondedAt: storeTransferRequests.respondedAt,
      tenant: {
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        logoUrl: tenants.logoUrl,
      },
      fromUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    })
    .from(storeTransferRequests)
    .innerJoin(tenants, eq(storeTransferRequests.tenantId, tenants.id))
    .innerJoin(user, eq(storeTransferRequests.fromUserId, user.id))
    .where(
      and(
        eq(storeTransferRequests.tenantId, tenantId),
        eq(storeTransferRequests.status, "pending")
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  // Get the toUser separately since we have two user references
  const toUserResult = await db.query.user.findFirst({
    where: eq(
      user.id,
      (
        await db.query.storeTransferRequests.findFirst({
          where: eq(storeTransferRequests.id, result[0].id),
        })
      )?.toUserId ?? ""
    ),
    columns: { id: true, email: true, name: true, image: true },
  });

  return {
    ...result[0],
    toUser: toUserResult ?? { id: "", email: "", name: null, image: null },
  };
}

/**
 * Get a transfer request by ID with full details
 */
export async function getTransferRequestById(
  requestId: string
): Promise<TransferRequestWithDetails | null> {
  const request = await db.query.storeTransferRequests.findFirst({
    where: eq(storeTransferRequests.id, requestId),
  });

  if (!request) return null;

  const [tenant, fromUserData, toUserData] = await Promise.all([
    db.query.tenants.findFirst({
      where: eq(tenants.id, request.tenantId),
      columns: { id: true, name: true, slug: true, logoUrl: true },
    }),
    db.query.user.findFirst({
      where: eq(user.id, request.fromUserId),
      columns: { id: true, email: true, name: true, image: true },
    }),
    db.query.user.findFirst({
      where: eq(user.id, request.toUserId),
      columns: { id: true, email: true, name: true, image: true },
    }),
  ]);

  if (!tenant || !fromUserData || !toUserData) return null;

  return {
    id: request.id,
    tenantId: request.tenantId,
    status: request.status,
    message: request.message,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    respondedAt: request.respondedAt,
    tenant,
    fromUser: fromUserData,
    toUser: toUserData,
  };
}

/**
 * Get all pending transfer requests for a user (as recipient)
 */
export async function getPendingTransferRequestsForUser(
  userId: string
): Promise<TransferRequestWithDetails[]> {
  const requests = await db.query.storeTransferRequests.findMany({
    where: and(
      eq(storeTransferRequests.toUserId, userId),
      eq(storeTransferRequests.status, "pending")
    ),
    orderBy: (requests, { desc }) => [desc(requests.createdAt)],
  });

  const results: TransferRequestWithDetails[] = [];

  for (const request of requests) {
    const [tenant, fromUserData, toUserData] = await Promise.all([
      db.query.tenants.findFirst({
        where: eq(tenants.id, request.tenantId),
        columns: { id: true, name: true, slug: true, logoUrl: true },
      }),
      db.query.user.findFirst({
        where: eq(user.id, request.fromUserId),
        columns: { id: true, email: true, name: true, image: true },
      }),
      db.query.user.findFirst({
        where: eq(user.id, request.toUserId),
        columns: { id: true, email: true, name: true, image: true },
      }),
    ]);

    if (tenant && fromUserData && toUserData) {
      results.push({
        id: request.id,
        tenantId: request.tenantId,
        status: request.status,
        message: request.message,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        respondedAt: request.respondedAt,
        tenant,
        fromUser: fromUserData,
        toUser: toUserData,
      });
    }
  }

  return results;
}

/**
 * Create a new transfer request
 */
export async function createTransferRequest(data: {
  tenantId: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
}): Promise<{ id: string } | null> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRANSFER_EXPIRATION_DAYS);

  const [request] = await db
    .insert(storeTransferRequests)
    .values({
      tenantId: data.tenantId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      message: data.message || null,
      expiresAt: expiresAt.toISOString(),
    })
    .returning({ id: storeTransferRequests.id });

  return request ?? null;
}

/**
 * Update transfer request status
 */
export async function updateTransferRequestStatus(
  requestId: string,
  status: "accepted" | "rejected" | "cancelled" | "expired"
): Promise<boolean> {
  const [updated] = await db
    .update(storeTransferRequests)
    .set({
      status,
      respondedAt: new Date().toISOString(),
    })
    .where(eq(storeTransferRequests.id, requestId))
    .returning();

  return !!updated;
}

/**
 * Execute the actual ownership transfer (called after acceptance)
 * Uses a transaction to ensure atomicity
 */
export async function executeOwnershipTransfer(
  tenantId: string,
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // 1. Update tenants.ownerId to new owner
      await tx
        .update(tenants)
        .set({
          ownerId: toUserId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tenants.id, tenantId));

      // 2. Change old owner's tenant_members role to 'admin'
      await tx
        .update(tenantMembers)
        .set({
          role: "admin",
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(tenantMembers.tenantId, tenantId),
            eq(tenantMembers.userId, fromUserId)
          )
        );

      // 3. Check if new owner already has a membership
      const existingMembership = await tx.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, toUserId)
        ),
      });

      if (existingMembership) {
        // Update existing membership to owner
        await tx
          .update(tenantMembers)
          .set({
            role: "owner",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenantMembers.id, existingMembership.id));
      } else {
        // Create new owner membership
        await tx.insert(tenantMembers).values({
          tenantId,
          userId: toUserId,
          role: "owner",
        });
      }
    });

    return true;
  } catch (error) {
    console.error("Failed to execute ownership transfer:", error);
    return false;
  }
}

/**
 * Expire all pending requests past their expiration date
 * Returns the number of expired requests
 */
export async function expirePendingTransferRequests(): Promise<number> {
  const now = new Date().toISOString();

  const expired = await db
    .update(storeTransferRequests)
    .set({
      status: "expired",
      respondedAt: now,
    })
    .where(
      and(
        eq(storeTransferRequests.status, "pending"),
        lt(storeTransferRequests.expiresAt, now)
      )
    )
    .returning();

  return expired.length;
}
