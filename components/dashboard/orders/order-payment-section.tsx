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
import { cn } from "@/lib/utils";
import { recordOrderPayment } from "@/lib/actions/offline-sales";
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

interface OrderPaymentSectionProps {
  orderId: string;
  tenantId: string;
  storeSlug: string;
  currency: string;
  orderTotal: string;
  totalPaid: string;
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
  amountRemaining,
  isPaid,
  payments,
}: OrderPaymentSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

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

  const total = parseFloat(orderTotal);
  // If order is fully paid but no payment records exist (legacy orders or orders without partial payment tracking),
  // assume the full amount was paid
  const hasPaymentRecords = payments.length > 0;
  const paid = isPaid && !hasPaymentRecords ? total : parseFloat(totalPaid);
  const remaining =
    isPaid && !hasPaymentRecords ? 0 : parseFloat(amountRemaining);
  const paidPercentage = total > 0 ? (paid / total) * 100 : isPaid ? 100 : 0;

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
        setDialogOpen(false);
        setAmount("");
        setNotes("");
        setPaymentMethod("cash");
      } else {
        toast.error(result.error?.message || "Failed to record payment");
      }
    });
  };

  const handlePayFullAmount = () => {
    setAmount(remaining.toFixed(2));
  };

  // Determine payment status
  const getPaymentStatus = () => {
    if (isPaid) {
      return {
        label: "Paid",
        variant: "default" as const,
        color: "bg-green-500",
      };
    }
    if (paid > 0) {
      return {
        label: "Partially Paid",
        variant: "secondary" as const,
        color: "bg-amber-500",
      };
    }
    return {
      label: "Unpaid",
      variant: "destructive" as const,
      color: "bg-red-500",
    };
  };

  const status = getPaymentStatus();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Payment</CardTitle>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatPrice(paid)} of {formatPrice(total)}
            </span>
            <span className="font-medium">{Math.round(paidPercentage)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all", status.color)}
              style={{ width: `${Math.min(100, paidPercentage)}%` }}
            />
          </div>
          {!isPaid && (
            <p className="text-sm text-muted-foreground">
              Remaining:{" "}
              <span className="font-medium">{formatPrice(remaining)}</span>
            </p>
          )}
        </div>

        <Separator />

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Payment History</p>
            <div className="space-y-2">
              {payments.map((payment) => {
                const config =
                  PAYMENT_METHOD_CONFIG[payment.paymentMethod as PaymentMethod];
                const Icon = config?.icon || CreditCard;
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full",
                          config?.color || "bg-muted"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {config?.label || payment.paymentMethod}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium">{formatPrice(payment.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Record Payment Button */}
        {!isPaid && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Plus className="size-4 mr-2" />
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
                  onClick={() => setDialogOpen(false)}
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

        {/* Fully Paid Indicator */}
        {isPaid && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
            <Check className="size-5" />
            <span className="font-medium">Fully Paid</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
