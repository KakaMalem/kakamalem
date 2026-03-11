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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  status: string;
  dueDate?: string | null;
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
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5" />
              Recent Service Transactions
            </CardTitle>
            <CardDescription>
              Latest billing events across all stores (Trial activations, Pro
              payments, Upgrades)
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
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
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
                        <Badge variant="outline" className="capitalize text-xs">
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
                            <FileText className="size-4" />
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

        {/* Recent Invoices */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Service Invoices
            </CardTitle>
            <CardDescription>
              All subscription invoices (Paid and Unpaid)
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
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Date</TableHead>
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
                          className="font-medium hover:underline"
                        >
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
                        {parseFloat(inv.total).toLocaleString()} {inv.currency}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/api/dashboard/${inv.tenant.slug}/billing/invoices/${inv.id}/download`}
                          className="inline-flex items-center justify-center rounded-md size-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                          title="Download PDF"
                        >
                          <Download className="size-4" />
                        </a>
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
      </div>
    </div>
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
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
