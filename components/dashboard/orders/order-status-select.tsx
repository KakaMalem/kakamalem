"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateOrderStatus } from "@/lib/actions/orders";
import {
  ALL_STATUSES,
  STATUS_LABELS,
  DESTRUCTIVE_STATUSES,
  type OrderStatusType,
} from "@/lib/validations/orders";
import type { FulfillmentType, OrderChannel } from "@/lib/utils/order-status";

// Legacy status labels for orders that haven't been migrated yet
const LEGACY_STATUS_LABELS: Record<string, string> = {
  refunded: "Refunded (Legacy)",
  partially_refunded: "Partial Refund (Legacy)",
};

// Context-aware status labels based on fulfillment type
const POS_STATUS_LABELS: Partial<Record<OrderStatusType, string>> = {
  pending: "Awaiting Payment",
  confirmed: "Completed",
  processing: "Completed",
  shipped: "Completed",
  delivered: "Completed",
  returned: "Returned",
  cancelled: "Cancelled",
};

const PICKUP_STATUS_LABELS: Partial<Record<OrderStatusType, string>> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Ready for Pickup",
  shipped: "Picked Up",
  delivered: "Picked Up",
  returned: "Returned",
  cancelled: "Cancelled",
};

// Relevant statuses for each fulfillment type
const POS_STATUSES: OrderStatusType[] = [
  "pending",
  "delivered",
  "returned",
  "cancelled",
];
const PICKUP_STATUSES: OrderStatusType[] = [
  "pending",
  "confirmed",
  "processing",
  "delivered",
  "returned",
  "cancelled",
];
const SHIPPING_STATUSES: OrderStatusType[] = ALL_STATUSES;

interface OrderStatusSelectProps {
  orderId: string;
  tenantId: string;
  currentStatus: string; // Can be OrderStatusType or legacy values
  fulfillmentType?: FulfillmentType | null;
  channel?: OrderChannel | null;
}

export function OrderStatusSelect({
  orderId,
  tenantId,
  currentStatus,
  fulfillmentType,
  channel,
}: OrderStatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);

  // Determine if this is a POS/instant fulfillment order
  const isInstant = fulfillmentType === "instant" || channel === "pos";
  const isPickup =
    fulfillmentType === "pickup" || fulfillmentType === "curbside";

  // Get context-aware statuses and labels
  const { availableStatuses, statusLabels } = useMemo(() => {
    let statuses: OrderStatusType[];
    let labels: Record<OrderStatusType, string>;

    if (isInstant) {
      statuses = POS_STATUSES;
      labels = { ...STATUS_LABELS, ...POS_STATUS_LABELS };
    } else if (isPickup) {
      statuses = PICKUP_STATUSES;
      labels = { ...STATUS_LABELS, ...PICKUP_STATUS_LABELS };
    } else {
      statuses = SHIPPING_STATUSES;
      labels = STATUS_LABELS;
    }

    // Ensure current status is always in the list (for legacy/edge cases)
    const currentAsStatus = currentStatus as OrderStatusType;
    if (
      ALL_STATUSES.includes(currentAsStatus) &&
      !statuses.includes(currentAsStatus)
    ) {
      statuses = [currentAsStatus, ...statuses];
    }

    return { availableStatuses: statuses, statusLabels: labels };
  }, [isInstant, isPickup, currentStatus]);

  // Check if current status is a legacy value
  const isLegacyStatus = !ALL_STATUSES.includes(
    currentStatus as OrderStatusType
  );

  // Confirmation dialog state for destructive actions
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatusType | null>(
    null
  );

  const handleStatusChange = (newStatus: string) => {
    const status = newStatus as OrderStatusType;
    if (status === currentStatus) return;

    // Show confirmation for destructive actions
    if (DESTRUCTIVE_STATUSES.includes(status)) {
      setPendingStatus(status);
      setConfirmDialogOpen(true);
    } else {
      performStatusUpdate(status);
    }
  };

  const performStatusUpdate = async (newStatus: OrderStatusType) => {
    setIsUpdating(true);

    const result = await updateOrderStatus(tenantId, orderId, newStatus);

    if (result.success) {
      toast.success(`Status updated to ${statusLabels[newStatus]}`);
      startTransition(() => {
        router.refresh();
      });
    } else {
      toast.error(result.error?.message || "Failed to update status");
    }

    setIsUpdating(false);
    setConfirmDialogOpen(false);
    setPendingStatus(null);
  };

  const handleConfirmUpdate = () => {
    if (pendingStatus) {
      performStatusUpdate(pendingStatus);
    }
  };

  const isDisabled = isPending || isUpdating;

  return (
    <>
      <Select
        value={currentStatus}
        onValueChange={handleStatusChange}
        disabled={isDisabled}
      >
        <SelectTrigger className="w-44 h-10">
          {isDisabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {/* Show legacy status as first option if applicable */}
          {isLegacyStatus && (
            <SelectItem
              value={currentStatus}
              className="text-muted-foreground"
              disabled
            >
              {LEGACY_STATUS_LABELS[currentStatus] || currentStatus}
            </SelectItem>
          )}
          {availableStatuses.map((status) => (
            <SelectItem
              key={status}
              value={status}
              className={
                DESTRUCTIVE_STATUSES.includes(status)
                  ? "text-destructive focus:text-destructive"
                  : undefined
              }
            >
              {statusLabels[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Confirmation Dialog for Destructive Actions */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "cancelled"
                ? "Cancel Order"
                : pendingStatus === "returned"
                  ? "Mark as Returned"
                  : "Confirm Status Change"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "cancelled"
                ? "Are you sure you want to cancel this order? This action cannot be undone."
                : pendingStatus === "returned"
                  ? "Are you sure you want to mark this order as returned? This indicates the items have been sent back."
                  : "Are you sure you want to change this order's status?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isUpdating}
              variant="destructive"
            >
              {isUpdating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
