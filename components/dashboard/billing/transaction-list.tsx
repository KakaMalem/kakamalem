"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Receipt,
  CreditCard,
  Settings2,
  Heart,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CommissionTransactionItem,
  TransactionPagination,
} from "@/lib/db/queries/billing";
import type { CommissionTransactionType } from "@/lib/db/schema";

interface TransactionListProps {
  transactions: CommissionTransactionItem[];
  pagination: TransactionPagination;
  storeSlug: string;
  currency: string;
}

const TYPE_CONFIG: Record<
  CommissionTransactionType,
  {
    label: string;
    icon: typeof Receipt;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    amountColor: string;
  }
> = {
  order_commission: {
    label: "Order Commission",
    icon: Receipt,
    badgeVariant: "secondary",
    amountColor: "text-foreground",
  },
  payment: {
    label: "Payment",
    icon: CreditCard,
    badgeVariant: "default",
    amountColor: "text-green-600",
  },
  adjustment: {
    label: "Adjustment",
    icon: Settings2,
    badgeVariant: "outline",
    amountColor: "text-amber-600",
  },
  forgiveness: {
    label: "Forgiveness",
    icon: Heart,
    badgeVariant: "secondary",
    amountColor: "text-purple-600",
  },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()} ${currency}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TransactionCard({
  transaction,
  storeSlug,
  currency,
}: {
  transaction: CommissionTransactionItem;
  storeSlug: string;
  currency: string;
}) {
  const config = TYPE_CONFIG[transaction.type];
  const TransactionIcon = config.icon;
  const amount = parseFloat(transaction.amount);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 px-3 py-3 sm:px-4">
        {/* Icon */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <TransactionIcon className="size-5 text-muted-foreground" />
        </div>

        {/* Transaction Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{config.label}</span>
            {/* Desktop badge */}
            <div className="hidden sm:block">
              <Badge variant={config.badgeVariant}>
                {transaction.type === "order_commission"
                  ? "Commission"
                  : config.label}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {transaction.orderNumber && (
              <>
                <Link
                  href={`/dashboard/${storeSlug}/orders/${transaction.orderId}`}
                  className="hover:underline"
                >
                  Order {transaction.orderNumber}
                </Link>
                <span className="hidden sm:inline">•</span>
              </>
            )}
            {transaction.description && (
              <>
                <span className="truncate max-w-48">
                  {transaction.description}
                </span>
                <span className="hidden sm:inline">•</span>
              </>
            )}
            <span className="hidden sm:inline">
              {formatDate(transaction.createdAt)} at{" "}
              {formatTime(transaction.createdAt)}
            </span>
          </div>
          {/* Mobile date */}
          <div className="mt-1 text-xs text-muted-foreground sm:hidden">
            {formatDate(transaction.createdAt)}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={cn("font-semibold", config.amountColor)}>
            {formatPrice(amount, currency)}
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Balance: {parseFloat(transaction.balanceAfter).toLocaleString()}{" "}
            {currency}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TransactionList({
  transactions,
  pagination,
  storeSlug,
  currency,
}: TransactionListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard/${storeSlug}/billing?${params.toString()}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          Commission charges, payments, and adjustments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-medium">No transactions yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Commission transactions will appear here when orders are placed in
              your store.
            </p>
          </div>
        ) : (
          <>
            {/* Transaction Cards */}
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  storeSlug={storeSlug}
                  currency={currency}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
