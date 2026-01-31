"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import type { SellerTransaction } from "@/lib/db/queries/earnings";

interface TransactionHistoryProps {
  tenantId: string;
  currency: string;
  transactions: SellerTransaction[];
  totalCount: number;
}

const TRANSACTION_TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof ArrowDownLeft;
    color: string;
    bgColor: string;
  }
> = {
  sale: {
    label: "Sale",
    icon: ArrowDownLeft,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  refund: {
    label: "Refund",
    icon: ArrowUpRight,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  commission_fee: {
    label: "Commission",
    icon: Receipt,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  payout: {
    label: "Payout",
    icon: ArrowUpRight,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  payout_reversal: {
    label: "Payout Cancelled",
    icon: RefreshCw,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  adjustment: {
    label: "Adjustment",
    icon: RefreshCw,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  hold: {
    label: "Hold",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  release: {
    label: "Released",
    icon: ArrowDownLeft,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
};

export function TransactionHistory({
  currency,
  transactions,
  totalCount,
}: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="size-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">No transactions yet</p>
          <p className="text-sm text-muted-foreground">
            Transactions will appear here when you make sales
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const config = TRANSACTION_TYPE_CONFIG[transaction.type] || {
              label: transaction.type,
              icon: Receipt,
              color: "text-gray-600",
              bgColor: "bg-gray-100",
            };
            const Icon = config.icon;
            const amount = parseFloat(transaction.amount);
            const isPositive = amount >= 0;

            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full",
                      config.bgColor
                    )}
                  >
                    <Icon className={cn("size-5", config.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.label}</span>
                      {transaction.orderId && (
                        <Badge variant="outline" className="text-xs">
                          Order
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "font-semibold",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {formatPrice(amount, currency)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Balance:{" "}
                    {formatPrice(
                      parseFloat(transaction.availableAfter),
                      currency
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {totalCount > transactions.length && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Showing {transactions.length} of {totalCount} transactions
          </p>
        )}
      </CardContent>
    </Card>
  );
}
