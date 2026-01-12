"use client";

import { useState, useTransition } from "react";
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

interface OrderStatusSelectProps {
  orderId: string;
  tenantId: string;
  currentStatus: OrderStatusType;
}

export function OrderStatusSelect({
  orderId,
  tenantId,
  currentStatus,
}: OrderStatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);

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
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
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
        <SelectTrigger className="w-44">
          {isDisabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {ALL_STATUSES.map((status) => (
            <SelectItem
              key={status}
              value={status}
              className={
                DESTRUCTIVE_STATUSES.includes(status)
                  ? "text-destructive focus:text-destructive"
                  : undefined
              }
            >
              {STATUS_LABELS[status]}
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
                : pendingStatus === "refunded"
                  ? "Refund Order"
                  : "Partial Refund"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "cancelled"
                ? "Are you sure you want to cancel this order? This action cannot be undone."
                : pendingStatus === "refunded"
                  ? "Are you sure you want to mark this order as fully refunded?"
                  : "Are you sure you want to mark this order as partially refunded?"}
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
