"use client";

import {
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Gift,
  RotateCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import type { BillingTransactionWithAdmin } from "@/lib/db/queries/billing";
import type {
  BillingTransactionType,
  BillingTransactionStatus,
} from "@/lib/db/schema";

interface BillingHistoryProps {
  transactions: BillingTransactionWithAdmin[];
  total: number;
  currency: string;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

const TRANSACTION_TYPE_CONFIG: Record<
  BillingTransactionType,
  {
    label: string;
    icon: typeof CreditCard;
    color: string;
  }
> = {
  subscription_payment: {
    label: "Payment",
    icon: CreditCard,
    color: "text-green-600",
  },
  subscription_upgrade: {
    label: "Upgrade",
    icon: ArrowUpCircle,
    color: "text-blue-600",
  },
  subscription_downgrade: {
    label: "Downgrade",
    icon: ArrowDownCircle,
    color: "text-orange-600",
  },
  trial_extension: {
    label: "Trial Extension",
    icon: Clock,
    color: "text-purple-600",
  },
  refund: {
    label: "Refund",
    icon: RotateCcw,
    color: "text-red-600",
  },
  credit: {
    label: "Credit",
    icon: Gift,
    color: "text-teal-600",
  },
  adjustment: {
    label: "Adjustment",
    icon: Settings,
    color: "text-gray-600",
  },
};

const STATUS_CONFIG: Record<
  BillingTransactionStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pending", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return "-";
  const labels: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    mobile_money: "Mobile Money",
    bank_transfer: "Bank Transfer",
    credit: "Credit",
  };
  return labels[method] ?? method;
}

export function BillingHistory({
  transactions,
  total,
  currency,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
}: BillingHistoryProps) {
  const totalPages = Math.ceil(total / pageSize);
  const hasTransactions = transactions.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5" />
              Payment History
            </CardTitle>
            <CardDescription>
              View all your subscription payments and billing events
            </CardDescription>
          </div>
          {total > 0 && (
            <Badge variant="secondary">
              {total} transaction{total !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasTransactions ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
              <Receipt className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">No payment history yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your payment transactions will appear here once you make a
              payment.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Payment Method
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Reference
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const typeConfig =
                      TRANSACTION_TYPE_CONFIG[transaction.type];
                    const statusConfig = STATUS_CONFIG[transaction.status];
                    const TypeIcon = typeConfig.icon;

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <p className="font-medium">
                              {formatDate(transaction.createdAt)}
                            </p>
                            {transaction.periodStart &&
                              transaction.periodEnd && (
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(transaction.periodStart)} -{" "}
                                  {formatDate(transaction.periodEnd)}
                                </p>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon
                              className={cn("size-4", typeConfig.color)}
                            />
                            <span>{typeConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {transaction.type === "refund" ? "-" : ""}
                          {formatPrice(transaction.amount, currency)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatPaymentMethod(transaction.paymentMethod)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="max-w-37.5 truncate text-xs text-muted-foreground">
                            {transaction.paymentReference || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && onPageChange && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, total)} of {total} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" />
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
