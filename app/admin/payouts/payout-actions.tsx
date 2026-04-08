"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  adminMarkPayoutProcessing,
  adminCompletePayout,
  adminRejectPayout,
} from "@/lib/actions/earnings";

interface PayoutActionsProps {
  payoutId: string;
  status: string;
  isCrypto: boolean;
}

export function PayoutActions({
  payoutId,
  status,
  isCrypto,
}: PayoutActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const handleMarkProcessing = async () => {
    setIsLoading(true);
    try {
      const result = await adminMarkPayoutProcessing(payoutId);
      if (result.success) {
        toast.success("Marked as processing");
        router.refresh();
      } else {
        toast.error(result.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const result = await adminCompletePayout(
        payoutId,
        txHash.trim() || undefined
      );
      if (result.success) {
        toast.success("Payout marked as completed");
        setCompleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setIsLoading(true);
    try {
      const result = await adminRejectPayout(payoutId, rejectReason);
      if (result.success) {
        toast.success("Payout rejected, funds returned to seller");
        setRejectOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2 border-t pt-3">
      {/* Mark as processing */}
      {status === "pending" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkProcessing}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 size-3.5" />
          )}
          Mark Processing
        </Button>
      )}

      {/* Complete — open dialog to optionally enter tx hash */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={isLoading}>
            <CheckCircle2 className="mr-2 size-3.5" />
            Complete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Payout</DialogTitle>
            <DialogDescription>
              Confirm that you have sent the funds to the seller.
              {isCrypto &&
                " Enter the transaction hash for the seller's records."}
            </DialogDescription>
          </DialogHeader>
          {isCrypto && (
            <Field>
              <FieldLabel>Transaction Hash (optional)</FieldLabel>
              <Input
                placeholder="Paste the TRC20 transaction hash..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Confirm Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <XCircle className="mr-2 size-3.5" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payout</DialogTitle>
            <DialogDescription>
              The funds will be returned to the seller&apos;s available balance.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Reason (required)</FieldLabel>
            <Textarea
              placeholder="Why is this payout being rejected?"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading || !rejectReason.trim()}
            >
              {isLoading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Reject Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
