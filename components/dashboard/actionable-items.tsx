import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  Lightbulb,
} from "lucide-react";

interface ActionableItemsProps {
  storeSlug: string;
  ordersToShip: number;
  lowStockProducts: number;
  unrepliedReviews: number;
}

export function ActionableItems({
  storeSlug,
  ordersToShip,
  lowStockProducts,
  unrepliedReviews,
}: ActionableItemsProps) {
  // Urgent action items (orders, inventory)
  const actionItems = [
    {
      label: "Orders to ship",
      count: ordersToShip,
      icon: Package,
      href: `/dashboard/${storeSlug}/orders?status=confirmed`,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Low stock items",
      count: lowStockProducts,
      icon: AlertTriangle,
      href: `/dashboard/${storeSlug}/products?stock=low`,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  // Non-urgent suggestions (reviews)
  const suggestions = [
    {
      label: "Reviews to respond",
      count: unrepliedReviews,
      icon: MessageSquare,
      href: `/dashboard/${storeSlug}/reviews?hasReply=no`,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const hasActionItems = ordersToShip > 0 || lowStockProducts > 0;
  const hasSuggestions = unrepliedReviews > 0;

  return (
    <div className="space-y-4">
      {/* Action Required Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasActionItems ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All caught up! No pending tasks.
            </p>
          ) : (
            actionItems
              .filter((item) => item.count > 0)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${item.bgColor}`}>
                      <item.icon className={`size-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.count}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
          )}
        </CardContent>
      </Card>

      {/* Suggestions Section (non-urgent) */}
      {hasSuggestions && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Lightbulb className="size-4" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions
              .filter((item) => item.count > 0)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${item.bgColor}`}>
                      <item.icon className={`size-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.count}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
