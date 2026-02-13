import { redirect } from "next/navigation";
import { Wallet, CheckCircle, Clock, XCircle } from "lucide-react";

import { getUser } from "@/lib/auth/server";
import {
  getPlatformAffiliateByUserId,
  getAffiliatePayouts,
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
import { RequestPayoutDialog } from "@/components/affiliate/request-payout-dialog";
import { PayoutMethodDialog } from "@/components/affiliate/payout-method-dialog";

export const metadata = {
  title: "Payouts | Affiliate Dashboard",
};

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default async function AffiliatePayoutsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/affiliate/dashboard/payouts");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate || affiliate.status !== "approved") {
    redirect("/become-affiliate");
  }

  const [payouts, stats] = await Promise.all([
    getAffiliatePayouts(affiliate.id, { page: 1, limit: 50 }),
    getAffiliateDashboardStats(affiliate.id),
  ]);

  const availableBalance = parseFloat(stats?.availableBalance || "0");
  const canRequestPayout = availableBalance >= 1000; // Minimum 1000 AFN

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Request payouts and view your payout history.
        </p>
      </div>

      {/* Balance Card */}
      <Card className="bg-linear-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader>
          <CardTitle>Available Balance</CardTitle>
          <CardDescription>
            Your available balance for withdrawal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-4xl font-bold">
                {formatPrice(availableBalance, "AFN")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Minimum payout: {formatPrice(1000, "AFN")}
              </p>
            </div>
            <RequestPayoutDialog
              availableBalance={availableBalance}
              hasPayoutMethod={!!affiliate.payoutMethod}
              minimumPayout={1000}
            />
          </div>
          {!affiliate.payoutMethod && availableBalance > 0 && (
            <p className="text-sm text-amber-600 mt-3">
              Please configure a payout method before requesting a payout.
            </p>
          )}
          {affiliate.payoutMethod &&
            !canRequestPayout &&
            availableBalance > 0 && (
              <p className="text-sm text-amber-600 mt-3">
                You need at least {formatPrice(1000, "AFN")} to request a
                payout. You need {formatPrice(1000 - availableBalance, "AFN")}{" "}
                more.
              </p>
            )}
        </CardContent>
      </Card>

      {/* Payout Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Method</CardTitle>
          <CardDescription>
            Configure how you want to receive your payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {affiliate.payoutMethod ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium capitalize">
                  {affiliate.payoutMethod.replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Configured and ready to receive payments
                </p>
              </div>
              <PayoutMethodDialog
                currentMethod={affiliate.payoutMethod}
                currentDetails={
                  affiliate.payoutDetails as Record<string, string> | null
                }
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No payout method configured
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Add a payout method to receive your earnings. We support bank
                transfer and mobile money.
              </p>
              <PayoutMethodDialog />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            All your payout requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.items.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payouts yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your payout history will appear here once you request your first
                payout.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.items.map((payout) => {
                  const status =
                    statusConfig[payout.status as keyof typeof statusConfig];
                  const StatusIcon = status?.icon || Clock;

                  return (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {payout.payoutNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatPrice(
                            parseFloat(payout.amount),
                            payout.currency
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">
                          {payout.payoutMethod?.replace("_", " ") || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            status?.color || "bg-gray-100 text-gray-800"
                          }
                        >
                          <StatusIcon className="mr-1 size-3" />
                          {status?.label || payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payout.requestedAt
                          ? new Date(payout.requestedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {payout.completedAt
                          ? new Date(payout.completedAt).toLocaleDateString()
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
    </div>
  );
}
