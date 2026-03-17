"use client";

import { motion } from "framer-motion";
import {
  Check,
  Clock,
  PackageCheck,
  Truck,
  Package,
  XCircle,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type {
  OrderStatus,
  FulfillmentType,
  OrderChannel,
} from "@/lib/db/queries/orders";

interface OrderTimelineProps {
  status: OrderStatus;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  fulfillmentType?: FulfillmentType | null;
  channel?: OrderChannel | null;
}

type TimelineStep = {
  id: string;
  label: string;
  icon: React.ElementType;
  timestamp: string | null;
  description?: string;
};

// Status flows for different fulfillment types
const SHIPPING_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

const PICKUP_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing", // "Ready for Pickup"
  "delivered", // "Picked Up"
];

const POS_STATUSES: OrderStatus[] = [
  "pending",
  "delivered", // "Completed"
];

const CANCELLED_STATUSES: OrderStatus[] = ["cancelled", "returned"];

type TimelineContext = "shipping" | "pickup" | "pos" | "local_delivery";

function getTimelineContext(
  fulfillmentType?: FulfillmentType | null,
  channel?: OrderChannel | null
): TimelineContext {
  if (fulfillmentType === "instant" || channel === "pos") {
    return "pos";
  }
  if (fulfillmentType === "pickup" || fulfillmentType === "curbside") {
    return "pickup";
  }
  if (fulfillmentType === "local_delivery") {
    return "local_delivery";
  }
  return "shipping";
}

function getStatusOrder(context: TimelineContext): OrderStatus[] {
  switch (context) {
    case "pos":
      return POS_STATUSES;
    case "pickup":
      return PICKUP_STATUSES;
    case "local_delivery":
      return SHIPPING_STATUSES; // Uses same status flow as shipping
    default:
      return SHIPPING_STATUSES;
  }
}

function getStepIcon(
  status: string,
  isCancelled: boolean,
  context: TimelineContext
) {
  if (isCancelled) {
    if (status === "returned") {
      return RotateCcw;
    }
    return XCircle;
  }

  // Context-aware icons
  if (context === "pos") {
    switch (status) {
      case "pending":
        return Clock;
      case "delivered":
        return Check;
      default:
        return Clock;
    }
  }

  if (context === "pickup") {
    switch (status) {
      case "pending":
        return Clock;
      case "confirmed":
        return PackageCheck;
      case "processing":
        return ShoppingBag; // Ready for pickup
      case "delivered":
        return Store; // Picked up
      default:
        return Clock;
    }
  }

  // Local delivery context
  if (context === "local_delivery") {
    switch (status) {
      case "pending":
        return Clock;
      case "confirmed":
        return PackageCheck;
      case "processing":
        return Package; // Packing
      case "shipped":
        return Truck; // Out for delivery
      case "delivered":
        return Check;
      default:
        return Clock;
    }
  }

  // Shipping context
  switch (status) {
    case "pending":
      return Clock;
    case "confirmed":
      return PackageCheck;
    case "processing":
      return Package; // Preparing
    case "shipped":
      return Truck; // Shipped (carrier)
    case "delivered":
      return Check;
    default:
      return Clock;
  }
}

function getStepLabel(status: OrderStatus, context: TimelineContext): string {
  // Context-aware labels
  if (context === "pos") {
    switch (status) {
      case "pending":
        return "Order Placed";
      case "delivered":
        return "Completed";
      case "returned":
        return "Returned";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  }

  if (context === "pickup") {
    switch (status) {
      case "pending":
        return "Placed";
      case "confirmed":
        return "Confirmed";
      case "processing":
        return "Ready for Collection";
      case "delivered":
        return "Collected";
      case "returned":
        return "Returned";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  }

  if (context === "local_delivery") {
    switch (status) {
      case "pending":
        return "Placed";
      case "confirmed":
        return "Confirmed";
      case "processing":
        return "Packing";
      case "shipped":
        return "Out for Delivery";
      case "delivered":
        return "Completed";
      case "returned":
        return "Returned";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  }

  // Shipping context
  switch (status) {
    case "pending":
      return "Placed";
    case "confirmed":
      return "Confirmed";
    case "processing":
      return "Preparing";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Completed";
    case "returned":
      return "Returned";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function formatTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;
  return format(new Date(timestamp), "MMM d, h:mm a");
}

export function OrderTimeline({
  status,
  createdAt,
  confirmedAt,
  completedAt,
  cancelledAt,
  fulfillmentType,
  channel,
}: OrderTimelineProps) {
  const context = getTimelineContext(fulfillmentType, channel);
  const STATUS_ORDER = getStatusOrder(context);
  const isCancelled = CANCELLED_STATUSES.includes(status);
  const currentStatusIndex = STATUS_ORDER.indexOf(status);

  // Build steps based on whether order is cancelled or not
  const steps: TimelineStep[] = isCancelled
    ? [
        {
          id: "pending",
          label: getStepLabel("pending", context),
          icon: Clock,
          timestamp: createdAt,
        },
        {
          id: "cancelled",
          label: getStepLabel(status, context),
          icon: getStepIcon(status, true, context),
          timestamp: cancelledAt,
          description:
            status === "returned"
              ? "Items were returned"
              : "Order was cancelled",
        },
      ]
    : STATUS_ORDER.map((stepStatus, index) => {
        let timestamp: string | null = null;
        if (stepStatus === "pending") {
          timestamp = createdAt;
        } else if (stepStatus === "confirmed" && confirmedAt) {
          timestamp = confirmedAt;
        } else if (stepStatus === "delivered" && completedAt) {
          timestamp = completedAt;
        } else if (index <= currentStatusIndex && currentStatusIndex >= 0) {
          timestamp = null;
        }

        return {
          id: stepStatus,
          label: getStepLabel(stepStatus, context),
          icon: getStepIcon(stepStatus, false, context),
          timestamp:
            index <= currentStatusIndex && currentStatusIndex >= 0
              ? timestamp
              : null,
        };
      });

  // Check if a connector should be filled (completed)
  const isConnectorCompleted = (afterIndex: number) => {
    if (isCancelled) {
      return afterIndex === 0;
    }
    return (
      currentStatusIndex >= 0 &&
      STATUS_ORDER.indexOf(steps[afterIndex].id as OrderStatus) <
        currentStatusIndex
    );
  };

  return (
    <div className="w-full">
      {/* Desktop/Tablet: Horizontal timeline */}
      <div className="hidden sm:block">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
        >
          {steps.map((step, index) => {
            const isCompleted = isCancelled
              ? index === 0 || index === steps.length - 1
              : currentStatusIndex >= 0 &&
                STATUS_ORDER.indexOf(step.id as OrderStatus) <=
                  currentStatusIndex;
            const isActive = isCancelled
              ? index === steps.length - 1
              : step.id === status;
            const Icon = step.icon;
            const isFirst = index === 0;
            const isLast = index === steps.length - 1;

            // Connector states
            const prevConnectorCompleted =
              index > 0 && isConnectorCompleted(index - 1);
            const nextConnectorCompleted =
              !isLast && isConnectorCompleted(index);

            return (
              <div
                key={step.id}
                className="relative flex flex-col items-center"
              >
                {/* Connector line to the left (except first) */}
                {!isFirst && (
                  <div className="absolute top-5 right-1/2 h-0.5 w-1/2 -translate-y-1/2 bg-muted overflow-hidden">
                    <motion.div
                      className={cn(
                        "absolute inset-y-0 left-0 w-full",
                        isCancelled ? "bg-destructive" : "bg-primary"
                      )}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: prevConnectorCompleted ? 1 : 0 }}
                      style={{ transformOrigin: "left" }}
                      transition={{
                        duration: 0.4,
                        ease: "easeInOut",
                        delay: index * 0.1,
                      }}
                    />
                  </div>
                )}

                {/* Connector line to the right (except last) */}
                {!isLast && (
                  <div className="absolute top-5 left-1/2 h-0.5 w-1/2 -translate-y-1/2 bg-muted overflow-hidden">
                    <motion.div
                      className={cn(
                        "absolute inset-y-0 left-0 w-full",
                        isCancelled ? "bg-destructive" : "bg-primary"
                      )}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: nextConnectorCompleted ? 1 : 0 }}
                      style={{ transformOrigin: "left" }}
                      transition={{
                        duration: 0.4,
                        ease: "easeInOut",
                        delay: (index + 1) * 0.1,
                      }}
                    />
                  </div>
                )}

                {/* Circle - always centered */}
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative z-10 flex items-center justify-center size-10 rounded-full border-2",
                    isCompleted
                      ? isCancelled && index === steps.length - 1
                        ? "border-destructive bg-destructive text-white"
                        : "border-primary bg-primary text-white"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 20,
                        delay: index * 0.1,
                      }}
                    >
                      <Icon className="size-5" />
                    </motion.div>
                  ) : (
                    <Icon className="size-5" />
                  )}
                </motion.div>

                {/* Label and timestamp - always centered */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="mt-2 text-center"
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive
                        ? isCancelled
                          ? "text-destructive"
                          : "text-primary"
                        : isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.timestamp && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimestamp(step.timestamp)}
                    </p>
                  )}
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Vertical timeline */}
      <div className="sm:hidden space-y-0">
        {steps.map((step, index) => {
          const isCompleted = isCancelled
            ? index === 0 || index === steps.length - 1
            : currentStatusIndex >= 0 &&
              STATUS_ORDER.indexOf(step.id as OrderStatus) <=
                currentStatusIndex;
          const isActive = isCancelled
            ? index === steps.length - 1
            : step.id === status;
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex items-center justify-center size-8 rounded-full border-2 shrink-0",
                    isCompleted
                      ? isCancelled && index === steps.length - 1
                        ? "border-destructive bg-destructive text-white"
                        : "border-primary bg-primary text-white"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </motion.div>

                {/* Vertical line */}
                {!isLast && (
                  <div className="relative w-0.5 flex-1 min-h-8 bg-muted">
                    <motion.div
                      className={cn(
                        "absolute inset-x-0 top-0",
                        isCancelled ? "bg-destructive" : "bg-primary"
                      )}
                      initial={{ height: 0 }}
                      animate={{
                        height: isConnectorCompleted(index) ? "100%" : "0%",
                      }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    />
                  </div>
                )}
              </div>

              {/* Content column */}
              <div className={cn("pb-6", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-medium leading-none",
                    isActive
                      ? isCancelled
                        ? "text-destructive"
                        : "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(step.timestamp)}
                  </p>
                )}
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
