"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { buyerConfirmDelivery, openEscrowDispute } from "@/lib/actions/escrow";
import type { EscrowStatus } from "@/lib/db/schema";

const STATUS_CONFIG: Record<
  EscrowStatus,
  { label: string; color: string; icon: React.ElementType; description: string }
> = {
  pending: {
    label: "Awaiting Payment",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
    description:
      "Your payment is being processed. Funds will be held in escrow once confirmed.",
  },
  funded: {
    label: "Payment Held in Escrow",
    color: "bg-blue-100 text-blue-800",
    icon: Shield,
    description:
      "Your payment is safely held in escrow. The seller has been notified to ship your order.",
  },
  in_transit: {
    label: "Shipped — In Transit",
    color: "bg-indigo-100 text-indigo-800",
    icon: Truck,
    description:
      "The seller has shipped your order. Confirm delivery once you receive it to release payment.",
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
    description:
      "You confirmed delivery. Payment has been released to the seller.",
  },
  released: {
    label: "Payment Released",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
    description:
      "Payment has been released to the seller. Thank you for your purchase.",
  },
  disputed: {
    label: "Under Dispute",
    color: "bg-red-100 text-red-800",
    icon: AlertTriangle,
    description:
      "A dispute has been opened. Funds are frozen until an admin resolves it.",
  },
  resolved_buyer: {
    label: "Dispute Resolved — Refunded",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
    description:
      "The dispute was resolved in your favor. Your payment has been refunded.",
  },
  resolved_seller: {
    label: "Dispute Resolved — Released",
    color: "bg-gray-100 text-gray-800",
    icon: CheckCircle2,
    description:
      "The dispute was resolved in the seller's favor. Payment has been released.",
  },
  expired: {
    label: "Auto-Released",
    color: "bg-gray-100 text-gray-800",
    icon: Clock,
    description:
      "The escrow period expired. Payment was automatically released to the seller.",
  },
};

interface EscrowStatusCardProps {
  escrowId: string;
  status: EscrowStatus;
  amount: string;
  currency: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  autoReleaseAt?: string | null;
  platformFeePercent: string;
}

export function EscrowStatusCard({
  escrowId,
  status,
  amount,
  currency,
  trackingNumber,
  trackingCarrier,
  autoReleaseAt,
  platformFeePercent,
}: EscrowStatusCardProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const canConfirmDelivery = status === "in_transit" || status === "funded";
  const canDispute = status === "funded" || status === "in_transit";

  const handleConfirmDelivery = async () => {
    setIsConfirming(true);
    try {
      const result = await buyerConfirmDelivery(escrowId);
      if (result.success) {
        toast.success("Delivery confirmed! Payment released to seller.");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to confirm delivery");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error("Please provide a reason for the dispute");
      return;
    }
    setIsDisputing(true);
    try {
      const result = await openEscrowDispute(
        escrowId,
        disputeReason,
        disputeDescription || undefined
      );
      if (result.success) {
        toast.success("Dispute opened. An admin will review your case.");
        setDisputeOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to open dispute");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsDisputing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="size-5" />
          Escrow Protection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge + Description */}
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${config.color}`}>
            <Icon className="size-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={config.color}>{config.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>

        {/* Amount in Escrow */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount in escrow</span>
            <span className="font-medium">
              {parseFloat(amount).toFixed(2)} {currency.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform fee</span>
            <span>{platformFeePercent}%</span>
          </div>
        </div>

        {/* Tracking Info */}
        {trackingNumber && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Tracking Number</p>
            <p className="font-mono font-medium">{trackingNumber}</p>
            {trackingCarrier && (
              <p className="text-muted-foreground text-xs mt-1">
                via {trackingCarrier}
              </p>
            )}
          </div>
        )}

        {/* Auto-release countdown */}
        {autoReleaseAt && (status === "in_transit" || status === "funded") && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            Auto-releases to seller on{" "}
            {new Date(autoReleaseAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}

        {/* Action Buttons */}
        {(canConfirmDelivery || canDispute) && (
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            {canConfirmDelivery && (
              <Button
                onClick={handleConfirmDelivery}
                disabled={isConfirming}
                className="flex-1"
              >
                {isConfirming ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Confirm Delivery
              </Button>
            )}

            {canDispute && (
              <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <AlertTriangle className="mr-2 size-4" />
                    Open Dispute
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Open a Dispute</DialogTitle>
                    <DialogDescription>
                      Describe the issue with your order. Funds will be frozen
                      until an admin reviews your case.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Field>
                      <FieldLabel>Reason</FieldLabel>
                      <Input
                        placeholder="e.g., Item not as described"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Details (optional)</FieldLabel>
                      <Textarea
                        placeholder="Provide more details about the issue..."
                        value={disputeDescription}
                        onChange={(e) => setDisputeDescription(e.target.value)}
                        rows={4}
                      />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDisputeOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleOpenDispute}
                      disabled={isDisputing || !disputeReason.trim()}
                    >
                      {isDisputing ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="mr-2 size-4" />
                      )}
                      Submit Dispute
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
