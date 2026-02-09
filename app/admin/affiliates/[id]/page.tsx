import { notFound } from "next/navigation";
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
  ArrowLeft,
  ExternalLink,
  Mail,
  Globe,
  Calendar,
  TrendingUp,
  Users,
  MousePointer,
  Wallet,
  Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { AffiliateAdminActions } from "./affiliate-admin-actions";

interface AffiliateDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getAffiliateData(affiliateId: string) {
  try {
    const {
      getPlatformAffiliateById,
      getAffiliateDashboardStats,
      getAffiliateReferrals,
      getAffiliatePayouts,
    } = await import("@/lib/db/queries/platform-affiliates");

    const [affiliate, stats, referralsResult, payoutsResult] =
      await Promise.all([
        getPlatformAffiliateById(affiliateId),
        getAffiliateDashboardStats(affiliateId),
        getAffiliateReferrals(affiliateId, { page: 1, limit: 10 }),
        getAffiliatePayouts(affiliateId, { page: 1, limit: 5 }),
      ]);

    if (!affiliate) {
      return null;
    }

    return {
      affiliate,
      stats,
      referrals: referralsResult.items,
      payouts: payoutsResult.items,
    };
  } catch (error) {
    console.error("Failed to fetch affiliate data:", error);
    return null;
  }
}

export default async function AffiliateDetailPage({
  params,
}: AffiliateDetailPageProps) {
  const { id } = await params;
  const data = await getAffiliateData(id);

  if (!data) {
    notFound();
  }

  const { affiliate, stats, referrals, payouts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {affiliate.displayName}
            </h1>
            <StatusBadge status={affiliate.status} />
            <TierBadge tier={affiliate.currentTier} />
          </div>
          <p className="text-muted-foreground">/{affiliate.slug}</p>
        </div>
        {affiliate.status === "approved" && (
          <Link
            href={`/${affiliate.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 size-4" />
              View Link
            </Button>
          </Link>
        )}
      </div>

      {/* Admin Actions */}
      <AffiliateAdminActions
        affiliateId={affiliate.id}
        currentStatus={affiliate.status}
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Clicks
              </CardTitle>
              <MousePointer className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClicks}</div>
              <p className="text-xs text-muted-foreground">
                {stats.recentClicks} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Referrals</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.successfulReferrals}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalSignups} total signups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Earned
              </CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(parseFloat(stats.totalEarned as string), "AFN")}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.currentCommissionRate}% commission rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
              <Wallet className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(parseFloat(stats.totalPaidOut as string), "AFN")}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPrice(parseFloat(stats.totalPending as string), "AFN")}{" "}
                pending
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Affiliate Info */}
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <span>{affiliate.user?.email}</span>
              </div>
              {affiliate.user?.name && (
                <p className="text-sm text-muted-foreground">
                  {affiliate.user.name}
                </p>
              )}
            </div>

            {affiliate.bio && (
              <div className="space-y-2">
                <Label>Bio</Label>
                <p className="text-sm">{affiliate.bio}</p>
              </div>
            )}

            {affiliate.websiteUrl && (
              <div className="space-y-2">
                <Label>Website</Label>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <a
                    href={affiliate.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {affiliate.websiteUrl}
                  </a>
                </div>
              </div>
            )}

            {affiliate.applicationNotes && (
              <div className="space-y-2">
                <Label>Application Notes</Label>
                <p className="text-sm text-muted-foreground">
                  {affiliate.applicationNotes}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
              {affiliate.appliedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  Applied: <RelativeTime date={affiliate.appliedAt} />
                </div>
              )}
              {affiliate.approvedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Approved: <RelativeTime date={affiliate.approvedAt} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                No payouts yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-mono text-xs">
                        {payout.payoutNumber}
                      </TableCell>
                      <TableCell>
                        {formatPrice(
                          parseFloat(payout.amount),
                          payout.currency
                        )}
                      </TableCell>
                      <TableCell>
                        <PayoutStatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <RelativeTime date={payout.requestedAt} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No referrals yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>First Payment</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Commission Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{referral.tenant?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{referral.tenant?.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ReferralStatusBadge status={referral.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime date={referral.signedUpAt} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime date={referral.firstPaidAt} />
                    </TableCell>
                    <TableCell>
                      {referral.retentionPassed ? (
                        <Badge variant="default">Passed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime date={referral.commissionEndsAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-muted-foreground">{children}</p>
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

function ReferralStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    pending: "secondary",
    churned: "destructive",
    expired: "outline",
  };

  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

function PayoutStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    completed: "default",
    pending: "secondary",
    processing: "secondary",
    failed: "destructive",
    cancelled: "outline",
  };

  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}
