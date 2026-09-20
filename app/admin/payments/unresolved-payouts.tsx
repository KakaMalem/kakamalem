"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils";
import { resolveUnconfirmedPayout } from "@/lib/actions/payouts";
import type { UnresolvedPayout } from "@/lib/actions/payouts";
import { formatPayoutAccount } from "@/lib/payouts/account";

/**
 * Withdrawals whose outcome HesabPay never confirmed.
 *
 * The seller's money is still reserved, so it is neither spendable nor lost.
 * Only a person looking at the real HesabPay account can say which way it went,
 * and this is where they record that answer.
 */
export function UnresolvedPayouts({ payouts }: { payouts: UnresolvedPayout[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (payouts.length === 0) return null;

  const resolve = (payoutId: string, resolution: "sent" | "not_sent") => {
    startTransition(async () => {
      const result = await resolveUnconfirmedPayout(
        payoutId,
        resolution,
        notes[payoutId]
      );

      if (!result.success) {
        toast.error(result.error?.message || "Could not resolve that withdrawal");
        router.refresh();
        return;
      }

      toast.success(
        resolution === "sent"
          ? "Marked as sent"
          : "Funds returned to the seller's balance"
      );
      router.refresh();
    });
  };

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600" />
          Withdrawals needing a decision ({payouts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            HesabPay never confirmed these, so the money is held and the seller
            cannot withdraw it. Check the platform HesabPay account for each
            transfer, then record what actually happened. Marking one wrongly
            either pays the seller twice or takes money they are owed.
          </AlertDescription>
        </Alert>

        {payouts.map((payout) => (
          <div key={payout.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {formatPrice(payout.amount, payout.currency)} to{" "}
                  {payout.storeName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payout.payoutNumber} &middot;{" "}
                  {payout.accountName || "unnamed account"} on{" "}
                  {formatPayoutAccount(payout.accountNumber)} &middot;{" "}
                  {new Date(payout.requestedAt).toLocaleString()}
                </p>
                {payout.failureReason && (
                  <p className="mt-1 text-xs text-amber-700">
                    {payout.failureReason}
                  </p>
                )}
              </div>
            </div>

            <Input
              value={notes[payout.id] || ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [payout.id]: e.target.value }))
              }
              placeholder="What you found in HesabPay (optional)"
              disabled={isPending}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve(payout.id, "sent")}
                disabled={isPending}
              >
                The money was sent
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve(payout.id, "not_sent")}
                disabled={isPending}
              >
                It never left, return it
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
