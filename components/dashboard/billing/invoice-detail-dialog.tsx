"use client";

import { FileText, Calendar, User, Mail, Phone, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate } from "@/lib/utils";
import type { InvoiceWithStats } from "@/lib/db/queries/billing";
import type { InvoiceStatus } from "@/lib/db/schema";

interface InvoiceDetailDialogProps {
  invoice: InvoiceWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    color: "bg-gray-100 text-gray-700",
  },
  sent: {
    label: "Sent",
    variant: "outline",
    color: "bg-blue-50 text-blue-700",
  },
  paid: {
    label: "Paid",
    variant: "default",
    color: "bg-green-50 text-green-700",
  },
  overdue: {
    label: "Overdue",
    variant: "destructive",
    color: "bg-red-50 text-red-700",
  },
  void: {
    label: "Void",
    variant: "secondary",
    color: "bg-gray-100 text-gray-500",
  },
  partially_paid: {
    label: "Partially Paid",
    variant: "outline",
    color: "bg-amber-50 text-amber-700",
  },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  currency,
}: InvoiceDetailDialogProps) {
  if (!invoice) return null;

  const statusConfig = STATUS_CONFIG[invoice.status];
  const items = invoice.items || [];
  const hasItems = items.length > 0;
  const hasBillingInfo =
    invoice.billingName ||
    invoice.billingEmail ||
    invoice.billingPhone ||
    invoice.billingAddress;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Invoice {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with status */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Badge className={cn("gap-1", statusConfig.color)}>
                {statusConfig.label}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Created {formatDate(invoice.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatPrice(invoice.total, currency)}
              </p>
              {invoice.status === "partially_paid" && invoice.paidAmount && (
                <p className="text-sm text-muted-foreground">
                  Paid: {formatPrice(invoice.paidAmount, currency)}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {invoice.periodStart && invoice.periodEnd && (
              <div className="flex items-start gap-2">
                <Calendar className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Billing Period</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(invoice.periodStart)} -{" "}
                    {formatDate(invoice.periodEnd)}
                  </p>
                </div>
              </div>
            )}
            {invoice.dueDate && (
              <div className="flex items-start gap-2">
                <Calendar className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>
              </div>
            )}
            {invoice.paidAt && (
              <div className="flex items-start gap-2">
                <Calendar className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Paid On</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(invoice.paidAt)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Billing Info */}
          {hasBillingInfo && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Bill To</h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  {invoice.billingName && (
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="text-sm">{invoice.billingName}</span>
                    </div>
                  )}
                  {invoice.billingEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="text-sm">{invoice.billingEmail}</span>
                    </div>
                  )}
                  {invoice.billingPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-muted-foreground" />
                      <span className="text-sm">{invoice.billingPhone}</span>
                    </div>
                  )}
                  {invoice.billingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="size-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm whitespace-pre-line">
                        {invoice.billingAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Line Items */}
          {hasItems && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">
                          Description
                        </th>
                        <th className="text-center py-2 px-3 font-medium w-20">
                          Qty
                        </th>
                        <th className="text-right py-2 px-3 font-medium w-28">
                          Unit Price
                        </th>
                        <th className="text-right py-2 px-3 font-medium w-28">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="py-2 px-3">{item.description}</td>
                          <td className="py-2 px-3 text-center">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatPrice(item.unitPrice, currency)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatPrice(item.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Totals */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(invoice.subtotal, currency)}</span>
              </div>
              {parseFloat(invoice.tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatPrice(invoice.tax, currency)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(invoice.total, currency)}</span>
              </div>
              {invoice.amountDue > 0 && invoice.status !== "paid" && (
                <div className="flex justify-between text-sm text-amber-600 font-medium pt-1">
                  <span>Amount Due</span>
                  <span>{formatPrice(invoice.amountDue, currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
