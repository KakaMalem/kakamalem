import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import {
  getPlatformAffiliateByUserId,
  getAffiliateDashboardStats,
  getAffiliateReferrals,
} from "@/lib/db/queries/platform-affiliates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MousePointerClick,
  Users,
  TrendingUp,
  Wallet,
  Award,
  Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  AFFILIATE_TIERS,
  getTierProgress,
  getReferralsToNextTier,
} from "@/lib/affiliate/constants";
import { AffiliateLinkCopy } from "./affiliate-link-copy";

export const metadata = {
  title: "Affiliate Dashboard | Kaka Malem",
  description: "View your affiliate stats, referrals, and earnings",
};

export default async function AffiliateDashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?returnTo=/dashboard/affiliate");
  }

  // Get affiliate record
  const affiliate = await getPlatformAffiliateByUserId(user.id);

  // Not an affiliate yet - show apply CTA
  if (!affiliate) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Award className="size-16 text-primary mb-4" />
            <h2 className="text-xl font-bold">Become an Affiliate</h2>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              Earn up to 50% commission for 12 months on every store you refer
              to Kaka Malem.
            </p>
            <div className="flex gap-3 mt-6">
              <Button asChild>
                <Link href="/become-affiliate">Apply Now</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/affiliate">Learn More</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending application
  if (affiliate.status === "pending") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="size-16 text-amber-500 mb-4" />
            <h2 className="text-xl font-bold">Application Pending</h2>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              Your affiliate application is being reviewed. We&apos;ll notify
              you by email once it&apos;s approved (usually within 24-48 hours).
            </p>
            <Badge variant="secondary" className="mt-4">
              Applied{" "}
              {affiliate.appliedAt
                ? new Date(affiliate.appliedAt).toLocaleDateString()
                : "recently"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspended
  if (affiliate.status === "suspended") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold">Account Suspended</h2>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              Your affiliate account has been suspended. Please contact support
              for more information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected
  if (affiliate.status === "rejected") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <h2 className="text-xl font-bold">Application Not Approved</h2>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              Unfortunately, your affiliate application was not approved at this
              time. You may contact support if you believe this was in error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved - show full dashboard
  const [stats, { items: recentReferrals }] = await Promise.all([
    getAffiliateDashboardStats(affiliate.id),
    getAffiliateReferrals(affiliate.id, { page: 1, limit: 5 }),
  ]);

  if (!stats) {
    return null;
  }

  const tier = affiliate.currentTier as "bronze" | "silver" | "gold";
  const tierInfo = AFFILIATE_TIERS[tier];
  const progress = getTierProgress(tier, stats.successfulReferrals);
  const referralsToNext = getReferralsToNextTier(
    tier,
    stats.successfulReferrals
  );
  const affiliateUrl = `https://kakamalem.com/${affiliate.slug}`;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {affiliate.displayName}
            </p>
          </div>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Referral Link */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <AffiliateLinkCopy url={affiliateUrl} />
          <p className="text-sm text-muted-foreground mt-2">
            Share this link to earn {stats.currentCommissionRate}% commission on
            every store that signs up and stays active for 30 days.
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="size-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Signups</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSignups}</div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulReferrals} successful referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(parseFloat(stats.totalEarned), "AFN")}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPrice(parseFloat(stats.totalPending), "AFN")} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(parseFloat(stats.availableBalance as string), "AFN")}
            </div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progress */}
      {tier !== "gold" && referralsToNext !== null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Tier Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{tierInfo.name}</span>
              <span className="text-sm text-muted-foreground">
                {referralsToNext} more referral
                {referralsToNext !== 1 ? "s" : ""} to{" "}
                {tier === "bronze" ? "Silver" : "Gold"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{tierInfo.commissionRate}% commission</span>
              <span>
                {tier === "bronze"
                  ? `${AFFILIATE_TIERS.silver.commissionRate}%`
                  : `${AFFILIATE_TIERS.gold.commissionRate}%`}{" "}
                at next tier
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Referrals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Referrals</CardTitle>
          {recentReferrals.length > 0 && (
            <Link href="/dashboard/affiliate/referrals">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {recentReferrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-12 mx-auto mb-3 opacity-50" />
              <p>No referrals yet</p>
              <p className="text-sm mt-1">
                Share your link to start earning commissions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{referral.tenant?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Signed up{" "}
                      {new Date(referral.signedUpAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ReferralStatusBadge status={referral.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TierBadge({ tier }: { tier: "bronze" | "silver" | "gold" }) {
  const colors: Record<string, string> = {
    bronze: "bg-amber-100 text-amber-700 border-amber-200",
    silver: "bg-slate-100 text-slate-700 border-slate-200",
    gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  const tierInfo = AFFILIATE_TIERS[tier];

  return (
    <Badge variant="outline" className={`${colors[tier]} px-3 py-1`}>
      <Award className="size-4 mr-1.5" />
      {tierInfo.name} ({tierInfo.commissionRate}%)
    </Badge>
  );
}

function ReferralStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    trial: "secondary",
    churned: "destructive",
    completed: "outline",
  };

  const labels: Record<string, string> = {
    active: "Active",
    trial: "In Trial",
    churned: "Churned",
    completed: "Completed",
  };

  return (
    <Badge variant={variants[status] || "outline"}>
      {labels[status] || status}
    </Badge>
  );
}
