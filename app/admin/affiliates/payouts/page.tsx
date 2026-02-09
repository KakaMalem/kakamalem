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
  Wallet,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PayoutActions } from "./payout-actions";

async function getPayoutsData(status: string, page: number) {
  try {
    const { getPendingPayoutsForAdmin } =
      await import("@/lib/db/queries/platform-affiliates");

    const result = await getPendingPayoutsForAdmin({
      status: status as "pending" | "processing" | "completed" | "failed",
      page,
      limit: 20,
    });

    return {
      success: true,
      payouts: result.items,
      pagination: {
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Failed to fetch payouts:", error);
    return {
      success: false,
      error: "Failed to load payouts",
    };
  }
}

interface PayoutsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function AdminAffiliatePayoutsPage({
  searchParams,
}: PayoutsPageProps) {
  const params = await searchParams;
  const status = params.status || "pending";
  const page = parseInt(params.page || "1", 10);

  const result = await getPayoutsData(status, page);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/affiliates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            Affiliate Payouts
          </h1>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="size-16 text-amber-600 mb-4" />
            <h2 className="text-xl font-bold">Error Loading Payouts</h2>
            <p className="text-muted-foreground">{result.error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { payouts = [], pagination } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Affiliate Payouts
          </h1>
          <p className="text-muted-foreground">
            Review and process affiliate payout requests
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        <Link href="/admin/affiliates/payouts?status=pending">
          <Button
            variant={status === "pending" ? "default" : "outline"}
            size="sm"
          >
            <Clock className="mr-2 size-4" />
            Pending
          </Button>
        </Link>
        <Link href="/admin/affiliates/payouts?status=processing">
          <Button
            variant={status === "processing" ? "default" : "outline"}
            size="sm"
          >
            <Wallet className="mr-2 size-4" />
            Processing
          </Button>
        </Link>
        <Link href="/admin/affiliates/payouts?status=completed">
          <Button
            variant={status === "completed" ? "default" : "outline"}
            size="sm"
          >
            <CheckCircle className="mr-2 size-4" />
            Completed
          </Button>
        </Link>
      </div>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            {pagination?.total ?? 0} Payout{pagination?.total !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No {status} payouts found
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="space-y-3 md:hidden">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm">
                          {payout.payoutNumber}
                        </p>
                        <p className="text-lg font-bold">
                          {formatPrice(
                            parseFloat(payout.amount),
                            payout.currency
                          )}
                        </p>
                      </div>
                      <PayoutStatusBadge status={payout.status} />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">
                        {payout.affiliate?.displayName}
                      </p>
                      <p className="text-muted-foreground">
                        {payout.affiliate?.user?.email}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Method: {payout.payoutMethod}</p>
                      <p className="flex items-center gap-1">
                        Requested: <RelativeTime date={payout.requestedAt} />
                      </p>
                    </div>
                    {status === "pending" && (
                      <PayoutActions payoutId={payout.id} />
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payout #</TableHead>
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      {status === "pending" && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-mono text-sm">
                          {payout.payoutNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {payout.affiliate?.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payout.affiliate?.user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(
                            parseFloat(payout.amount),
                            payout.currency
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.payoutMethod}</Badge>
                        </TableCell>
                        <TableCell>
                          <PayoutStatusBadge status={payout.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <RelativeTime date={payout.requestedAt} />
                        </TableCell>
                        {status === "pending" && (
                          <TableCell className="text-right">
                            <PayoutActions payoutId={payout.id} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/admin/affiliates/payouts?status=${status}&page=${pagination.page - 1}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                </Link>
                <Link
                  href={`/admin/affiliates/payouts?status=${status}&page=${pagination.page + 1}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
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
