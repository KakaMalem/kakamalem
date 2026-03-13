"use client";

import Link from "next/link";
import {
  ShoppingBag,
  Check,
  User,
  Store,
  CreditCard,
  Clock,
  AlertCircle,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOrderStatusInfoWithContext } from "@/lib/utils/order-status";
import type {
  DashboardOrder,
  FulfillmentType,
  PaymentStatus,
} from "@/lib/db/queries/orders";
import type { OrderChannel } from "@/lib/db/schema";

interface OrdersListProps {
  orders: DashboardOrder[];
  storeSlug: string;
  tenantId: string;
  currency: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  selectionMode: boolean;
}

const BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  default: "default",
  secondary: "secondary",
  destructive: "destructive",
  outline: "outline",
};

const PAYMENT_STATUS_STYLES: Record<
  PaymentStatus,
  {
    label: string;
    icon: typeof CreditCard;
    className: string;
  }
> = {
  unpaid: {
    label: "Unpaid",
    icon: Clock,
    className: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
  partial: {
    label: "Partial",
    icon: AlertCircle,
    className: "text-orange-600 bg-orange-50 border-orange-200",
  },
  paid: {
    label: "Paid",
    icon: CreditCard,
    className: "text-green-600 bg-green-50 border-green-200",
  },
  refunded: {
    label: "Refunded",
    icon: CreditCard,
    className: "text-gray-600 bg-gray-50 border-gray-200",
  },
  partial_refund: {
    label: "Partial Refund",
    icon: CreditCard,
    className: "text-gray-600 bg-gray-50 border-gray-200",
  },
};

function OrderCard({
  order,
  storeSlug,
  currency,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  order: DashboardOrder;
  storeSlug: string;
  currency: string;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  // Get context-aware status label (shows "Completed" for POS, "Picked Up" for pickup, etc.)
  const statusInfo = getOrderStatusInfoWithContext(
    order.status,
    order.fulfillmentType as FulfillmentType | null,
    order.channel as OrderChannel | null
  );
  const statusStyle = {
    label: statusInfo.label,
    variant: BADGE_VARIANTS[statusInfo.color] || ("outline" as const),
  };
  const paymentStyle =
    PAYMENT_STATUS_STYLES[order.paymentStatus] || PAYMENT_STATUS_STYLES.unpaid;
  const PaymentIcon = paymentStyle.icon;

  return (
    <Card
      className={cn(
        "transition-colors",
        selectionMode && isSelected && "ring-2 ring-primary"
      )}
    >
      <CardContent className="flex items-center gap-4 px-3 py-3 sm:px-4">
        {/* Selection checkbox or order icon */}
        {selectionMode ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            onClick={onToggleSelection}
            className="group relative flex shrink-0 items-center justify-center outline-none cursor-pointer"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-full border bg-background transition-all duration-150",
                isSelected
                  ? "border-foreground"
                  : "border-muted-foreground/40 group-hover:border-muted-foreground/60"
              )}
            >
              <div
                className={cn(
                  "rounded-full bg-foreground p-0.5 transition-all duration-100",
                  isSelected ? "scale-100 opacity-100" : "scale-90 opacity-0"
                )}
              >
                <Check className="size-3 text-background" strokeWidth={3} />
              </div>
            </div>
            <div className="size-5" />
          </button>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="size-5 text-muted-foreground" />
          </div>
        )}

        {/* Order Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/${storeSlug}/orders/${order.id}`}
              className="font-medium hover:underline"
            >
              {order.orderNumber}
            </Link>
            {/* Desktop badges */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
              {order.channel === "pos" && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Store className="size-3" />
                  In-Store
                </Badge>
              )}
              {/* Payment status badge */}
              <Badge
                variant="outline"
                className={cn("gap-1 text-xs", paymentStyle.className)}
              >
                <PaymentIcon className="size-3" />
                {paymentStyle.label}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="size-3" />
              <span className="truncate max-w-32">
                {order.customerSnapshot.name}
              </span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">{order.itemCount} items</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">
              <RelativeTime date={order.createdAt} />
            </span>
          </div>
          {/* Mobile only */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:hidden">
            <Badge variant={statusStyle.variant} className="text-xs">
              {statusStyle.label}
            </Badge>
            {order.channel === "pos" && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Store className="size-3" />
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("gap-1 text-xs", paymentStyle.className)}
            >
              <PaymentIcon className="size-3" />
            </Badge>
            <span>{order.itemCount} items</span>
          </div>
        </div>

        {/* Total */}
        <div className="shrink-0 text-right">
          <div className="font-semibold">{formatPrice(order.total)}</div>
          <div className="text-xs text-muted-foreground sm:hidden">
            <RelativeTime date={order.createdAt} showTooltip={false} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrdersList({
  orders,
  storeSlug,
  currency,
  selectedIds,
  onSelectionChange,
  selectionMode,
}: OrdersListProps) {
  const toggleSelection = (orderId: string) => {
    const next = new Set(selectedIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    onSelectionChange(next);
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
        <div className="mb-4 rounded-full bg-muted p-4">
          <ShoppingBag className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">No orders yet</h3>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          When customers place orders, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          storeSlug={storeSlug}
          currency={currency}
          selectionMode={selectionMode}
          isSelected={selectedIds.has(order.id)}
          onToggleSelection={() => toggleSelection(order.id)}
        />
      ))}
    </div>
  );
}
