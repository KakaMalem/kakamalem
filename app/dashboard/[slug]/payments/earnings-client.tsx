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
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatPrice, cn } from "@/lib/utils";
import { requestPayout, updatePayoutAccount } from "@/lib/actions/payouts";
import type { PayoutRecord } from "@/lib/actions/payouts";
import { MIN_PAYOUT_AFN } from "@/lib/payouts/constants";
import {
  HESABPAY_COUNTRY,
  PAYOUT_ACCOUNT_MESSAGES,
  formatPayoutAccount,
  normalizePayoutAccount,
  toE164ForDisplay,
} from "@/lib/payouts/account";
import { isSafeToRetry } from "@/lib/payouts/errors";
import type { PayoutError, PayoutErrorKind } from "@/lib/payouts/errors";
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
  processing: { label: "Checking", variant: "secondary" },
  completed: { label: "Sent", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

type FieldName = NonNullable<PayoutError["field"]>;

/**
 * The only way an error message reaches the DOM.
 *
 * Values cross the server-action boundary and can carry whatever a gateway
 * returned. Handing React a non-string as a child throws and blanks the page,
 * which is exactly how this page broke once, so every path goes through here:
 * toasts and inline field errors alike.
 */
function asText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value !== null && value !== undefined) {
    console.error("[earnings] Non-string error from server action:", value);
  }
  return fallback;
}

/**
 * A failure is not just a message. What the seller should do next depends
 * entirely on why it failed, so each kind gets its own treatment.
 */
function reportError(error: PayoutError | undefined, fallback: string) {
  const message = asText(error?.message, fallback);
  const kind: PayoutErrorKind = error?.kind ?? "unexpected";

  switch (kind) {
    case "unknown_outcome":
      // The money may have moved. This must not be dismissed in two seconds.
      toast.warning("We could not confirm this withdrawal", {
        description: `${message} Do not try again until you have checked.`,
        duration: 30000,
      });
      return;
    case "gateway":
      toast.error("HesabPay refused the transfer", {
        description: message,
        duration: 10000,
      });
      return;
    case "configuration":
      toast.error("Payouts are unavailable", {
        description: message,
        duration: 10000,
      });
      return;
    case "balance":
    case "permission":
    case "validation":
      toast.error(message);
      return;
    default:
      toast.error(message);
  }
}

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

  // The phone input works in E.164. A value saved before this field became a
  // phone input is converted on the way in, or dropped if it cannot be read.
  const [accountNumber, setAccountNumber] = useState(() =>
    toE164ForDisplay(payoutAccount.accountNumber)
  );
  const [accountName, setAccountName] = useState(payoutAccount.accountName);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // After an unconfirmed withdrawal, pressing Send again could pay twice.
  const [lastErrorKind, setLastErrorKind] = useState<PayoutErrorKind | null>(
    null
  );

  // "No account" and "an account that cannot be paid" are different problems,
  // and the seller who hit this needs to be told which one they have.
  const storedAccount = normalizePayoutAccount(payoutAccount.accountNumber);
  const storedAccountUsable = storedAccount.ok;
  const storedAccountProblem =
    !storedAccount.ok && payoutAccount.accountNumber.trim()
      ? PAYOUT_ACCOUNT_MESSAGES[storedAccount.error]
      : null;
  const accountChanged =
    accountNumber.trim() !== toE164ForDisplay(payoutAccount.accountNumber) ||
    accountName.trim() !== payoutAccount.accountName;

  // A payout we never got an answer on holds money and needs a human.
  const unresolvedPayout = payouts.find(
    (payout) => payout.status === "processing"
  );

  // HesabPay settles whole Afghani, so this is the most that can ever be sent.
  const withdrawableBalance = Math.floor(balance.available);

  const canWithdraw =
    isOwner && storedAccountUsable && !unresolvedPayout && withdrawableBalance >= 1;

  /**
   * Why the button is off. A disabled control with no explanation reads as a
   * broken page, and the seller cannot tell "wait for an order" apart from
   * "your saved number is wrong" — which are opposite actions.
   */
  const withdrawBlockedReason = !isOwner
    ? "Only the store owner can withdraw."
    : unresolvedPayout
      ? "A withdrawal is still unconfirmed. That has to be resolved first."
      : !storedAccountUsable
        ? "Add the HesabPay number to send your money to."
        : withdrawableBalance < 1
          ? "Nothing to withdraw yet. Paid card orders land here."
          : null;

  // Never offer a one-tap retry of something that may already have paid out.
  const retryBlocked = Boolean(
    unresolvedPayout || (lastErrorKind && !isSafeToRetry(lastErrorKind))
  );

  const afn = (amount: number) => formatPrice(amount, AFN);

  const clearField = (field: FieldName) =>
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleSaveAccount = () => {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updatePayoutAccount(storeId, {
        accountNumber,
        accountName,
      });

      if (!result.success) {
        if (result.error?.field) {
          setFieldErrors({
            [result.error.field]: asText(
              result.error.message,
              "That value is not valid"
            ),
          });
        }
        reportError(result.error, "Could not save the payout account");
        return;
      }

      toast.success("Payout account saved");
      router.refresh();
    });
  };

  const handleWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFieldErrors({ amount: "Enter an amount to withdraw" });
      return;
    }
    // Same rule the server enforces: the minimum only limits partial
    // withdrawals, so a remainder under it can always still be taken out.
    if (amount < MIN_PAYOUT_AFN && Math.floor(amount) !== withdrawableBalance) {
      setFieldErrors({
        amount: `Withdraw at least ${afn(MIN_PAYOUT_AFN)}, or take out your whole balance of ${afn(withdrawableBalance)}`,
      });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await requestPayout(storeId, amount);

      if (!result.success) {
        const kind = result.error?.kind ?? "unexpected";
        setLastErrorKind(kind);

        if (result.error?.field) {
          setFieldErrors({
            [result.error.field]: asText(
              result.error.message,
              "That value is not valid"
            ),
          });
        }
        reportError(result.error, "The withdrawal did not go through");

        // Stay open for the two things the seller fixes in this dialog, and
        // for an unconfirmed outcome where the warning must remain visible.
        const keepOpen =
          kind === "unknown_outcome" ||
          kind === "validation" ||
          kind === "balance";
        if (!keepOpen) setWithdrawOpen(false);

        router.refresh();
        return;
      }

      setLastErrorKind(null);
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

      {unresolvedPayout && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Withdrawal {unresolvedPayout.payoutNumber} for{" "}
            {afn(unresolvedPayout.amount)} has not been confirmed. That money is
            being held until it is resolved. Check your HesabPay account to see
            whether it arrived, and contact support before withdrawing it again.
          </AlertDescription>
        </Alert>
      )}

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
                {afn(balance.reserved)} is held by a withdrawal in progress
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setWithdrawAmount(String(Math.floor(balance.available)));
                  setFieldErrors({});
                  setWithdrawOpen(true);
                }}
                disabled={!canWithdraw || isPending}
              >
                <ArrowDownToLine className="mr-2 size-4" />
                Withdraw
              </Button>
              {withdrawBlockedReason && (
                <span className="self-center text-sm text-muted-foreground">
                  {withdrawBlockedReason}
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
              <span className="font-medium">
                {afn(balance.lifetimePaidOut)}
              </span>
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
            The HesabPay number withdrawals are sent to. Check it carefully:
            transfers cannot be reversed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!storedAccountUsable && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {storedAccountProblem
                  ? `The saved number ${payoutAccount.accountNumber} cannot be paid out to: ${storedAccountProblem.toLowerCase()}. Re-enter it below.`
                  : "Add your HesabPay number before you can withdraw."}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accountNumber">HesabPay number</Label>
              <PhoneInput
                id="accountNumber"
                // HesabPay is Afghanistan-only, so the country is fixed. A
                // number from anywhere else cannot receive a transfer.
                defaultCountry={HESABPAY_COUNTRY}
                countries={[HESABPAY_COUNTRY]}
                international
                // Without this the +93 prefix stays editable and a pasted
                // foreign number is accepted, so the flag lies. This is the
                // prop that actually pins the country.
                countryCallingCodeEditable={false}
                countrySelectProps={{ disabled: true }}
                value={accountNumber}
                onChange={(value) => {
                  setAccountNumber(value || "");
                  clearField("accountNumber");
                }}
                placeholder="77 602 2969"
                disabled={!isOwner || isPending}
                aria-invalid={!!fieldErrors.accountNumber}
              />
              {fieldErrors.accountNumber ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.accountNumber}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The mobile number your HesabPay account is registered to.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountName">Account holder name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => {
                  setAccountName(e.target.value);
                  clearField("accountName");
                }}
                placeholder="As it appears in HesabPay"
                disabled={!isOwner || isPending}
                aria-invalid={!!fieldErrors.accountName}
              />
              {fieldErrors.accountName && (
                <p className="text-sm text-destructive">
                  {fieldErrors.accountName}
                </p>
              )}
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
              const status = PAYOUT_STATUS[payout.status] ?? {
                label: payout.status,
                variant: "secondary" as const,
              };
              // Older rows can hold a mangled reason from before gateway
              // errors were coerced to text. Never show that to a seller.
              const reason =
                payout.failureReason &&
                payout.failureReason !== "[object Object]"
                  ? payout.failureReason
                  : null;

              return (
                <div
                  key={payout.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{afn(payout.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payout.payoutNumber} &middot; to{" "}
                      {formatPayoutAccount(payout.accountNumber)} &middot;{" "}
                      {new Date(payout.requestedAt).toLocaleString()}
                    </p>
                    {reason && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          payout.status === "processing"
                            ? "text-amber-700"
                            : "text-destructive"
                        )}
                      >
                        {reason}
                      </p>
                    )}
                    {payout.status === "processing" && (
                      <p className="mt-1 text-xs text-amber-700">
                        Not confirmed yet. Check your HesabPay account before
                        requesting this again.
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
              Sent to {payoutAccount.accountName || "your account"} on{" "}
              {formatPayoutAccount(payoutAccount.accountNumber)}. Transfers
              cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="withdrawAmount">Amount ({AFN})</Label>
            <Input
              id="withdrawAmount"
              type="number"
              inputMode="numeric"
              min={Math.min(MIN_PAYOUT_AFN, withdrawableBalance)}
              max={withdrawableBalance}
              value={withdrawAmount}
              onChange={(e) => {
                setWithdrawAmount(e.target.value);
                clearField("amount");
              }}
              disabled={isPending}
              aria-invalid={!!fieldErrors.amount}
            />
            {fieldErrors.amount ? (
              <p className="text-sm text-destructive">{fieldErrors.amount}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Available {afn(balance.available)}.{" "}
                {withdrawableBalance < MIN_PAYOUT_AFN
                  ? "You can take out the whole amount."
                  : `Minimum ${afn(MIN_PAYOUT_AFN)}, or take out everything.`}
              </p>
            )}
          </div>

          {retryBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                This withdrawal has not been confirmed. Check your HesabPay
                account and contact support before sending it again.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={isPending || retryBlocked}
            >
              {isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
