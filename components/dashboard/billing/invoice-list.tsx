"use client";

import {
  FileText,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  MinusCircle,
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
import type { InvoiceWithStats } from "@/lib/db/queries/billing";
import type { InvoiceStatus } from "@/lib/db/schema";

interface InvoiceListProps {
  invoices: InvoiceWithStats[];
  total: number;
  currency: string;
  hasStripeSubscription?: boolean;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onDownloadInvoice?: (invoiceId: string) => void;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    icon: typeof CheckCircle;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  draft: {
    label: "Draft",
    icon: FileText,
    variant: "secondary",
    color: "text-gray-600",
  },
  sent: {
    label: "Sent",
    icon: Clock,
    variant: "outline",
    color: "text-blue-600",
  },
  paid: {
    label: "Paid",
    icon: CheckCircle,
    variant: "default",
    color: "text-green-600",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    variant: "destructive",
    color: "text-red-600",
  },
  void: {
    label: "Void",
    icon: XCircle,
    variant: "secondary",
    color: "text-gray-500",
  },
  partially_paid: {
    label: "Partial",
    icon: MinusCircle,
    variant: "outline",
    color: "text-amber-600",
  },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

export function InvoiceList({
  invoices,
  total,
  currency,
  hasStripeSubscription,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onViewInvoice,
  onDownloadInvoice,
}: InvoiceListProps) {
  const totalPages = Math.ceil(total / pageSize);
  const hasInvoices = invoices.length > 0;

  // Only show actions column if callbacks are provided
  const hasActions = !!onViewInvoice || !!onDownloadInvoice;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Billing History
            </CardTitle>
            <CardDescription>View and download your invoices</CardDescription>
          </div>
          {total > 0 && (
            <Badge variant="secondary">
              {total} invoice{total !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasInvoices ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            {hasStripeSubscription ? (
              <>
                <h3 className="font-medium">Billing managed by Stripe</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your invoices and receipts are available through the Stripe
                  Customer Portal. Use the &quot;Manage Subscription&quot;
                  button above to view them.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium">No billing history yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your invoices will appear here once you subscribe to Pro.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Period
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Due Date
                    </TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {hasActions && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const statusConfig = STATUS_CONFIG[invoice.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(invoice.createdAt)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {invoice.periodStart && invoice.periodEnd ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDate(invoice.periodStart)} -{" "}
                              {formatDate(invoice.periodEnd)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {formatPrice(
                                invoice.total,
                                invoice.currency || currency
                              )}
                            </p>
                            {invoice.status === "partially_paid" && (
                              <p className="text-xs text-muted-foreground">
                                Due:{" "}
                                {formatPrice(
                                  invoice.amountDue,
                                  invoice.currency || currency
                                )}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusConfig.variant}
                            className={cn("gap-1")}
                          >
                            <StatusIcon className="size-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        {hasActions && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {onViewInvoice && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onViewInvoice(invoice.id)}
                                >
                                  <Eye className="mr-1 size-4" />
                                  <span className="sr-only md:not-sr-only">
                                    View
                                  </span>
                                </Button>
                              )}
                              {onDownloadInvoice && invoice.pdfUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDownloadInvoice(invoice.id)}
                                >
                                  <Download className="mr-1 size-4" />
                                  <span className="sr-only md:not-sr-only">
                                    Download
                                  </span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
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
