"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  Store,
  Hash,
  Loader2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  verifyCryptoPayment,
  rejectCryptoPayment,
  type CryptoPaymentDetails,
} from "@/lib/actions/crypto-payments";
import {
  NETWORK_INFO,
  getTransactionExplorerUrl,
} from "@/lib/payments/crypto/types";
import { toast } from "sonner";

interface CryptoVerificationsClientProps {
  payments: CryptoPaymentDetails[];
}

export function CryptoVerificationsClient({
  payments: initialPayments,
}: CryptoVerificationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payments, setPayments] = useState(initialPayments);

  // Dialog state
  const [verifyDialog, setVerifyDialog] = useState<{
    open: boolean;
    payment: CryptoPaymentDetails | null;
  }>({ open: false, payment: null });

  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    payment: CryptoPaymentDetails | null;
    reason: string;
  }>({ open: false, payment: null, reason: "" });

  const handleVerify = (payment: CryptoPaymentDetails) => {
    setVerifyDialog({ open: true, payment });
  };

  const handleReject = (payment: CryptoPaymentDetails) => {
    setRejectDialog({ open: true, payment, reason: "" });
  };

  const confirmVerify = (adminNotes?: string) => {
    if (!verifyDialog.payment) return;

    startTransition(async () => {
      const result = await verifyCryptoPayment(
        verifyDialog.payment!.id,
        adminNotes
      );

      if (result.success) {
        toast.success("Payment verified successfully");
        // Remove from list
        setPayments((prev) =>
          prev.filter((p) => p.id !== verifyDialog.payment!.id)
        );
        setVerifyDialog({ open: false, payment: null });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to verify payment");
      }
    });
  };

  const confirmReject = () => {
    if (!rejectDialog.payment || !rejectDialog.reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    startTransition(async () => {
      const result = await rejectCryptoPayment(
        rejectDialog.payment!.id,
        rejectDialog.reason
      );

      if (result.success) {
        toast.success("Payment rejected");
        // Remove from list
        setPayments((prev) =>
          prev.filter((p) => p.id !== rejectDialog.payment!.id)
        );
        setRejectDialog({ open: false, payment: null, reason: "" });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reject payment");
      }
    });
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            No pending verifications
          </h3>
          <p className="text-sm text-muted-foreground">
            All crypto payments have been processed
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} awaiting
            verification
          </p>
        </div>

        <div className="grid gap-4">
          {payments.map((payment) => {
            const networkInfo = NETWORK_INFO[payment.network];
            const explorerUrl = payment.transactionHash
              ? getTransactionExplorerUrl(
                  payment.transactionHash,
                  payment.network
                )
              : null;

            return (
              <Card key={payment.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="size-4" />
                        {parseFloat(payment.expectedAmount).toFixed(2)} USDT
                        <Badge variant="outline" className="ml-2">
                          {networkInfo.name}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {payment.storeName && (
                          <span className="flex items-center gap-1">
                            <Store className="size-3" />
                            {payment.storeName}
                          </span>
                        )}
                        {payment.orderNumber && (
                          <span className="ml-2">
                            Order #{payment.orderNumber}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <RelativeTime date={payment.submittedAt} />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Transaction Hash */}
                  <div className="rounded-md bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="size-4 text-muted-foreground" />
                        <span className="font-mono text-xs break-all">
                          {payment.transactionHash || "No hash submitted"}
                        </span>
                      </div>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View on Explorer
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Original Amount:
                      </span>
                      <span className="ml-2 font-medium">
                        {payment.originalAmountAfn
                          ? parseFloat(
                              payment.originalAmountAfn
                            ).toLocaleString()
                          : "N/A"}{" "}
                        AFN
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Exchange Rate:
                      </span>
                      <span className="ml-2 font-medium">
                        1 USDT = {payment.exchangeRate || "N/A"} AFN
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Network:</span>
                      <span className="ml-2 font-medium">
                        {networkInfo.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wallet:</span>
                      <span className="ml-2 font-mono text-xs">
                        {payment.walletAddress.slice(0, 10)}...
                        {payment.walletAddress.slice(-8)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Notes */}
                  {payment.customerNotes && (
                    <div className="rounded-md border p-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Customer Note:
                      </span>
                      <p className="mt-1 text-sm">{payment.customerNotes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(payment)}
                      disabled={isPending}
                    >
                      <XCircle className="mr-1 size-4" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleVerify(payment)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 size-4" />
                      )}
                      Verify Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Verify Dialog */}
      <Dialog
        open={verifyDialog.open}
        onOpenChange={(open) => setVerifyDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
            <DialogDescription>
              Confirm that you have verified the transaction on the blockchain.
            </DialogDescription>
          </DialogHeader>

          {verifyDialog.payment && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {parseFloat(verifyDialog.payment.expectedAmount).toFixed(2)}{" "}
                    USDT
                  </span>
                  <span className="text-muted-foreground">Network:</span>
                  <span className="font-medium">
                    {NETWORK_INFO[verifyDialog.payment.network].name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Only verify if you have confirmed the transaction on the
                  blockchain explorer.
                </span>
              </div>

              <div>
                <Label>Admin Notes (optional)</Label>
                <Textarea
                  placeholder="Any notes about this verification..."
                  className="mt-1"
                  id="admin-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVerifyDialog({ open: false, payment: null })}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const notes = (
                  document.getElementById("admin-notes") as HTMLTextAreaElement
                )?.value;
                confirmVerify(notes);
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1 size-4" />
              )}
              Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g., Transaction not found, Wrong amount, etc."
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRejectDialog({ open: false, payment: null, reason: "" })
              }
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={isPending || !rejectDialog.reason.trim()}
            >
              {isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <XCircle className="mr-1 size-4" />
              )}
              Reject Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
