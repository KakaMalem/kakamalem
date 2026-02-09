import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MousePointerClick,
  Users,
  UserCheck,
  Wallet,
  TrendingUp,
  Copy,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";

import { getUser } from "@/lib/auth/server";
import {
  getPlatformAffiliateByUserId,
  getAffiliateDashboardStats,
} from "@/lib/db/queries/platform-affiliates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPrice } from "@/lib/utils";
import {
  AFFILIATE_TIERS,
  getTierProgress,
  getReferralsToNextTier,
} from "@/lib/affiliate/constants";
import { CopyLinkButton } from "@/components/affiliate/copy-link-button";

export default async function AffiliateDashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?returnTo=/affiliate/dashboard");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate) {
    redirect("/become-affiliate");
  }

  const stats = await getAffiliateDashboardStats(affiliate.id);

  if (!stats) {
    redirect("/become-affiliate");
  }

  const tierProgress = getTierProgress(
    stats.currentTier,
    stats.successfulReferrals
  );
  const referralsToNext = getReferralsToNextTier(
    stats.currentTier,
    stats.successfulReferrals
  );
  const affiliateLink = `https://kakamalem.com/${affiliate.slug}`;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {affiliate.displayName}!
          </h1>
          <p className="text-muted-foreground">
            Track your referrals, earnings, and manage your affiliate account.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${affiliate.slug}`} target="_blank">
              <ExternalLink className="mr-2 size-4" />
              View Your Page
            </Link>
          </Button>
        </div>
      </div>

      {/* Affiliate Link Card */}
      <Card className="bg-linear-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Affiliate Link</CardTitle>
          <CardDescription>
            Share this link to earn commissions on referred store subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 rounded-lg border bg-background px-4 py-3 font-mono text-sm">
              {affiliateLink}
            </div>
            <CopyLinkButton link={affiliateLink} />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalClicks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.recentClicks} in the last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalSignups.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Stores created from your link
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Successful Referrals
            </CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.successfulReferrals.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Passed 30-day retention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(parseFloat(stats.totalEarned), "AFN")}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Earnings Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
            <CardDescription>Your commission breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-green-500" />
                <span className="text-sm">Available Balance</span>
              </div>
              <span className="font-semibold">
                {formatPrice(parseFloat(stats.availableBalance), "AFN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-amber-500" />
                <span className="text-sm">Pending</span>
              </div>
              <span className="font-semibold">
                {formatPrice(parseFloat(stats.totalPending), "AFN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-blue-500" />
                <span className="text-sm">Total Paid Out</span>
              </div>
              <span className="font-semibold">
                {formatPrice(parseFloat(stats.totalPaidOut), "AFN")}
              </span>
            </div>

            <div className="pt-4">
              <Button asChild className="w-full">
                <Link href="/affiliate/dashboard/payouts">
                  Request Payout
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tier Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Commission Tier</CardTitle>
                <CardDescription>
                  Your current tier and progress
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className={
                  stats.currentTier === "gold"
                    ? "bg-yellow-100 text-yellow-800"
                    : stats.currentTier === "silver"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-amber-100 text-amber-800"
                }
              >
                {stats.currentTier.charAt(0).toUpperCase() +
                  stats.currentTier.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">
                {stats.currentCommissionRate}%
              </div>
              <p className="text-sm text-muted-foreground">Commission Rate</p>
            </div>

            {stats.currentTier !== "gold" && referralsToNext !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Progress to{" "}
                    {stats.currentTier === "bronze" ? "Silver" : "Gold"}
                  </span>
                  <span>{tierProgress}%</span>
                </div>
                <Progress value={tierProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {referralsToNext} more successful referral
                  {referralsToNext !== 1 ? "s" : ""} needed
                </p>
              </div>
            )}

            {stats.currentTier === "gold" && (
              <div className="rounded-lg bg-yellow-50 p-4 text-center">
                <TrendingUp className="mx-auto size-8 text-yellow-600 mb-2" />
                <p className="text-sm font-medium text-yellow-800">
                  You&apos;ve reached the highest tier!
                </p>
                <p className="text-xs text-yellow-600">
                  Enjoy the maximum 50% commission rate
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">All Tiers</h4>
              <div className="space-y-2">
                {Object.entries(AFFILIATE_TIERS).map(([key, tier]) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      stats.currentTier === key
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tier.name}</span>
                      {stats.currentTier === key && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-semibold">
                      {tier.commissionRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/affiliate/dashboard/link">
                <Copy className="mr-2 size-4" />
                Get Marketing Materials
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/affiliate/dashboard/referrals">
                <Users className="mr-2 size-4" />
                View All Referrals
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/affiliate/dashboard/earnings">
                <Wallet className="mr-2 size-4" />
                View Earnings History
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/affiliate/dashboard/profile">
                <TrendingUp className="mr-2 size-4" />
                Update Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
