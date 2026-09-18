"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  Clock,
  Info,
  Landmark,
  Wallet,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { requestPayout, updatePayoutAccount } from "@/lib/actions/payouts";
import type { PayoutRecord } from "@/lib/actions/payouts";
import {
  MIN_PAYOUT_AFN,
  isValidHesabPayAccount,
} from "@/lib/payouts/constants";
import type {
  LedgerEntryView,
  SellerBalanceSummary,
} from "@/lib/payouts/ledger";

const AFN = "AFN";

const ENTRY_LABELS: Record<string, string> = {
  earning: "Order payment",
  refund: "Refund",
  payout: "Withdrawal",
  payout_reversal: "Withdrawal returned",
  adjustment: "Adjustment",
};

const PAYOUT_STATUS: Record<
  PayoutRecord["status"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Sent", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

interface EarningsClientProps {
  storeId: string;
  storeSlug: string;
  storeCurrency: string;
  isOwner: boolean;
  balance: SellerBalanceSummary;
  totals: { orders: number; earned: number; refunded: number };
  ledger: LedgerEntryView[];
  payouts: PayoutRecord[];
  payoutAccount: { accountNumber: string; accountName: string };
}

export function EarningsClient({
  storeId,
  storeSlug,
  storeCurrency,
  isOwner,
  balance,
  totals,
  ledger,
  payouts,
  payoutAccount,
}: EarningsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accountNumber, setAccountNumber] = useState(
    payoutAccount.accountNumber
  );
  const [accountName, setAccountName] = useState(payoutAccount.accountName);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const hasAccount = isValidHesabPayAccount(payoutAccount.accountNumber);
  const accountChanged =
    accountNumber.trim() !== payoutAccount.accountNumber ||
    accountName.trim() !== payoutAccount.accountName;

  const canWithdraw =
    isOwner && hasAccount && balance.available >= MIN_PAYOUT_AFN;

  const afn = (amount: number) => formatPrice(amount, AFN);

  const handleSaveAccount = () => {
    startTransition(async () => {
      const result = await updatePayoutAccount(storeId, {
        accountNumber,
        accountName,
      });
      if (!result.success) {
        toast.error(result.error || "Could not save the payout account");
        return;
      }
      toast.success("Payout account saved");
      router.refresh();
    });
  };

  const handleWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount to withdraw");
      return;
    }

    startTransition(async () => {
      const result = await requestPayout(storeId, amount);
      if (!result.success) {
        toast.error(result.error || "The withdrawal did not go through");
        router.refresh();
        return;
      }
      toast.success("Sent to your HesabPay account");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">
          Money collected from card payments on your behalf, and withdrawals to
          your HesabPay account.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Balance                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" />
              Available to withdraw
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{afn(balance.available)}</p>
            {balance.reserved > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {afn(balance.reserved)} is being sent right now
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setWithdrawAmount(String(Math.floor(balance.available)));
                  setWithdrawOpen(true);
                }}
                disabled={!canWithdraw || isPending}
              >
                <ArrowDownToLine className="mr-2 size-4" />
                Withdraw
              </Button>
              {!isOwner && (
                <span className="self-center text-sm text-muted-foreground">
                  Only the store owner can withdraw.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lifetime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Earned</span>
              <span className="font-medium">{afn(totals.earned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Withdrawn</span>
              <span className="font-medium">{afn(balance.lifetimePaidOut)}</span>
            </div>
            {totals.refunded > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refunded</span>
                <span className="font-medium">-{afn(totals.refunded)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid orders</span>
              <span className="font-medium">{totals.orders}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {storeCurrency !== AFN && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Your prices are in {storeCurrency}, but HesabPay settles in Afghani,
            so your balance is held and paid out in {AFN}.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Banknote className="size-4" />
        <AlertDescription>
          Cash on delivery is not counted here. The courier hands that money
          straight to you, so it never passes through the platform. You keep the
          full amount of every order either way, with no commission taken.
        </AlertDescription>
      </Alert>

      {/* ------------------------------------------------------------------ */}
      {/* Payout account                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4" />
            Where your money goes
          </CardTitle>
          <CardDescription>
            The HesabPay account withdrawals are sent to. Check it carefully:
            transfers cannot be reversed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAccount && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Add your HesabPay account number before you can withdraw.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accountNumber">HesabPay account number</Label>
              <Input
                id="accountNumber"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="700000000"
                disabled={!isOwner || isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountName">Account holder name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="As it appears in HesabPay"
                disabled={!isOwner || isPending}
              />
            </div>
          </div>

          {isOwner && (
            <Button
              variant="outline"
              onClick={handleSaveAccount}
              disabled={!accountChanged || isPending}
            >
              {isPending ? "Saving..." : "Save account"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Withdrawals                                                         */}
      {/* ------------------------------------------------------------------ */}
      {payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Withdrawals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payouts.map((payout) => {
              const status = PAYOUT_STATUS[payout.status];
              return (
                <div
                  key={payout.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{afn(payout.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payout.payoutNumber} &middot; to {payout.accountNumber}{" "}
                      &middot; {new Date(payout.requestedAt).toLocaleString()}
                    </p>
                    {payout.failureReason && (
                      <p className="mt-1 text-xs text-destructive">
                        {payout.failureReason}
                      </p>
                    )}
                    {payout.status === "processing" && (
                      <p className="mt-1 text-xs text-amber-700">
                        We have not had a confirmation back yet. Check your
                        HesabPay account before requesting this again.
                      </p>
                    )}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Ledger                                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>
            Every movement in and out of your balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing yet. Card payments will appear here as orders come in.
            </p>
          ) : (
            <div className="space-y-3">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {entry.orderId ? (
                        <Link
                          href={`/dashboard/${storeSlug}/orders/${entry.orderId}`}
                          className="hover:underline"
                        >
                          {entry.description ||
                            ENTRY_LABELS[entry.type] ||
                            entry.type}
                        </Link>
                      ) : (
                        entry.description ||
                        ENTRY_LABELS[entry.type] ||
                        entry.type
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ENTRY_LABELS[entry.type] || entry.type} &middot;{" "}
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        entry.amount >= 0 ? "text-green-600" : "text-foreground"
                      )}
                    >
                      {entry.amount >= 0 ? "+" : "-"}
                      {afn(Math.abs(entry.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {afn(entry.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Withdraw dialog                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to HesabPay</DialogTitle>
            <DialogDescription>
              Sent to {payoutAccount.accountName || "your account"} (
              {payoutAccount.accountNumber}). Transfers cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="withdrawAmount">Amount ({AFN})</Label>
            <Input
              id="withdrawAmount"
              type="number"
              inputMode="numeric"
              min={MIN_PAYOUT_AFN}
              max={Math.floor(balance.available)}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Available {afn(balance.available)}. Minimum{" "}
              {afn(MIN_PAYOUT_AFN)}.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={isPending}>
              {isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
