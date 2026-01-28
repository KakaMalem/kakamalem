import Link from "next/link";
import { getAdminStores } from "@/lib/db/queries/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Store, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { StoresFilters } from "./stores-filters";

// =============================================================================
// ADMIN STORES LIST
// =============================================================================
// List all stores with filtering and pagination
// =============================================================================

interface StoresPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    subscriptionStatus?: string;
  }>;
}

export default async function AdminStoresPage({
  searchParams,
}: StoresPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const status = params.status || "";
  const subscriptionStatus = params.subscriptionStatus || "";

  // Treat "all" as no filter
  const statusFilter = status && status !== "all" ? status : undefined;
  const subscriptionFilter =
    subscriptionStatus && subscriptionStatus !== "all"
      ? subscriptionStatus
      : undefined;

  const { stores, pagination } = await getAdminStores({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter,
    subscriptionStatus: subscriptionFilter,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stores</h1>
        <p className="text-muted-foreground">
          Manage all stores on the platform
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <StoresFilters
            initialSearch={search}
            initialStatus={status}
            initialSubscriptionStatus={subscriptionStatus}
          />
        </CardContent>
      </Card>

      {/* Stores List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-5" />
            {pagination.total} Stores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No stores found
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="space-y-3 md:hidden">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{store.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{store.slug}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Link
                          href={`/store/${store.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/stores/${store.id}`}>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={store.status} />
                      <SubscriptionBadge status={store.subscriptionStatus} />
                      <Badge variant="outline" className="capitalize">
                        {store.subscriptionPlan}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Owner</p>
                        <p className="truncate">{store.owner?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trial</p>
                        <TrialEndDate
                          trialEndsAt={store.trialEndsAt}
                          subscriptionStatus={store.subscriptionStatus}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Trial Ends</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-xs text-muted-foreground">
                              /{store.slug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              {store.owner?.name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {store.owner?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={store.status} />
                        </TableCell>
                        <TableCell>
                          <SubscriptionBadge
                            status={store.subscriptionStatus}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {store.subscriptionPlan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TrialEndDate
                            trialEndsAt={store.trialEndsAt}
                            subscriptionStatus={store.subscriptionStatus}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(store.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/store/${store.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="size-4" />
                              </Button>
                            </Link>
                            <Link href={`/admin/stores/${store.id}`}>
                              <Button variant="outline" size="sm">
                                Manage
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex justify-center gap-2">
                <Link
                  href={buildUrl({
                    page: pagination.page - 1,
                    search,
                    status,
                    subscriptionStatus,
                  })}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Previous
                  </Button>
                </Link>
                <Link
                  href={buildUrl({
                    page: pagination.page + 1,
                    search,
                    status,
                    subscriptionStatus,
                  })}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
    pending_review: "Pending",
    suspended: "Suspended",
    inactive: "Inactive",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
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
    <Badge variant={variants[status] || "outline"}>
      {labels[status] || status}
    </Badge>
  );
}

function TrialEndDate({
  trialEndsAt,
  subscriptionStatus,
}: {
  trialEndsAt: string | null;
  subscriptionStatus: string;
}) {
  // Don't show trial date for paid subscriptions
  if (subscriptionStatus === "active") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (!trialEndsAt) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const isExpired = trialEnd < now;
  const daysRemaining = Math.ceil(
    (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (isExpired) {
    return (
      <div className="text-sm">
        <span className="text-red-600">Expired</span>
        <p className="text-xs text-muted-foreground">
          {trialEnd.toLocaleDateString()}
        </p>
      </div>
    );
  }

  const isEndingSoon = daysRemaining <= 3;

  return (
    <div className="text-sm">
      <span
        className={isEndingSoon ? "text-amber-600" : "text-muted-foreground"}
      >
        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
      </span>
      <p className="text-xs text-muted-foreground">
        {trialEnd.toLocaleDateString()}
      </p>
    </div>
  );
}

function buildUrl(params: {
  page: number;
  search: string;
  status: string;
  subscriptionStatus: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.page > 1) urlParams.set("page", String(params.page));
  if (params.search) urlParams.set("search", params.search);
  if (params.status && params.status !== "all") {
    urlParams.set("status", params.status);
  }
  if (params.subscriptionStatus && params.subscriptionStatus !== "all") {
    urlParams.set("subscriptionStatus", params.subscriptionStatus);
  }
  const query = urlParams.toString();
  return `/admin/stores${query ? `?${query}` : ""}`;
}
