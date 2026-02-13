import { redirect } from "next/navigation";
import { Wallet, CheckCircle, Clock, Ban } from "lucide-react";

import { getUser } from "@/lib/auth/server";
import {
  getPlatformAffiliateByUserId,
  getAffiliateCommissions,
  getAffiliateDashboardStats,
} from "@/lib/db/queries/platform-affiliates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";

export const metadata = {
  title: "Earnings | Affiliate Dashboard",
};

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  available: {
    label: "Available",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  paid: {
    label: "Paid",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle,
  },
  voided: { label: "Voided", color: "bg-red-100 text-red-800", icon: Ban },
};

export default async function AffiliateEarningsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/affiliate/dashboard/earnings");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate || affiliate.status !== "approved") {
    redirect("/become-affiliate");
  }

  const [commissions, stats] = await Promise.all([
    getAffiliateCommissions(affiliate.id, { page: 1, limit: 50 }),
    getAffiliateDashboardStats(affiliate.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">
          Track your commission earnings from referred subscriptions.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Wallet className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(parseFloat(stats?.totalEarned || "0"), "AFN")}
                </p>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(
                    parseFloat(stats?.availableBalance || "0"),
                    "AFN"
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(parseFloat(stats?.totalPending || "0"), "AFN")}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
                <CheckCircle className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(parseFloat(stats?.totalPaidOut || "0"), "AFN")}
                </p>
                <p className="text-xs text-muted-foreground">Paid Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission History */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
          <CardDescription>
            All your commission earnings from referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.items.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No earnings yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You&apos;ll start earning commissions when your referred stores
                make their first subscription payment.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.items.map((commission) => {
                  const status =
                    statusConfig[
                      commission.status as keyof typeof statusConfig
                    ];
                  const StatusIcon = status?.icon || Clock;

                  return (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {commission.referral?.tenant?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {commission.referral?.tenant?.slug || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">Subscription</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatPrice(
                            parseFloat(commission.commissionAmount),
                            "AFN"
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {commission.commissionRate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            status?.color || "bg-gray-100 text-gray-800"
                          }
                        >
                          <StatusIcon className="mr-1 size-3" />
                          {status?.label || commission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {commission.createdAt
                          ? new Date(commission.createdAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* How Commissions Work */}
      <Card>
        <CardHeader>
          <CardTitle>How Commissions Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="size-4 text-amber-600" />
                Pending
              </h4>
              <p className="text-sm text-muted-foreground">
                Commissions are pending until the referred store passes the
                30-day retention period.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600" />
                Available
              </h4>
              <p className="text-sm text-muted-foreground">
                Once the retention period passes, commissions become available
                for payout.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
