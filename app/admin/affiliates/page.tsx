import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet,
  Clock,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { AffiliatesFilters } from "./affiliates-filters";
import { formatPrice } from "@/lib/utils";

// Dynamic import to handle missing tables
async function getAffiliatesData(filter: {
  page: number;
  search?: string;
  status?: "pending" | "approved" | "suspended" | "rejected";
  tier?: "bronze" | "silver" | "gold";
}) {
  try {
    const { getPlatformAffiliatesForAdmin, getPlatformAffiliateStatsSummary } =
      await import("@/lib/db/queries/platform-affiliates");

    const [affiliatesResult, stats] = await Promise.all([
      getPlatformAffiliatesForAdmin({
        page: filter.page,
        limit: 20,
        search: filter.search,
        status: filter.status,
        tier: filter.tier,
        sortBy: "appliedAt",
        sortOrder: "desc",
      }),
      getPlatformAffiliateStatsSummary(),
    ]);

    return {
      success: true,
      affiliates: affiliatesResult.items,
      pagination: {
        page: affiliatesResult.page,
        total: affiliatesResult.total,
        totalPages: affiliatesResult.totalPages,
      },
      stats,
    };
  } catch (error) {
    console.error("Failed to fetch affiliates:", error);
    return {
      success: false,
      error:
        "Database tables not found. Please run migrations: pnpm db:migrate",
    };
  }
}

// =============================================================================
// ADMIN AFFILIATES LIST
// =============================================================================

interface AffiliatesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    tier?: string;
  }>;
}

export default async function AdminAffiliatesPage({
  searchParams,
}: AffiliatesPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const status = params.status || "";
  const tier = params.tier || "";

  // Treat "all" as no filter
  const statusFilter =
    status && status !== "all"
      ? (status as "pending" | "approved" | "suspended" | "rejected")
      : undefined;
  const tierFilter =
    tier && tier !== "all" ? (tier as "bronze" | "silver" | "gold") : undefined;

  const result = await getAffiliatesData({
    page,
    search: search || undefined,
    status: statusFilter,
    tier: tierFilter,
  });

  // Handle database error
  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliates</h1>
          <p className="text-muted-foreground">
            Manage platform affiliate partners
          </p>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="size-16 text-amber-600 mb-4" />
            <h2 className="text-xl font-bold">Database Setup Required</h2>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              {result.error}
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg font-mono text-sm">
              pnpm db:migrate
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { affiliates = [], pagination, stats } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliates</h1>
          <p className="text-muted-foreground">
            Manage platform affiliate partners
          </p>
        </div>
        <div className="flex gap-2">
          {stats && stats.pendingPayouts > 0 && (
            <Link href="/admin/affiliates/payouts">
              <Button variant="outline">
                <Wallet className="mr-2 size-4" />
                {stats.pendingPayouts} Payout
                {stats.pendingPayouts !== 1 ? "s" : ""}
              </Button>
            </Link>
          )}
          {stats && stats.pendingApplications > 0 && (
            <Link href="/admin/affiliates/applications">
              <Button>
                <Clock className="mr-2 size-4" />
                {stats.pendingApplications} Pending
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Affiliates
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalAffiliates ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeAffiliates ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Applications
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pendingApplications ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(
                parseFloat((stats?.totalEarned as string) || "0"),
                "AFN"
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(
                parseFloat((stats?.totalPaidOut as string) || "0"),
                "AFN"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Payouts processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <AffiliatesFilters
            initialSearch={search}
            initialStatus={status}
            initialTier={tier}
          />
        </CardContent>
      </Card>

      {/* Affiliates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            {pagination?.total ?? 0} Affiliates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {affiliates.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No affiliates found
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="space-y-3 md:hidden">
                {affiliates.map((affiliate) => (
                  <div
                    key={affiliate.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {affiliate.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          /{affiliate.slug}
                        </p>
                      </div>
                      <Link href={`/admin/affiliates/${affiliate.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={affiliate.status} />
                      <TierBadge tier={affiliate.currentTier} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Referrals
                        </p>
                        <p>{affiliate.successfulReferrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Earned</p>
                        <p>
                          {formatPrice(
                            parseFloat(affiliate.totalEarned),
                            "AFN"
                          )}
                        </p>
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
                      <TableHead>Affiliate</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Earned</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {affiliate.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              /{affiliate.slug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{affiliate.user?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {affiliate.user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={affiliate.status} />
                        </TableCell>
                        <TableCell>
                          <TierBadge tier={affiliate.currentTier} />
                        </TableCell>
                        <TableCell>{affiliate.totalClicks}</TableCell>
                        <TableCell>{affiliate.successfulReferrals}</TableCell>
                        <TableCell>
                          {formatPrice(
                            parseFloat(affiliate.totalEarned),
                            "AFN"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <RelativeTime date={affiliate.appliedAt} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/${affiliate.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={affiliate.status !== "approved"}
                              >
                                <ExternalLink className="size-4" />
                              </Button>
                            </Link>
                            <Link href={`/admin/affiliates/${affiliate.id}`}>
                              <Button variant="outline" size="sm">
                                View
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
          {pagination && pagination.totalPages > 1 && (
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
                    tier,
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
                    tier,
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
    approved: "default",
    pending: "secondary",
    suspended: "destructive",
    rejected: "outline",
  };

  const labels: Record<string, string> = {
    approved: "Active",
    pending: "Pending",
    suspended: "Suspended",
    rejected: "Rejected",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
      {labels[status] || status}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    bronze: "bg-amber-100 text-amber-700 border-amber-200",
    silver: "bg-slate-100 text-slate-700 border-slate-200",
    gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  return (
    <Badge variant="outline" className={colors[tier] || ""}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function buildUrl(params: {
  page: number;
  search: string;
  status: string;
  tier: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.page > 1) urlParams.set("page", String(params.page));
  if (params.search) urlParams.set("search", params.search);
  if (params.status && params.status !== "all") {
    urlParams.set("status", params.status);
  }
  if (params.tier && params.tier !== "all") {
    urlParams.set("tier", params.tier);
  }
  const query = urlParams.toString();
  return `/admin/affiliates${query ? `?${query}` : ""}`;
}
