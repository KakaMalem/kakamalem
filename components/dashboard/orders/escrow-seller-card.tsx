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
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { sellerMarkShipped } from "@/lib/actions/escrow";
import type { EscrowStatus } from "@/lib/db/schema";

const STATUS_CONFIG: Record<
  EscrowStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Awaiting Payment",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  funded: {
    label: "Payment Received",
    color: "bg-blue-100 text-blue-800",
    icon: Shield,
  },
  in_transit: {
    label: "Shipped",
    color: "bg-indigo-100 text-indigo-800",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  released: {
    label: "Payment Released",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-100 text-red-800",
    icon: AlertTriangle,
  },
  resolved_buyer: {
    label: "Refunded to Buyer",
    color: "bg-red-50 text-red-700",
    icon: AlertTriangle,
  },
  resolved_seller: {
    label: "Released to You",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  expired: {
    label: "Auto-Released",
    color: "bg-gray-100 text-gray-800",
    icon: Clock,
  },
};

interface EscrowSellerCardProps {
  escrowId: string;
  status: EscrowStatus;
  amount: string;
  currency: string;
  platformFeePercent: string;
  sellerPayout: string | null;
  platformFee: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  autoReleaseAt: string | null;
  fundedAt: string | null;
  releasedAt: string | null;
}

export function EscrowSellerCard({
  escrowId,
  status,
  amount,
  currency,
  platformFeePercent,
  sellerPayout,
  platformFee,
  trackingNumber: existingTracking,
  trackingCarrier: existingCarrier,
  autoReleaseAt,
  fundedAt,
  releasedAt,
}: EscrowSellerCardProps) {
  const router = useRouter();
  const [isShipping, setIsShipping] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const canMarkShipped = status === "funded";

  // Calculate estimated payout
  const amt = parseFloat(amount);
  const feePercent = parseFloat(platformFeePercent);
  const estimatedFee = amt * (feePercent / 100);
  const estimatedPayout = amt - estimatedFee;

  const handleMarkShipped = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }
    setIsShipping(true);
    try {
      const result = await sellerMarkShipped(
        escrowId,
        trackingNumber,
        trackingCarrier || undefined
      );
      if (result.success) {
        toast.success("Marked as shipped! Buyer has been notified.");
        setShipDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to mark as shipped");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsShipping(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Escrow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge className={config.color}>
            <Icon className="mr-1 size-3" />
            {config.label}
          </Badge>
        </div>

        {/* Financial Summary */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Escrow amount</span>
            <span className="font-medium">
              {amt.toFixed(2)} {currency.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Platform fee ({platformFeePercent}%)
            </span>
            <span className="text-red-600">
              -
              {platformFee
                ? parseFloat(platformFee).toFixed(2)
                : estimatedFee.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between font-medium border-t pt-1 mt-1">
            <span>Your payout</span>
            <span className="text-green-600">
              {sellerPayout
                ? parseFloat(sellerPayout).toFixed(2)
                : estimatedPayout.toFixed(2)}{" "}
              {currency.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Tracking Info (if shipped) */}
        {existingTracking && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Tracking</p>
            <p className="font-mono font-medium">{existingTracking}</p>
            {existingCarrier && (
              <p className="text-muted-foreground text-xs">{existingCarrier}</p>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="text-xs text-muted-foreground space-y-1">
          {fundedAt && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-green-500" />
              Payment received {new Date(fundedAt).toLocaleDateString()}
            </div>
          )}
          {autoReleaseAt && status === "in_transit" && (
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              Auto-releases{" "}
              {new Date(autoReleaseAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
          {releasedAt && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-green-500" />
              Released {new Date(releasedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Mark Shipped Button */}
        {canMarkShipped && (
          <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Truck className="mr-2 size-4" />
                Mark as Shipped
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ship Order</DialogTitle>
                <DialogDescription>
                  Enter the tracking details. The buyer will be notified and has
                  30 days to confirm delivery before funds auto-release.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field>
                  <FieldLabel>Tracking Number</FieldLabel>
                  <Input
                    placeholder="e.g., 1Z999AA10123456784"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Carrier (optional)</FieldLabel>
                  <Input
                    placeholder="e.g., DHL, FedEx, China Post"
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShipDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMarkShipped}
                  disabled={isShipping || !trackingNumber.trim()}
                >
                  {isShipping ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 size-4" />
                  )}
                  Confirm Shipment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
