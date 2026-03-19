"use client";

import {
  FileText,
  Download,
  Receipt,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Store,
  ExternalLink,
  MoreVertical,
  Check,
  X,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markInvoicePaid,
  voidInvoice,
  updateInvoiceAdmin,
  type InvoiceStatus,
} from "@/lib/actions/admin";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTransition, useState } from "react";
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
import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History } from "lucide-react";

interface Transaction {
  id: string;
  createdAt: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  processedBy?: { name: string | null } | null;
  tenant: { name: string; slug: string };
  invoice?: { id: string; invoiceNumber: string } | null;
}

interface Invoice {
  id: string;
  createdAt: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  tenant: { name: string; slug: string };
}

interface PlatformBillingClientProps {
  transactions: Transaction[];
  invoices: Invoice[];
}

export function PlatformBillingClient({
  transactions,
  invoices,
}: PlatformBillingClientProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="invoices" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="size-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <History className="size-4" />
              Recent Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="invoices" className="space-y-4 border-none p-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Service Invoices
              </CardTitle>
              <CardDescription>
                Manage subscription billing, unpaid invoices, and payment
                verifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-3 size-10 opacity-20" />
                  <p>No invoices found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Number</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/stores/${inv.tenant.slug}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            <Store className="size-3 text-muted-foreground" />
                            {inv.tenant.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(inv.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.dueDate
                            ? new Date(inv.dueDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {parseFloat(inv.total).toLocaleString()}{" "}
                          {inv.currency}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={inv.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <InvoiceActions invoice={inv} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 flex justify-end">
                <Link href="/admin/stores">
                  <Button variant="ghost" size="sm">
                    View by Store <ExternalLink className="ml-2 size-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 border-none p-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                Billing Event Log
              </CardTitle>
              <CardDescription>
                Chronological ledger of all billing-related events across the
                platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto mb-3 size-10 opacity-20" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <FileText className="size-4 ml-auto" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/stores/${tx.tenant.slug}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            <Store className="size-3 text-muted-foreground" />
                            {tx.tenant.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="capitalize text-[10px] font-normal"
                          >
                            {tx.type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {parseFloat(tx.amount).toLocaleString()} {tx.currency}
                        </TableCell>
                        <TableCell>
                          <TransactionStatusBadge status={tx.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.invoice && (
                            <a
                              href={`/api/dashboard/${tx.tenant.slug}/billing/invoices/${tx.invoice.id}/download`}
                              className="inline-flex items-center text-primary hover:underline"
                              title="Download Invoice"
                            >
                              <Download className="size-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const [isPending, startTransition] = useTransition();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState({
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    status: invoice.status as InvoiceStatus,
    periodStart: invoice.periodStart ? new Date(invoice.periodStart) : null,
    periodEnd: invoice.periodEnd ? new Date(invoice.periodEnd) : null,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
  });

  const handleMarkPaid = () => {
    startTransition(async () => {
      const result = await markInvoicePaid(invoice.id, {
        notes: "Marked as paid by admin from billing dashboard",
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleVoid = () => {
    if (
      !confirm(
        `Are you sure you want to void invoice ${invoice.invoiceNumber}? This action can only be undone by manual override.`
      )
    )
      return;
    startTransition(async () => {
      const result = await voidInvoice(invoice.id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleOverride = () => {
    startTransition(async () => {
      const result = await updateInvoiceAdmin(invoice.id, {
        ...editData,
        periodStart: editData.periodStart?.toISOString(),
        periodEnd: editData.periodEnd?.toISOString(),
        dueDate: editData.dueDate?.toISOString(),
      });
      if (result.success) {
        toast.success("Invoice override successful");
        setShowEditDialog(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreVertical className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={`/api/dashboard/${invoice.tenant.slug}/billing/invoices/${invoice.id}/download`}
            className="flex items-center cursor-pointer"
          >
            <Download className="mr-2 size-4" />
            Download PDF
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setShowEditDialog(true)}
          className="cursor-pointer"
        >
          <Receipt className="mr-2 size-4" />
          Edit Details (Override)
        </DropdownMenuItem>

        {invoice.status === "unpaid" && (
          <DropdownMenuItem
            onClick={handleMarkPaid}
            className="text-green-600 focus:text-green-600 cursor-pointer"
          >
            <Check className="mr-2 size-4" />
            Mark as Paid
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={handleVoid}
          className="text-red-600 focus:text-red-600 cursor-pointer"
        >
          <X className="mr-2 size-4" />
          Void Invoice
        </DropdownMenuItem>
      </DropdownMenuContent>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Administrative Override</DialogTitle>
            <DialogDescription>
              Careful: You are editing production billing data for invoice{" "}
              {invoice.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  value={editData.invoiceNumber}
                  onChange={(e) =>
                    setEditData({ ...editData, invoiceNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  value={editData.total}
                  onChange={(e) =>
                    setEditData({ ...editData, total: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editData.status}
                onValueChange={(val) =>
                  setEditData({ ...editData, status: val as InvoiceStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <DateTimePicker
                  value={editData.periodStart}
                  onChange={(date) =>
                    setEditData({ ...editData, periodStart: date })
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <DateTimePicker
                  value={editData.periodEnd}
                  onChange={(date) =>
                    setEditData({ ...editData, periodEnd: date })
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <DateTimePicker
                value={editData.dueDate}
                onChange={(date) => setEditData({ ...editData, dueDate: date })}
                className="h-9 w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleOverride} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { icon: LucideIcon; color: string; label: string }
  > = {
    completed: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-200",
      label: "Completed",
    },
    pending: {
      icon: Clock,
      color: "bg-amber-100 text-amber-800 border-amber-200",
      label: "Pending",
    },
    failed: {
      icon: XCircle,
      color: "bg-red-100 text-red-800 border-red-200",
      label: "Failed",
    },
    refunded: {
      icon: XCircle,
      color: "bg-gray-100 text-gray-800 border-gray-200",
      label: "Refunded",
    },
  };

  const statusConfig = config[status] || {
    icon: Clock,
    color: "bg-gray-100 text-gray-800 border-gray-200",
    label: status,
  };
  const Icon = statusConfig.icon;

  return (
    <Badge
      variant="outline"
      className={`${statusConfig.color} text-[10px] h-5 gap-1 px-2`}
    >
      <Icon className="size-3" />
      {statusConfig.label}
    </Badge>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<
    InvoiceStatus,
    {
      icon: LucideIcon;
      variant: "default" | "secondary" | "destructive" | "outline";
      label: string;
    }
  > = {
    draft: {
      icon: FileText,
      variant: "secondary",
      label: "Draft",
    },
    unpaid: {
      icon: Clock,
      variant: "outline",
      label: "Unpaid",
    },
    paid: {
      icon: CheckCircle,
      variant: "default",
      label: "Paid",
    },
    overdue: {
      icon: AlertTriangle,
      variant: "destructive",
      label: "Overdue",
    },
    void: {
      icon: XCircle,
      variant: "secondary",
      label: "Void",
    },
    partially_paid: {
      icon: MinusCircle,
      variant: "outline",
      label: "Partial",
    },
  };

  const statusConfig = config[status] || {
    icon: Clock,
    variant: "outline",
    label: status,
  };
  const Icon = statusConfig.icon;

  return (
    <Badge
      variant={statusConfig.variant}
      className="gap-1 text-[10px] h-5 px-2"
    >
      <Icon className="size-3" />
      {statusConfig.label}
    </Badge>
  );
}
