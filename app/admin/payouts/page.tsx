import { db } from "@/lib/db";
import { sellerPayouts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { PayoutActions } from "./payout-actions";

export const metadata = {
  title: "Seller Payouts - Admin",
};

export default async function AdminPayoutsPage() {
  const allPayouts = await db.query.sellerPayouts.findMany({
    with: {
      tenant: { columns: { id: true, name: true, slug: true } },
      payoutMethod: {
        columns: {
          type: true,
          walletAddress: true,
          bankName: true,
          accountNumber: true,
          label: true,
        },
      },
    },
    orderBy: [desc(sellerPayouts.requestedAt)],
  });

  const pending = allPayouts.filter(
    (p) => p.status === "pending" || p.status === "processing"
  );
  const completed = allPayouts.filter((p) => p.status === "completed");
  const failed = allPayouts.filter((p) => p.status === "failed");

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-zinc-100 text-zinc-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Seller Payouts</h1>
        <p className="text-muted-foreground">
          Process seller withdrawal requests. Send crypto manually, then mark as
          completed.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-600">
              {pending.length}
            </p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {completed.length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{failed.length}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">
              {pending
                .reduce((sum, p) => sum + parseFloat(p.netAmount), 0)
                .toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">USDT to send</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="size-5 text-yellow-500" />
            Pending ({pending.length})
          </h2>
          {pending.map((payout) => (
            <Card key={payout.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {payout.payoutNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {payout.tenant?.name || "Unknown store"} &middot;{" "}
                      {new Date(payout.requestedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                  <Badge className={statusColors[payout.status]}>
                    {payout.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-semibold text-lg">
                      {parseFloat(payout.netAmount).toFixed(2)}{" "}
                      {payout.currency}
                    </p>
                    {parseFloat(payout.fee) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Fee: {parseFloat(payout.fee).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">
                      {payout.payoutMethod?.type === "crypto"
                        ? `Crypto (${payout.cryptoNetwork?.toUpperCase() || "TRC20"})`
                        : payout.payoutMethod?.type || "Unknown"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Send to</p>
                    {payout.payoutMethod?.walletAddress ? (
                      <code className="text-xs font-mono break-all bg-zinc-50 rounded px-1.5 py-0.5">
                        {payout.payoutMethod.walletAddress}
                      </code>
                    ) : payout.payoutMethod?.bankName ? (
                      <p className="font-medium">
                        {payout.payoutMethod.bankName} —{" "}
                        {payout.payoutMethod.accountNumber}
                      </p>
                    ) : (
                      <p className="text-zinc-400">No method configured</p>
                    )}
                  </div>
                </div>

                {payout.notes && (
                  <p className="text-sm text-muted-foreground border-t pt-3">
                    Note: {payout.notes}
                  </p>
                )}

                <PayoutActions
                  payoutId={payout.id}
                  status={payout.status}
                  isCrypto={payout.payoutMethod?.type === "crypto"}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No pending payouts.
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Completed ({completed.length})
          </h2>
          {completed.slice(0, 20).map((payout) => (
            <Card key={payout.id} className="opacity-75">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{payout.payoutNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {payout.tenant?.name} &middot;{" "}
                      {parseFloat(payout.netAmount).toFixed(2)}{" "}
                      {payout.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={statusColors[payout.status]}>
                      {payout.status}
                    </Badge>
                    {payout.cryptoTxHash && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 max-w-[200px] truncate">
                        {payout.cryptoTxHash}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
