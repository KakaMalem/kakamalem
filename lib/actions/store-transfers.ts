"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/server";
import { getTenantById } from "@/lib/db/queries/tenants";
import { findUserByEmail } from "@/lib/db/queries/team";
import {
  createTransferRequest,
  getPendingTransferRequest,
  getTransferRequestById,
  updateTransferRequestStatus,
  executeOwnershipTransfer,
  getPendingTransferRequestsForUser,
  type TransferRequestWithDetails,
} from "@/lib/db/queries/store-transfers";
import {
  notifyTransferRequest,
  notifyTransferAccepted,
  notifyTransferRejected,
  notifyTransferCancelled,
} from "@/lib/notifications/store-transfers";
import { initiateTransferSchema } from "@/lib/validations/store-transfers";

type ActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Initiate a store ownership transfer
 * Only the current owner can do this
 */
export async function initiateStoreTransfer(
  storeId: string,
  formData: {
    newOwnerEmail: string;
    message?: string;
    confirmStoreName: string;
  }
): Promise<ActionResult> {
  const currentUser = await getUser();

  if (!currentUser) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  // Validate input
  const validation = initiateTransferSchema.safeParse(formData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return {
      success: false,
      error: {
        message: firstError.message,
        field: firstError.path[0] as string,
      },
    };
  }

  // Verify user is the store owner
  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== currentUser.id) {
    return {
      success: false,
      error: { message: "You don't have permission to transfer this store" },
    };
  }

  // Validate store name confirmation
  if (formData.confirmStoreName.toLowerCase() !== store.name.toLowerCase()) {
    return {
      success: false,
      error: {
        message: "Store name doesn't match",
        field: "confirmStoreName",
      },
    };
  }

  // Check no pending transfer exists
  const existingTransfer = await getPendingTransferRequest(storeId);
  if (existingTransfer) {
    return {
      success: false,
      error: {
        message: "A transfer request is already pending for this store",
      },
    };
  }

  // Find the new owner by email
  const newOwner = await findUserByEmail(formData.newOwnerEmail.toLowerCase());
  if (!newOwner) {
    return {
      success: false,
      error: {
        message:
          "No user found with this email. They need to create an account first.",
        field: "newOwnerEmail",
      },
    };
  }

  // Can't transfer to yourself
  if (newOwner.id === currentUser.id) {
    return {
      success: false,
      error: {
        message: "You can't transfer the store to yourself",
        field: "newOwnerEmail",
      },
    };
  }

  try {
    // Create transfer request
    const request = await createTransferRequest({
      tenantId: storeId,
      fromUserId: currentUser.id,
      toUserId: newOwner.id,
      message: formData.message,
    });

    if (!request) {
      return {
        success: false,
        error: { message: "Failed to create transfer request" },
      };
    }

    // Notify the new owner
    await notifyTransferRequest({
      toUserId: newOwner.id,
      fromUserName: currentUser.name || currentUser.email,
      storeName: store.name,
      storeSlug: store.slug,
      requestId: request.id,
    });

    revalidatePath(`/dashboard/${store.slug}/settings/danger`, "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to initiate store transfer:", error);
    return {
      success: false,
      error: {
        message: "Failed to create transfer request. Please try again.",
      },
    };
  }
}

/**
 * Cancel a pending transfer request
 * Only the current owner (initiator) can cancel
 */
export async function cancelStoreTransfer(
  storeId: string,
  requestId: string
): Promise<ActionResult> {
  const currentUser = await getUser();

  if (!currentUser) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  // Verify user is the store owner
  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== currentUser.id) {
    return {
      success: false,
      error: { message: "You don't have permission to cancel this transfer" },
    };
  }

  // Get the transfer request
  const request = await getTransferRequestById(requestId);
  if (!request) {
    return {
      success: false,
      error: { message: "Transfer request not found" },
    };
  }

  if (request.tenantId !== storeId) {
    return {
      success: false,
      error: { message: "Transfer request doesn't match this store" },
    };
  }

  if (request.status !== "pending") {
    return {
      success: false,
      error: { message: "This transfer request is no longer pending" },
    };
  }

  try {
    await updateTransferRequestStatus(requestId, "cancelled");

    // Notify the recipient
    await notifyTransferCancelled({
      toUserId: request.toUser.id,
      ownerName: currentUser.name || currentUser.email,
      storeName: store.name,
    });

    revalidatePath(`/dashboard/${store.slug}/settings/danger`, "page");
    revalidatePath("/dashboard/transfers", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel store transfer:", error);
    return {
      success: false,
      error: { message: "Failed to cancel transfer. Please try again." },
    };
  }
}

/**
 * Accept a store transfer
 * Only the designated new owner can accept
 */
export async function acceptStoreTransfer(
  requestId: string
): Promise<ActionResult> {
  const currentUser = await getUser();

  if (!currentUser) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  // Get the transfer request
  const request = await getTransferRequestById(requestId);
  if (!request) {
    return {
      success: false,
      error: { message: "Transfer request not found" },
    };
  }

  // Verify user is the recipient
  if (request.toUser.id !== currentUser.id) {
    return {
      success: false,
      error: { message: "You don't have permission to accept this transfer" },
    };
  }

  if (request.status !== "pending") {
    return {
      success: false,
      error: { message: "This transfer request is no longer pending" },
    };
  }

  // Check if expired
  if (new Date(request.expiresAt) < new Date()) {
    await updateTransferRequestStatus(requestId, "expired");
    return {
      success: false,
      error: { message: "This transfer request has expired" },
    };
  }

  try {
    // Execute the ownership transfer
    const transferred = await executeOwnershipTransfer(
      request.tenantId,
      request.fromUser.id,
      request.toUser.id
    );

    if (!transferred) {
      return {
        success: false,
        error: { message: "Failed to transfer ownership" },
      };
    }

    // Update request status
    await updateTransferRequestStatus(requestId, "accepted");

    // Notify old owner
    await notifyTransferAccepted({
      toUserId: request.fromUser.id,
      newOwnerName: currentUser.name || currentUser.email,
      storeName: request.tenant.name,
      storeSlug: request.tenant.slug,
    });

    revalidatePath(`/dashboard/${request.tenant.slug}`, "layout");
    revalidatePath("/dashboard/transfers", "page");
    revalidatePath("/dashboard", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to accept store transfer:", error);
    return {
      success: false,
      error: { message: "Failed to complete transfer. Please try again." },
    };
  }
}

/**
 * Reject a store transfer
 * Only the designated new owner can reject
 */
export async function rejectStoreTransfer(
  requestId: string
): Promise<ActionResult> {
  const currentUser = await getUser();

  if (!currentUser) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  // Get the transfer request
  const request = await getTransferRequestById(requestId);
  if (!request) {
    return {
      success: false,
      error: { message: "Transfer request not found" },
    };
  }

  // Verify user is the recipient
  if (request.toUser.id !== currentUser.id) {
    return {
      success: false,
      error: { message: "You don't have permission to reject this transfer" },
    };
  }

  if (request.status !== "pending") {
    return {
      success: false,
      error: { message: "This transfer request is no longer pending" },
    };
  }

  try {
    await updateTransferRequestStatus(requestId, "rejected");

    // Notify old owner
    await notifyTransferRejected({
      toUserId: request.fromUser.id,
      rejectorName: currentUser.name || currentUser.email,
      storeName: request.tenant.name,
      storeSlug: request.tenant.slug,
    });

    revalidatePath(`/dashboard/${request.tenant.slug}/settings/danger`, "page");
    revalidatePath("/dashboard/transfers", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to reject store transfer:", error);
    return {
      success: false,
      error: { message: "Failed to reject transfer. Please try again." },
    };
  }
}

/**
 * Get pending transfers for the current user (as recipient)
 */
export async function getMyPendingTransfers(): Promise<
  TransferRequestWithDetails[]
> {
  const currentUser = await getUser();
  if (!currentUser) return [];

  return getPendingTransferRequestsForUser(currentUser.id);
}
