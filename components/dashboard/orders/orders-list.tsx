"use client";

import Link from "next/link";
import { ShoppingBag, Check, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardOrder, OrderStatus } from "@/lib/db/queries/orders";

interface OrdersListProps {
  orders: DashboardOrder[];
  storeSlug: string;
  tenantId: string;
  currency: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  selectionMode: boolean;
}

const STATUS_STYLES: Record<
  OrderStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  processing: { label: "Processing", variant: "default" },
  shipped: { label: "Shipped", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  refunded: { label: "Refunded", variant: "destructive" },
  partially_refunded: { label: "Partial Refund", variant: "outline" },
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const statusStyle = STATUS_STYLES[order.status];

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
            {/* Desktop badge */}
            <div className="hidden sm:block">
              <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
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
              {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
            </span>
          </div>
          {/* Mobile only */}
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground sm:hidden">
            <Badge variant={statusStyle.variant} className="text-xs">
              {statusStyle.label}
            </Badge>
            <span>{order.itemCount} items</span>
          </div>
        </div>

        {/* Total */}
        <div className="shrink-0 text-right">
          <div className="font-semibold">{formatPrice(order.total)}</div>
          <div className="text-xs text-muted-foreground sm:hidden">
            {formatDate(order.createdAt)}
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
