"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { processRefund } from "@/lib/actions/orders";

type RefundMethod = "original_payment" | "cash" | "store_credit";

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: "original_payment", label: "Original Payment Method" },
  { value: "cash", label: "Cash" },
  { value: "store_credit", label: "Store Credit" },
];

interface OrderRefundProps {
  orderId: string;
  tenantId: string;
  currency: string;
  orderTotal: string;
  amountPaid: string;
  amountRefunded: string;
  isPaid: boolean;
}

export function OrderRefund({
  orderId,
  tenantId,
  currency,
  orderTotal,
  amountPaid,
  amountRefunded,
  isPaid,
}: OrderRefundProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] =
    useState<RefundMethod>("original_payment");

  const totalNum = parseFloat(orderTotal);
  const paidNum = parseFloat(amountPaid);
  const refundedNum = parseFloat(amountRefunded);

  // Calculate actual paid (handle legacy orders)
  const actualPaid = isPaid && paidNum === 0 ? totalNum : paidNum;
  const refundable = Math.max(0, actualPaid - refundedNum);
  const isFullyRefunded = refundedNum >= actualPaid - 0.01;

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} ${currency}`;
  };

  const handleRefund = () => {
    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    if (refundAmount > refundable + 0.01) {
      toast.error(
        `Refund amount exceeds refundable balance (${formatPrice(refundable)})`
      );
      return;
    }

    startTransition(async () => {
      const result = await processRefund(
        tenantId,
        orderId,
        refundAmount,
        reason.trim(),
        refundMethod
      );

      if (result.success) {
        const isFullRefund = result.data?.newPaymentStatus === "refunded";
        toast.success(
          isFullRefund
            ? "Full refund processed successfully"
            : `Partial refund of ${formatPrice(refundAmount)} processed`
        );
        setDialogOpen(false);
        setAmount("");
        setReason("");
        setRefundMethod("original_payment");
      } else {
        toast.error(result.error?.message || "Failed to process refund");
      }
    });
  };

  const handleFullRefund = () => {
    setAmount(refundable.toFixed(2));
  };

  // Don't show refund button if nothing to refund
  if (refundable <= 0.01 || isFullyRefunded) {
    if (isFullyRefunded) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-200 bg-orange-50"
          >
            Fully Refunded
          </Badge>
          <span>{formatPrice(refundedNum)}</span>
        </div>
      );
    }
    return null;
  }

  // Show partially refunded state if applicable
  const isPartiallyRefunded = refundedNum > 0;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RotateCcw className="size-3.5" />
          {isPartiallyRefunded ? "Refund More" : "Issue Refund"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5" />
            Process Refund
          </DialogTitle>
          <DialogDescription>
            Refund the customer for this order. This action will update the
            order status and payment records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Refund summary */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Total</span>
              <span>{formatPrice(totalNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span>{formatPrice(actualPaid)}</span>
            </div>
            {refundedNum > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Already Refunded</span>
                <span>-{formatPrice(refundedNum)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Refundable Amount</span>
              <span className="text-green-600">{formatPrice(refundable)}</span>
            </div>
          </div>

          {/* Refund amount */}
          <div className="space-y-2">
            <Label htmlFor="refundAmount">Refund Amount</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="refundAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundable}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currency}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFullRefund}
              >
                Full
              </Button>
            </div>
          </div>

          {/* Refund method */}
          <div className="space-y-2">
            <Label>Refund Method</Label>
            <Select
              value={refundMethod}
              onValueChange={(value) => setRefundMethod(value as RefundMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFUND_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Customer requested cancellation, Product defect..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div
              className={cn(
                "rounded-lg p-3 text-sm",
                parseFloat(amount) >= refundable - 0.01
                  ? "bg-orange-50"
                  : "bg-blue-50"
              )}
            >
              {parseFloat(amount) >= refundable - 0.01 ? (
                <div className="flex items-start gap-2 text-orange-700">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Full Refund</p>
                    <p className="text-xs">
                      This will mark the order as fully refunded.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-blue-700">
                  <Check className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Partial Refund</p>
                    <p className="text-xs">
                      {formatPrice(refundable - parseFloat(amount))} will remain
                      refundable after this.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={isPending || !amount}
            variant="destructive"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 size-4" />
                Process Refund
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
