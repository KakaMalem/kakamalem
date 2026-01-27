import { sendNotificationToUser } from "@/lib/push";

/**
 * Notify user of incoming transfer request
 */
export async function notifyTransferRequest({
  toUserId,
  fromUserName,
  storeName,
  storeSlug,
  requestId,
}: {
  toUserId: string;
  fromUserName: string;
  storeName: string;
  storeSlug: string;
  requestId: string;
}): Promise<void> {
  await sendNotificationToUser({
    userId: toUserId,
    payload: {
      type: "store_transfer_request",
      title: "Store Transfer Request",
      body: `${fromUserName || "Someone"} wants to transfer ownership of "${storeName}" to you.`,
      data: { requestId, storeName, storeSlug },
      actionUrl: "/dashboard/transfers",
      actionLabel: "View Request",
    },
  });
}

/**
 * Notify old owner that transfer was accepted
 */
export async function notifyTransferAccepted({
  toUserId,
  newOwnerName,
  storeName,
  storeSlug,
}: {
  toUserId: string;
  newOwnerName: string;
  storeName: string;
  storeSlug: string;
}): Promise<void> {
  await sendNotificationToUser({
    userId: toUserId,
    payload: {
      type: "store_transfer_accepted",
      title: "Transfer Completed",
      body: `${newOwnerName || "The new owner"} has accepted ownership of "${storeName}". You are now an Admin.`,
      data: { storeName, storeSlug },
      actionUrl: `/dashboard/${storeSlug}`,
      actionLabel: "View Store",
    },
  });
}

/**
 * Notify old owner that transfer was rejected
 */
export async function notifyTransferRejected({
  toUserId,
  rejectorName,
  storeName,
  storeSlug,
}: {
  toUserId: string;
  rejectorName: string;
  storeName: string;
  storeSlug: string;
}): Promise<void> {
  await sendNotificationToUser({
    userId: toUserId,
    payload: {
      type: "store_transfer_rejected",
      title: "Transfer Declined",
      body: `${rejectorName || "The recipient"} has declined ownership of "${storeName}".`,
      data: { storeName, storeSlug },
      actionUrl: `/dashboard/${storeSlug}/settings/danger`,
      actionLabel: "View Store Settings",
    },
  });
}

/**
 * Notify new owner that transfer was cancelled
 */
export async function notifyTransferCancelled({
  toUserId,
  ownerName,
  storeName,
}: {
  toUserId: string;
  ownerName: string;
  storeName: string;
}): Promise<void> {
  await sendNotificationToUser({
    userId: toUserId,
    payload: {
      type: "store_transfer_cancelled",
      title: "Transfer Cancelled",
      body: `${ownerName || "The store owner"} has cancelled the transfer request for "${storeName}".`,
      data: { storeName },
      actionUrl: "/dashboard/transfers",
      actionLabel: "View Transfers",
    },
  });
}

/**
 * Notify user that transfer request expired
 */
export async function notifyTransferExpired({
  toUserId,
  storeName,
  isRecipient,
}: {
  toUserId: string;
  storeName: string;
  isRecipient: boolean;
}): Promise<void> {
  const body = isRecipient
    ? `The transfer request for "${storeName}" has expired.`
    : `Your transfer request for "${storeName}" has expired. The recipient did not respond in time.`;

  await sendNotificationToUser({
    userId: toUserId,
    payload: {
      type: "store_transfer_expired",
      title: "Transfer Request Expired",
      body,
      data: { storeName },
      actionUrl: isRecipient ? "/dashboard/transfers" : "/dashboard",
      actionLabel: isRecipient ? "View Transfers" : "Go to Dashboard",
    },
  });
}
