import { redirect } from "next/navigation";
import { Users, Store, CheckCircle, Clock, XCircle } from "lucide-react";

import { getUser } from "@/lib/auth/server";
import {
  getPlatformAffiliateByUserId,
  getAffiliateReferrals,
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

export const metadata = {
  title: "Referrals | Affiliate Dashboard",
};

const statusConfig = {
  trial: { label: "In Trial", color: "bg-blue-100 text-blue-800", icon: Clock },
  active: {
    label: "Active",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  churned: {
    label: "Churned",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  completed: {
    label: "Completed",
    color: "bg-gray-100 text-gray-800",
    icon: CheckCircle,
  },
};

export default async function AffiliateReferralsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/affiliate/dashboard/referrals");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate || affiliate.status !== "approved") {
    redirect("/become-affiliate");
  }

  const referrals = await getAffiliateReferrals(affiliate.id, {
    page: 1,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground">
          Track all the stores that signed up through your affiliate link.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{referrals.total}</p>
                <p className="text-xs text-muted-foreground">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
                <Clock className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {referrals.items.filter((r) => r.status === "trial").length}
                </p>
                <p className="text-xs text-muted-foreground">In Trial</p>
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
                  {
                    referrals.items.filter(
                      (r) => r.status === "active" || r.retentionPassed
                    ).length
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Active / Converted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100">
                <XCircle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {referrals.items.filter((r) => r.status === "churned").length}
                </p>
                <p className="text-xs text-muted-foreground">Churned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
          <CardDescription>
            Stores that signed up through your affiliate link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.items.length === 0 ? (
            <div className="text-center py-12">
              <Store className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No referrals yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Share your affiliate link to start earning commissions when new
                stores sign up!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>First Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.items.map((referral) => {
                  const status =
                    statusConfig[referral.status as keyof typeof statusConfig];
                  const StatusIcon = status?.icon || Clock;

                  return (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {referral.tenant?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {referral.tenant?.slug || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            status?.color || "bg-gray-100 text-gray-800"
                          }
                        >
                          <StatusIcon className="mr-1 size-3" />
                          {status?.label || referral.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {referral.retentionPassed ? (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-200"
                          >
                            <CheckCircle className="mr-1 size-3" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-200"
                          >
                            <Clock className="mr-1 size-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {referral.signedUpAt
                          ? new Date(referral.signedUpAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {referral.firstPaidAt
                          ? new Date(referral.firstPaidAt).toLocaleDateString()
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
