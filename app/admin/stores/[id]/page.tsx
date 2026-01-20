import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminStoreById, getPlatformSettings } from "@/lib/db/queries/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ExternalLink,
  Store,
  User,
  Package,
  ShoppingCart,
  Calendar,
  CreditCard,
} from "lucide-react";
import { StoreActionsClient } from "./store-actions-client";

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
  const [store, settings] = await Promise.all([
    getAdminStoreById(id),
    getPlatformSettings(),
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
          <Link
            href={`/store/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 size-4" />
              View Store
            </Button>
          </Link>
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
              Trial Ends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {store.trialEndsAt ? formatDate(store.trialEndsAt) : "No trial"}
            </p>
            {store.trialEndsAt && new Date(store.trialEndsAt) < new Date() && (
              <p className="text-xs text-red-600">Expired</p>
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
            storeName={store.name}
            currentStatus={store.status}
            currentPlan={store.subscriptionPlan}
            currentSubscriptionStatus={store.subscriptionStatus}
            currentNotes={store.subscriptionNotes}
            settings={settings}
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
