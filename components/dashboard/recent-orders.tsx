import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RecentOrder } from "@/lib/db/queries/analytics";

interface RecentOrdersProps {
  orders: RecentOrder[];
  currency: string;
  storeSlug: string;
}

const statusStyles: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    label: string;
  }
> = {
  pending: { variant: "outline", label: "Pending" },
  confirmed: { variant: "secondary", label: "Confirmed" },
  processing: { variant: "secondary", label: "Processing" },
  shipped: { variant: "default", label: "Shipped" },
  delivered: { variant: "default", label: "Delivered" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  refunded: { variant: "destructive", label: "Refunded" },
};

export function RecentOrders({
  orders,
  currency,
  storeSlug,
}: RecentOrdersProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Orders</CardTitle>
        <Link
          href={`/dashboard/${storeSlug}/orders`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No orders yet. They&apos;ll appear here when customers start buying.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = statusStyles[order.status] || statusStyles.pending;
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/${storeSlug}/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span className="text-sm font-medium">
                      {parseFloat(order.total).toLocaleString()} {currency}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
