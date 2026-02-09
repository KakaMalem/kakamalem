"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowUpRight, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { requestAffiliatePayout } from "@/lib/actions/platform-affiliates";
import { formatPrice } from "@/lib/utils";

interface RequestPayoutDialogProps {
  availableBalance: number;
  hasPayoutMethod: boolean;
  minimumPayout?: number;
}

export function RequestPayoutDialog({
  availableBalance,
  hasPayoutMethod,
  minimumPayout = 1000,
}: RequestPayoutDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [payoutNumber, setPayoutNumber] = useState<string | null>(null);

  const canRequest = availableBalance >= minimumPayout && hasPayoutMethod;

  const handleRequest = async () => {
    setIsLoading(true);
    try {
      const result = await requestAffiliatePayout();
      if (result.success && result.data) {
        setSuccess(true);
        setPayoutNumber(result.data.payoutNumber);
        toast.success("Payout requested successfully!");
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to request payout");
      }
    } catch (error) {
      console.error("Error requesting payout:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSuccess(false);
    setPayoutNumber(null);
  };

  if (!hasPayoutMethod) {
    return (
      <Button disabled size="lg" title="Configure a payout method first">
        <ArrowUpRight className="mr-2 size-4" />
        Request Payout
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canRequest} size="lg">
          <ArrowUpRight className="mr-2 size-4" />
          Request Payout
        </Button>
      </DialogTrigger>
      <DialogContent>
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="size-5" />
                Payout Requested!
              </DialogTitle>
              <DialogDescription>
                Your payout request has been submitted successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Payout Number
              </p>
              <p className="text-xl font-mono font-semibold">{payoutNumber}</p>
              <p className="text-sm text-muted-foreground mt-4">
                We&apos;ll process your payout and notify you once it&apos;s
                completed. This usually takes 1-3 business days.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request Payout</DialogTitle>
              <DialogDescription>
                Withdraw your available commission balance.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Amount to withdraw
                </p>
                <p className="text-3xl font-bold">
                  {formatPrice(availableBalance, "AFN")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The full available balance will be withdrawn to your configured
                payout method. Processing typically takes 1-3 business days.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequest} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirm Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
