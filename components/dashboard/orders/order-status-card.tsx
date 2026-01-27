"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Home,
  XCircle,
  RotateCcw,
  Loader2,
  ChevronRight,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { updateOrderStatus } from "@/lib/actions/orders";
import {
  DESTRUCTIVE_STATUSES,
  type OrderStatusType,
} from "@/lib/validations/orders";
import type { FulfillmentType, OrderChannel } from "@/lib/db/queries/orders";

type StatusContext = "shipping" | "pickup" | "pos";

type StatusVisualConfig = {
  icon: typeof Clock;
  color: string;
  bgColor: string;
  borderColor: string;
};

// Visual styling for each status (context-independent)
const STATUS_VISUALS: Record<OrderStatusType, StatusVisualConfig> = {
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  confirmed: {
    icon: CheckCircle2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  processing: {
    icon: Package,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  shipped: {
    icon: Truck,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  delivered: {
    icon: Home,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  returned: {
    icon: RotateCcw,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
};

// Context-aware status configurations
type ContextStatusConfig = {
  label: string;
  description: string;
  nextAction?: string;
  nextStatus?: OrderStatusType;
  icon?: typeof Clock;
  canCancel?: boolean;
  canReturn?: boolean;
};

// Shipping context (default)
const SHIPPING_STATUS_CONFIG: Record<OrderStatusType, ContextStatusConfig> = {
  pending: {
    label: "Pending",
    description: "Waiting for confirmation",
    nextAction: "Confirm Order",
    nextStatus: "confirmed",
    canCancel: true,
  },
  confirmed: {
    label: "Confirmed",
    description: "Order confirmed, preparing",
    nextAction: "Start Processing",
    nextStatus: "processing",
    canCancel: true,
  },
  processing: {
    label: "Processing",
    description: "Being prepared for shipment",
    nextAction: "Mark as Shipped",
    nextStatus: "shipped",
    canCancel: true,
  },
  shipped: {
    label: "Shipped",
    description: "On the way to customer",
    nextAction: "Mark Delivered",
    nextStatus: "delivered",
    canCancel: true,
    canReturn: true,
  },
  delivered: {
    label: "Delivered",
    description: "Successfully delivered",
    canReturn: true,
  },
  cancelled: {
    label: "Cancelled",
    description: "Order was cancelled",
  },
  returned: {
    label: "Returned",
    description: "Items returned by customer",
  },
};

// Pickup context
const PICKUP_STATUS_CONFIG: Record<OrderStatusType, ContextStatusConfig> = {
  pending: {
    label: "Pending",
    description: "Waiting for confirmation",
    nextAction: "Confirm Order",
    nextStatus: "confirmed",
    canCancel: true,
  },
  confirmed: {
    label: "Confirmed",
    description: "Order confirmed, preparing",
    nextAction: "Mark Ready",
    nextStatus: "processing",
    canCancel: true,
  },
  processing: {
    label: "Ready for Pickup",
    description: "Items ready for customer pickup",
    nextAction: "Mark Picked Up",
    nextStatus: "delivered",
    icon: ShoppingBag,
    canCancel: true,
  },
  shipped: {
    label: "Picked Up",
    description: "Customer picked up the order",
    icon: Store,
    canReturn: true,
  },
  delivered: {
    label: "Picked Up",
    description: "Customer picked up the order",
    icon: Store,
    canReturn: true,
  },
  cancelled: {
    label: "Cancelled",
    description: "Order was cancelled",
  },
  returned: {
    label: "Returned",
    description: "Items returned by customer",
  },
};

// POS/Instant context
const POS_STATUS_CONFIG: Record<OrderStatusType, ContextStatusConfig> = {
  pending: {
    label: "Awaiting Payment",
    description: "Sale recorded, awaiting payment",
    nextAction: "Complete Sale",
    nextStatus: "delivered",
    canCancel: true,
  },
  confirmed: {
    label: "Completed",
    description: "Sale completed",
    icon: CheckCircle2,
    canReturn: true,
  },
  processing: {
    label: "Completed",
    description: "Sale completed",
    icon: CheckCircle2,
    canReturn: true,
  },
  shipped: {
    label: "Completed",
    description: "Sale completed",
    icon: CheckCircle2,
    canReturn: true,
  },
  delivered: {
    label: "Completed",
    description: "Sale completed",
    icon: CheckCircle2,
    canReturn: true,
  },
  cancelled: {
    label: "Cancelled",
    description: "Sale was cancelled",
  },
  returned: {
    label: "Returned",
    description: "Items returned",
  },
};

function getStatusContext(
  fulfillmentType?: FulfillmentType | null,
  channel?: OrderChannel | null
): StatusContext {
  if (fulfillmentType === "instant" || channel === "pos") {
    return "pos";
  }
  if (fulfillmentType === "pickup" || fulfillmentType === "curbside") {
    return "pickup";
  }
  return "shipping";
}

function getStatusConfig(
  context: StatusContext
): Record<OrderStatusType, ContextStatusConfig> {
  switch (context) {
    case "pos":
      return POS_STATUS_CONFIG;
    case "pickup":
      return PICKUP_STATUS_CONFIG;
    default:
      return SHIPPING_STATUS_CONFIG;
  }
}

interface OrderStatusCardProps {
  orderId: string;
  tenantId: string;
  currentStatus: string;
  showActions?: boolean;
  compact?: boolean;
  fulfillmentType?: FulfillmentType | null;
  channel?: OrderChannel | null;
}

export function OrderStatusCard({
  orderId,
  tenantId,
  currentStatus,
  showActions = true,
  compact = false,
  fulfillmentType,
  channel,
}: OrderStatusCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatusType | null>(
    null
  );

  // Get context-aware configuration
  const context = getStatusContext(fulfillmentType, channel);
  const contextConfig = useMemo(() => getStatusConfig(context), [context]);

  // Get status config (fallback for legacy statuses)
  const status = currentStatus as OrderStatusType;
  const statusConfig = contextConfig[status] || contextConfig.pending;
  const visuals = STATUS_VISUALS[status] || STATUS_VISUALS.pending;

  // Use context-specific icon if provided, otherwise use visual default
  const Icon = statusConfig.icon || visuals.icon;

  // Get valid next action
  const { nextStatus, nextAction, canCancel, canReturn } = statusConfig;

  const handleStatusChange = (newStatus: OrderStatusType) => {
    if (DESTRUCTIVE_STATUSES.includes(newStatus)) {
      setPendingStatus(newStatus);
      setConfirmDialogOpen(true);
    } else {
      performStatusUpdate(newStatus);
    }
  };

  const performStatusUpdate = async (newStatus: OrderStatusType) => {
    setIsUpdating(true);

    const result = await updateOrderStatus(tenantId, orderId, newStatus);
    const targetConfig = contextConfig[newStatus];

    if (result.success) {
      toast.success(`Status updated to ${targetConfig?.label || newStatus}`);
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

  const isDisabled = isPending || isUpdating;
  const hasActions = nextAction || canCancel || canReturn;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3",
          visuals.bgColor,
          visuals.borderColor
        )}
      >
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            visuals.bgColor
          )}
        >
          <Icon className={cn("size-5", visuals.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-semibold", visuals.color)}>
            {statusConfig.label}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {statusConfig.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className={cn("overflow-hidden border-2", visuals.borderColor)}>
        <CardContent className="p-0">
          {/* Status Display */}
          <div className={cn("p-6 text-center", visuals.bgColor)}>
            <div
              className={cn(
                "mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm"
              )}
            >
              <Icon className={cn("size-10", visuals.color)} />
            </div>
            <h3 className={cn("text-2xl font-bold", visuals.color)}>
              {statusConfig.label}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusConfig.description}
            </p>
          </div>

          {/* Actions */}
          {showActions && hasActions && (
            <div className="border-t p-4 space-y-3">
              {/* Primary next action */}
              {nextStatus && nextAction && (
                <Button
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={isDisabled}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {isUpdating ? (
                    <Loader2 className="mr-2 size-5 animate-spin" />
                  ) : (
                    <ChevronRight className="mr-2 size-5" />
                  )}
                  {nextAction}
                </Button>
              )}

              {/* Secondary actions */}
              {(canReturn || canCancel) && (
                <div className="flex gap-2">
                  {canReturn && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange("returned")}
                      disabled={isDisabled}
                      className="flex-1 h-11"
                    >
                      <RotateCcw className="mr-2 size-4" />
                      Return
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange("cancelled")}
                      disabled={isDisabled}
                      className={cn(
                        "flex-1 h-11",
                        "text-destructive hover:text-destructive hover:bg-destructive/10"
                      )}
                    >
                      <XCircle className="mr-2 size-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "cancelled"
                ? context === "pos"
                  ? "Cancel this sale?"
                  : "Cancel this order?"
                : pendingStatus === "returned"
                  ? "Mark as returned?"
                  : "Confirm status change"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "cancelled"
                ? context === "pos"
                  ? "This will cancel the sale. This action cannot be undone."
                  : "This will cancel the order. This action cannot be undone."
                : pendingStatus === "returned"
                  ? "This indicates the items have been returned by the customer."
                  : "Are you sure you want to change this order's status?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>
              No, go back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingStatus && performStatusUpdate(pendingStatus)
              }
              disabled={isUpdating}
              className={cn(
                pendingStatus === "cancelled" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>Yes, {pendingStatus === "cancelled" ? "cancel" : "confirm"}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
