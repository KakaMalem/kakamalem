"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminProcessPayout } from "@/lib/actions/platform-affiliates";

interface PayoutActionsProps {
  payoutId: string;
}

export function PayoutActions({ payoutId }: PayoutActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState("");

  const handleAction = async (action: "approve" | "reject") => {
    setIsLoading(true);
    try {
      const result = await adminProcessPayout({
        payoutId,
        action,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success(
          action === "approve"
            ? "Payout approved and marked as processing"
            : "Payout rejected"
        );
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to process payout");
      }
    } catch (error) {
      console.error("Error processing payout:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
      setNotes("");
    }
  };

  return (
    <div className="flex gap-2">
      {/* Approve */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" size="sm" disabled={isLoading}>
            <CheckCircle className="mr-1 size-3" />
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Payout</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the payout as processing. Make sure to actually
              send the payment to the affiliate before marking it as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-notes">Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              placeholder="Transaction ID or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNotes("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction("approve")}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <XCircle className="mr-1 size-3" />
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payout</AlertDialogTitle>
            <AlertDialogDescription>
              The affiliate will be notified that their payout request was
              rejected. The commission amount will be returned to their
              available balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="Reason for rejection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNotes("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction("reject")}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
