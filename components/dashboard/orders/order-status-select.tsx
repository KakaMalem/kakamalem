"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateOrderStatus } from "@/lib/actions/orders";
import {
  getValidNextStatuses,
  type OrderStatusType,
} from "@/lib/validations/orders";

interface OrderStatusSelectProps {
  orderId: string;
  tenantId: string;
  currentStatus: OrderStatusType;
}

const STATUS_LABELS: Record<OrderStatusType, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

const DESTRUCTIVE_STATUSES: OrderStatusType[] = [
  "cancelled",
  "refunded",
  "partially_refunded",
];

export function OrderStatusSelect({
  orderId,
  tenantId,
  currentStatus,
}: OrderStatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);

  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatusType | null>(
    null
  );
  const [staffNote, setStaffNote] = useState("");

  const validNextStatuses = getValidNextStatuses(currentStatus);

  const handleStatusSelect = (newStatus: OrderStatusType) => {
    // Show confirmation for destructive actions
    if (DESTRUCTIVE_STATUSES.includes(newStatus)) {
      setPendingStatus(newStatus);
      setStaffNote("");
      setConfirmDialogOpen(true);
    } else {
      performStatusUpdate(newStatus);
    }
  };

  const performStatusUpdate = async (
    newStatus: OrderStatusType,
    note?: string
  ) => {
    setIsUpdating(true);

    const result = await updateOrderStatus(tenantId, orderId, newStatus, note);

    if (result.success) {
      toast.success(`Order updated to ${STATUS_LABELS[newStatus]}`);
      startTransition(() => {
        router.refresh();
      });
    } else {
      toast.error(result.error?.message || "Failed to update order");
    }

    setIsUpdating(false);
    setConfirmDialogOpen(false);
    setPendingStatus(null);
    setStaffNote("");
  };

  const handleConfirmUpdate = () => {
    if (pendingStatus) {
      performStatusUpdate(pendingStatus, staffNote || undefined);
    }
  };

  if (validNextStatuses.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || isUpdating}
          >
            {isPending || isUpdating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Update Status
                <ChevronDown className="size-4" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {validNextStatuses.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              className={
                DESTRUCTIVE_STATUSES.includes(status)
                  ? "text-destructive focus:text-destructive"
                  : undefined
              }
            >
              {STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog for Destructive Actions */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "cancelled"
                ? "Cancel Order"
                : pendingStatus === "refunded"
                  ? "Refund Order"
                  : "Update Status"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "cancelled"
                ? "Are you sure you want to cancel this order? This action cannot be undone."
                : pendingStatus === "refunded"
                  ? "Are you sure you want to mark this order as refunded?"
                  : `Are you sure you want to change the status to ${pendingStatus ? STATUS_LABELS[pendingStatus] : ""}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="staff-note">Note (optional)</Label>
            <Textarea
              id="staff-note"
              placeholder="Add a note about this status change..."
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isUpdating}
              variant={
                pendingStatus && DESTRUCTIVE_STATUSES.includes(pendingStatus)
                  ? "destructive"
                  : "default"
              }
            >
              {isUpdating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
