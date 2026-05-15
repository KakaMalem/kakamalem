import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminStoreById, getPlatformSettings } from "@/lib/db/queries/admin";
import { getInvoices, getBillingTransactions } from "@/lib/db/queries/billing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ExternalLink,
  Store,
  User,
  Package,
  ShoppingCart,
  Calendar,
  CreditCard,
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  MinusCircle,
  FileText,
  Download,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StoreActionsClient } from "./store-actions-client";

export const dynamic = "force-dynamic";

// =============================================================================
// ADMIN STORE DETAIL PAGE
// =============================================================================
// View and manage individual store
// =============================================================================

interface StoreDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminStoreDetailPage({
  params,
}: StoreDetailPageProps) {
  const { id } = await params;
  const [store, settings, billingData, invoicesData] = await Promise.all([
    getAdminStoreById(id),
    getPlatformSettings(),
    getBillingTransactions(id, { limit: 10 }),
    getInvoices(id, { limit: 10 }),
  ]);

  if (!store) {
    notFound();
  }

  const formatDate = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "—";
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} ${store.currency}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/stores"
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 size-4" />
            Back to stores
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{store.name}</h1>
          <p className="text-muted-foreground">/{store.slug}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/${store.slug}/settings/domains`}>
            <Button variant="outline">
              <Settings className="mr-2 size-4" />
              Manage Domain
            </Button>
          </Link>
          <Link href={`/dashboard/${store.slug}`}>
            <Button variant="outline">
              <Settings className="mr-2 size-4" />
              Manage as Admin
            </Button>
          </Link>
          <a
            href={
              store.customDomain && store.customDomainStatus === "active"
                ? `https://${store.customDomain}`
                : `/store/${store.slug}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 size-4" />
              View Store
            </Button>
          </a>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Store Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={store.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {store.subscriptionPlan}
              </Badge>
              <SubscriptionBadge status={store.subscriptionStatus} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {store.subscriptionPlan === "pro"
                ? "Subscription Ends"
                : "Trial Ends"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {store.subscriptionPlan === "pro"
                ? store.subscriptionEndsAt
                  ? formatDate(store.subscriptionEndsAt)
                  : "No end date"
                : store.trialEndsAt
                  ? formatDate(store.trialEndsAt)
                  : "No trial"}
            </p>
            {store.subscriptionPlan === "pro"
              ? store.subscriptionEndsAt &&
                new Date(store.subscriptionEndsAt) < new Date() && (
                  <p className="text-xs text-red-600">Expired Subscription</p>
                )
              : store.trialEndsAt &&
                new Date(store.trialEndsAt) < new Date() && (
                  <p className="text-xs text-red-600">Expired Trial</p>
                )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatDate(store.createdAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Store Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Store Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5" />
                Store Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Package className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{store.stats.products}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <ShoppingCart className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{store.stats.orders}</p>
                    <p className="text-xs text-muted-foreground">Orders</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <CreditCard className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(store.stats.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Owner Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">
                    {store.owner?.name || "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{store.owner?.email}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Email</span>
                  <span className="font-medium">
                    {store.contactEmail || "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Phone</span>
                  <span className="font-medium">
                    {store.contactPhone || "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium">
                    {formatDate(store.owner?.createdAt ?? null)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                Subscription Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial Started</span>
                  <span className="font-medium">
                    {formatDate(store.trialStartedAt)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial Ends</span>
                  <span className="font-medium">
                    {formatDate(store.trialEndsAt)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subscription Started
                  </span>
                  <span className="font-medium">
                    {formatDate(store.subscriptionStartedAt)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Current Period Ends
                  </span>
                  <span className="font-medium">
                    {formatDate(store.subscriptionEndsAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Tabs */}
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="size-5" />
                    Transaction History
                  </CardTitle>
                  <CardDescription>
                    Recent billing transactions ({billingData.total} total)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {billingData.transactions.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Receipt className="mx-auto mb-3 size-10 opacity-50" />
                      <p>No transactions yet</p>
                      <p className="mt-1 text-sm">
                        Transactions will appear here when you record payments
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Recorded By</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingData.transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-sm">
                                {new Date(tx.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="capitalize text-xs"
                                >
                                  {tx.type.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {parseFloat(tx.amount).toLocaleString()}{" "}
                                {tx.currency}
                              </TableCell>
                              <TableCell>
                                <TransactionStatusBadge status={tx.status} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {tx.processedByName || "System"}
                              </TableCell>
                              <TableCell className="text-right">
                                {tx.invoiceId && (
                                  <a
                                    href={`/api/dashboard/${store.slug}/billing/invoices/${tx.invoiceId}/download`}
                                    title="Download Invoice"
                                    className="inline-flex items-center text-primary hover:underline"
                                  >
                                    <FileText className="size-4 mr-1" />
                                    <span className="text-xs">Invoice</span>
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-5" />
                    Invoices
                  </CardTitle>
                  <CardDescription>
                    Recent invoices ({invoicesData.total} total)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invoicesData.invoices.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-3 size-10 opacity-50" />
                      <p>No invoices yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoicesData.invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">
                                {inv.invoiceNumber}
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(inv.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {inv.dueDate
                                  ? new Date(inv.dueDate).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }
                                    )
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
                                <a
                                  href={`/api/dashboard/${store.slug}/billing/invoices/${inv.id}/download`}
                                  title="Download PDF"
                                  className="inline-flex items-center text-primary hover:underline"
                                >
                                  <Download className="size-4 mr-1" />
                                  <span className="text-xs">Download</span>
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Admin Notes */}
          {store.subscriptionNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {store.subscriptionNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions */}
        <div>
          <StoreActionsClient
            storeId={store.id}
            storeSlug={store.slug}
            storeName={store.name}
            currentStatus={store.status}
            currentPlan={store.subscriptionPlan}
            currentSubscriptionStatus={store.subscriptionStatus}
            subscriptionEndsAt={store.subscriptionEndsAt}
            pausedAt={(store as { pausedAt?: string | null }).pausedAt ?? null}
            autoResumeAt={
              (store as { autoResumeAt?: string | null }).autoResumeAt ?? null
            }
            currentNotes={store.subscriptionNotes}
            settings={settings}
            currency={store.currency || "USDT"}
            billingInterval={store.billingInterval}
            lastReminderSentAt={store.lastReminderSentAt}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    pending_review: "secondary",
    suspended: "destructive",
    inactive: "outline",
  };

  const labels: Record<string, string> = {
    active: "Active",
    pending_review: "Pending Review",
    suspended: "Suspended",
    inactive: "Inactive",
  };

  return (
    <Badge variant={variants[status] || "outline"} className="text-sm">
      {labels[status] || status}
    </Badge>
  );
}

function SubscriptionBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    cancelled: "outline",
    expired: "destructive",
  };

  const labels: Record<string, string> = {
    active: "Paid",
    trialing: "Trial",
    past_due: "Past Due",
    cancelled: "Cancelled",
    expired: "Expired",
  };

  return (
    <Badge variant={variants[status] || "outline"} className="text-sm">
      {labels[status] || status}
    </Badge>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { icon: typeof CheckCircle; color: string; label: string }
  > = {
    completed: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800",
      label: "Completed",
    },
    pending: {
      icon: Clock,
      color: "bg-amber-100 text-amber-800",
      label: "Pending",
    },
    failed: {
      icon: XCircle,
      color: "bg-red-100 text-red-800",
      label: "Failed",
    },
    refunded: {
      icon: XCircle,
      color: "bg-gray-100 text-gray-800",
      label: "Refunded",
    },
  };

  const statusConfig = config[status] || {
    icon: Clock,
    color: "bg-gray-100 text-gray-800",
    label: status,
  };
  const Icon = statusConfig.icon;

  return (
    <Badge className={`${statusConfig.color} text-xs`}>
      <Icon className="mr-1 size-3" />
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
    <Badge variant={statusConfig.variant} className="gap-1 text-xs">
      <Icon className="size-3" />
      {statusConfig.label}
    </Badge>
  );
}
