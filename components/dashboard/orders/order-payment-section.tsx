"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Check,
  Plus,
  RotateCcw,
  Loader2,
  AlertTriangle,
  ArrowDownLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { recordOrderPayment } from "@/lib/actions/offline-sales";
import { processRefund } from "@/lib/actions/orders";
import {
  computePaymentStatus,
  PAYMENT_STATUS_CONFIG,
  type ComputedPaymentStatus,
} from "@/lib/utils/payment-status";
import type { OrderPaymentRecord } from "@/lib/db/queries/orders";
import type { PaymentMethod } from "@/lib/validations/offline-sales";

const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "mobile_money",
  "bank_transfer",
];

const PAYMENT_METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; icon: typeof CreditCard; color: string }
> = {
  cash: { label: "Cash", icon: Banknote, color: "bg-green-100 text-green-700" },
  card: { label: "Card", icon: CreditCard, color: "bg-blue-100 text-blue-700" },
  mobile_money: {
    label: "Mobile Money",
    icon: Smartphone,
    color: "bg-purple-100 text-purple-700",
  },
  bank_transfer: {
    label: "Bank Transfer",
    icon: Building2,
    color: "bg-orange-100 text-orange-700",
  },
};

type RefundMethod = "original_payment" | "cash" | "store_credit";

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: "original_payment", label: "Original Payment Method" },
  { value: "cash", label: "Cash" },
  { value: "store_credit", label: "Store Credit" },
];

interface OrderPaymentSectionProps {
  orderId: string;
  tenantId: string;
  storeSlug: string;
  currency: string;
  orderTotal: string;
  totalPaid: string;
  amountRefunded: string;
  amountRemaining: string;
  isPaid: boolean;
  payments: OrderPaymentRecord[];
}

export function OrderPaymentSection({
  orderId,
  tenantId,
  storeSlug,
  currency,
  orderTotal,
  totalPaid,
  amountRefunded,
  amountRemaining,
  payments,
}: OrderPaymentSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] =
    useState<RefundMethod>("original_payment");

  // Calculate values early so we can use them in handlers
  const remaining = parseFloat(amountRemaining);
  const paymentInfo = computePaymentStatus({
    total: orderTotal,
    amountPaid: totalPaid,
    amountRefunded: amountRefunded,
  });
  const paid = paymentInfo.amountPaid;
  const refunded = paymentInfo.amountRefunded;
  const refundable = Math.max(0, paid - refunded);

  // Handle dialog open/close with default values
  const handlePaymentDialogChange = (open: boolean) => {
    if (open && remaining > 0) {
      setAmount(remaining.toFixed(2));
    }
    if (!open) {
      setAmount("");
      setNotes("");
      setPaymentMethod("cash");
    }
    setPaymentDialogOpen(open);
  };

  const handleRefundDialogChange = (open: boolean) => {
    if (open && refundable > 0) {
      setRefundAmount(refundable.toFixed(2));
    }
    if (!open) {
      setRefundAmount("");
      setRefundReason("");
      setRefundMethod("original_payment");
    }
    setRefundDialogOpen(open);
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `${num.toLocaleString()} ${currency}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const total = paymentInfo.total;

  // Handle overpayment scenario
  const hasOverpayment = paid > total && total > 0;
  const creditAmount = hasOverpayment ? paid - total : 0;

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (total === 0) return paymentInfo.isPaid ? 100 : 0;
    if (paymentInfo.isFullyRefunded) return 0;
    const netPaid = paid - refunded;
    return Math.min((netPaid / total) * 100, 100);
  };

  const progressPercentage = getProgressPercentage();

  // Get status display config
  const getStatusConfig = (): {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    progressColor: string;
  } => {
    if (hasOverpayment) {
      return {
        label: "Overpaid",
        variant: "default",
        progressColor: "bg-blue-500",
      };
    }

    const config = PAYMENT_STATUS_CONFIG[paymentInfo.status];
    const variantMap: Record<
      ComputedPaymentStatus,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      paid: "default",
      unpaid: "destructive",
      partial: "secondary",
      partial_refund: "outline",
      refunded: "outline",
    };

    const progressColorMap: Record<ComputedPaymentStatus, string> = {
      paid: "bg-green-500",
      unpaid: "bg-red-500",
      partial: "bg-amber-500",
      partial_refund: "bg-orange-500",
      refunded: "bg-red-500",
    };

    return {
      label: config.label,
      variant: variantMap[paymentInfo.status],
      progressColor: progressColorMap[paymentInfo.status],
    };
  };

  const statusConfig = getStatusConfig();

  const handleRecordPayment = () => {
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (paymentAmount > remaining + 0.01) {
      toast.error(
        `Amount exceeds remaining balance (${formatPrice(remaining)})`
      );
      return;
    }

    startTransition(async () => {
      const result = await recordOrderPayment(tenantId, storeSlug, {
        orderId,
        amount: paymentAmount,
        paymentMethod,
        notes: notes || null,
      });

      if (result.success) {
        toast.success(
          result.payment?.isFullyPaid
            ? "Payment recorded. Order is now fully paid!"
            : "Payment recorded successfully"
        );
        handlePaymentDialogChange(false);
      } else {
        toast.error(result.error?.message || "Failed to record payment");
      }
    });
  };

  const handleRefund = () => {
    const refundAmountNum = parseFloat(refundAmount);
    if (isNaN(refundAmountNum) || refundAmountNum <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    if (refundAmountNum > refundable + 0.01) {
      toast.error(
        `Refund amount exceeds refundable balance (${formatPrice(refundable)})`
      );
      return;
    }

    startTransition(async () => {
      const result = await processRefund(
        tenantId,
        orderId,
        refundAmountNum,
        refundReason.trim(),
        refundMethod
      );

      if (result.success) {
        const isFullRefund = result.data?.newPaymentStatus === "refunded";
        toast.success(
          isFullRefund
            ? "Full refund processed successfully"
            : `Partial refund of ${formatPrice(refundAmountNum)} processed`
        );
        handleRefundDialogChange(false);
      } else {
        toast.error(result.error?.message || "Failed to process refund");
      }
    });
  };

  const handlePayFullAmount = () => {
    setAmount(remaining.toFixed(2));
  };

  const handleFullRefund = () => {
    setRefundAmount(refundable.toFixed(2));
  };

  // Check if we can take actions
  const canRecordPayment = !paymentInfo.isPaid && remaining > 0.01;
  const canRefund = refundable > 0.01;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Payment</CardTitle>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Financial Summary */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Total</span>
            <span className="font-medium">{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-green-600">+{formatPrice(paid)}</span>
          </div>
          {refunded > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refunded</span>
              <span className="text-orange-600">-{formatPrice(refunded)}</span>
            </div>
          )}
          {!paymentInfo.isFullyRefunded && remaining > 0.01 && (
            <div className="flex justify-between pt-1 border-t">
              <span className="font-medium">Balance Due</span>
              <span className="font-medium text-amber-600">
                {formatPrice(remaining)}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {!paymentInfo.isFullyRefunded && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  statusConfig.progressColor
                )}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Overpayment Notice */}
        {hasOverpayment && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <CreditCard className="size-4" />
            <span>
              Credit due to customer:{" "}
              <span className="font-semibold">{formatPrice(creditAmount)}</span>
            </span>
          </div>
        )}

        {/* Fully Refunded Notice */}
        {paymentInfo.isFullyRefunded && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-orange-50 p-3 text-orange-700">
            <RotateCcw className="size-5" />
            <span className="font-medium">Fully Refunded</span>
          </div>
        )}

        {/* Fully Paid Indicator (when no refunds) */}
        {paymentInfo.isPaid && !paymentInfo.hasRefund && !hasOverpayment && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
            <Check className="size-5" />
            <span className="font-medium">Fully Paid</span>
          </div>
        )}

        <Separator />

        {/* Transaction History */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Transaction History</p>
            <div className="space-y-2">
              {payments.map((payment) => {
                const isRefund = parseFloat(payment.amount) < 0;
                const config =
                  PAYMENT_METHOD_CONFIG[payment.paymentMethod as PaymentMethod];
                const Icon = isRefund
                  ? ArrowDownLeft
                  : config?.icon || CreditCard;
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full",
                          isRefund
                            ? "bg-orange-100 text-orange-700"
                            : config?.color || "bg-muted"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {isRefund
                            ? "Refund"
                            : config?.label || payment.paymentMethod}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "font-medium",
                        isRefund ? "text-orange-600" : "text-green-600"
                      )}
                    >
                      {isRefund ? "" : "+"}
                      {formatPrice(payment.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(canRecordPayment || canRefund) && (
          <div className="flex gap-2">
            {/* Record Payment Dialog */}
            {canRecordPayment && (
              <Dialog
                open={paymentDialogOpen}
                onOpenChange={handlePaymentDialogChange}
              >
                <DialogTrigger asChild>
                  <Button className="flex-1" variant="outline" size="sm">
                    <Plus className="size-4 mr-1.5" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                      Record a payment for this order. Remaining balance:{" "}
                      {formatPrice(remaining)}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remaining}
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePayFullAmount}
                        >
                          Full
                        </Button>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.map((method) => {
                          const config = PAYMENT_METHOD_CONFIG[method];
                          const Icon = config.icon;
                          const isSelected = paymentMethod === method;
                          return (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPaymentMethod(method)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              {isSelected && (
                                <Check className="size-4 text-primary" />
                              )}
                              <Icon
                                className={cn(
                                  "size-4",
                                  isSelected
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              />
                              <span className="text-sm font-medium">
                                {config.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add a note about this payment..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => handlePaymentDialogChange(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleRecordPayment} disabled={isPending}>
                      {isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Issue Refund Dialog */}
            {canRefund && (
              <Dialog
                open={refundDialogOpen}
                onOpenChange={handleRefundDialogChange}
              >
                <DialogTrigger asChild>
                  <Button className="flex-1" variant="outline" size="sm">
                    <RotateCcw className="size-4 mr-1.5" />
                    {paymentInfo.isPartiallyRefunded ? "Refund More" : "Refund"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <RotateCcw className="size-5" />
                      Process Refund
                    </DialogTitle>
                    <DialogDescription>
                      Refund the customer for this order. This action will
                      update the order status and payment records.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Refund summary */}
                    <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Order Total
                        </span>
                        <span>{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Amount Paid
                        </span>
                        <span>{formatPrice(paid)}</span>
                      </div>
                      {refunded > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Already Refunded</span>
                          <span>-{formatPrice(refunded)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-1 font-medium">
                        <span>Refundable Amount</span>
                        <span className="text-green-600">
                          {formatPrice(refundable)}
                        </span>
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
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
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
                        onValueChange={(value) =>
                          setRefundMethod(value as RefundMethod)
                        }
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

                    {/* Reason */}
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason</Label>
                      <Textarea
                        id="reason"
                        placeholder="e.g., Customer requested cancellation, Product defect..."
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    {/* Preview */}
                    {refundAmount && parseFloat(refundAmount) > 0 && (
                      <div
                        className={cn(
                          "rounded-lg p-3 text-sm",
                          parseFloat(refundAmount) >= refundable - 0.01
                            ? "bg-orange-50"
                            : "bg-blue-50"
                        )}
                      >
                        {parseFloat(refundAmount) >= refundable - 0.01 ? (
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
                                {formatPrice(
                                  refundable - parseFloat(refundAmount)
                                )}{" "}
                                will remain refundable after this.
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
                      onClick={() => handleRefundDialogChange(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRefund}
                      disabled={isPending || !refundAmount}
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
