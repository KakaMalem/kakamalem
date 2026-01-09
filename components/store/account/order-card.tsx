"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { getOrderStatusInfo } from "@/lib/utils/order-status";

interface OrderCardProps {
  order: {
    id: string;
    orderNumber: string;
    total: string;
    status: string;
    createdAt: string;
    items?: {
      id: string;
      productName: string;
      variantName: string | null;
      quantity: number;
      price: string;
    }[];
  };
  storeSlug: string;
  currency: string;
}

export function OrderCard({ order, storeSlug, currency }: OrderCardProps) {
  const statusInfo = getOrderStatusInfo(order.status);
  const orderDate = new Date(order.createdAt);
  const itemCount =
    order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Link href={`/store/${storeSlug}/account/orders/${order.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              {/* Order Number and Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{order.orderNumber}</span>
                <Badge variant={statusInfo.color}>{statusInfo.label}</Badge>
              </div>

              {/* Date and Items Summary */}
              <div className="text-sm text-muted-foreground">
                {orderDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {itemCount > 0 && (
                  <span>
                    {" "}
                    &middot; {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                )}
              </div>

              {/* First few items preview */}
              {order.items && order.items.length > 0 && (
                <div className="text-sm text-muted-foreground line-clamp-1">
                  {order.items
                    .slice(0, 3)
                    .map((item) => item.productName)
                    .join(", ")}
                  {order.items.length > 3 && ` +${order.items.length - 3} more`}
                </div>
              )}
            </div>

            {/* Total and Arrow */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold">
                {formatPrice(parseFloat(order.total), currency)}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
