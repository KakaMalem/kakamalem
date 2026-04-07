"use client";

import { useState, useTransition, useMemo } from "react";
import { AlertCircle, Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils";
import {
  createRefundRequest,
  type CreateRefundInput,
} from "@/lib/actions/refunds";
import type { RefundReason } from "@/lib/db/schema";

interface RefundableItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  quantityRefunded: number;
  price: string;
  subtotal: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  items: RefundableItem[];
  amountPaid: number;
  amountRefunded: number;
  onRefundCreated?: () => void;
}

type RefundItemState = {
  orderItemId: string;
  selected: boolean;
  quantity: number;
  unitRefundAmount: number;
  maxQuantity: number;
  maxUnitAmount: number;
};

const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: "customer_request", label: "Customer Request" },
  { value: "defective", label: "Defective / Damaged Product" },
  { value: "wrong_item", label: "Wrong Item Shipped" },
  { value: "not_as_described", label: "Not as Described" },
  { value: "arrived_late", label: "Arrived Late" },
  { value: "duplicate_order", label: "Duplicate Order" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

const REFUND_METHODS = [
  { value: "original_payment", label: "Original Payment Method" },
  { value: "store_credit", label: "Store Credit" },
  { value: "cash", label: "Cash" },
];

export function RefundDialog({
  open,
  onOpenChange,
  tenantId,
  orderId,
  orderNumber,
  currency,
  items,
  amountPaid,
  amountRefunded,
  onRefundCreated,
}: RefundDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Initialize refund items state
  const [refundItems, setRefundItems] = useState<RefundItemState[]>(() =>
    items.map((item) => ({
      orderItemId: item.id,
      selected: false,
      quantity: 0,
      unitRefundAmount: parseFloat(item.price),
      maxQuantity: item.quantity - (item.quantityRefunded || 0),
      maxUnitAmount: parseFloat(item.price),
    }))
  );

  const [reasonCode, setReasonCode] =
    useState<RefundReason>("customer_request");
  const [reasonDetails, setReasonDetails] = useState("");
  const [refundMethod, setRefundMethod] = useState<
    "original_payment" | "cash" | "store_credit" | "exchange"
  >("original_payment");
  const [customerNotes, setCustomerNotes] = useState("");

  // Calculate totals
  const subtotal = useMemo(() => {
    return refundItems
      .filter((item) => item.selected && item.quantity > 0)
      .reduce((sum, item) => sum + item.quantity * item.unitRefundAmount, 0);
  }, [refundItems]);

  const availableForRefund = amountPaid - amountRefunded;
  const isValidAmount = subtotal > 0 && subtotal <= availableForRefund;

  const toggleItem = (index: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              selected: !item.selected,
              quantity: !item.selected ? item.maxQuantity : 0,
            }
          : item
      )
    );
  };

  const updateQuantity = (index: number, change: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const newQty = Math.max(
          0,
          Math.min(item.maxQuantity, item.quantity + change)
        );
        return {
          ...item,
          quantity: newQty,
          selected: newQty > 0,
        };
      })
    );
  };

  const updateUnitAmount = (index: number, value: string) => {
    const amount = parseFloat(value) || 0;
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              unitRefundAmount: Math.max(
                0,
                Math.min(item.maxUnitAmount, amount)
              ),
            }
          : item
      )
    );
  };

  const handleSubmit = () => {
    if (!isValidAmount) {
      toast.error("Invalid refund amount");
      return;
    }

    const selectedItems = refundItems
      .filter((item) => item.selected && item.quantity > 0)
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        unitRefundAmount: item.unitRefundAmount,
      }));

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to refund");
      return;
    }

    startTransition(async () => {
      const input: CreateRefundInput = {
        orderId,
        type: subtotal >= availableForRefund ? "full" : "partial",
        reasonCode,
        reasonDetails: reasonDetails || undefined,
        refundMethod,
        items: selectedItems,
        customerNotes: customerNotes || undefined,
      };

      const result = await createRefundRequest(tenantId, input);

      if (result.success) {
        toast.success("Refund request created", {
          description: `Refund #${result.refundId?.slice(0, 8)} is pending approval`,
        });
        onOpenChange(false);
        onRefundCreated?.();
      } else {
        toast.error("Failed to create refund", {
          description: result.error,
        });
      }
    });
  };

  const getItemById = (id: string) => items.find((item) => item.id === id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5" />
            Create Refund - Order #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            Select items to refund and specify the refund amount for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Available for refund */}
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              Available for refund: {formatPrice(availableForRefund, currency)}
              {amountRefunded > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({formatPrice(amountRefunded, currency)} already refunded)
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Items */}
          <div className="space-y-3">
            <Label>Select Items to Refund</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border p-2">
              {refundItems.map((refundItem, index) => {
                const item = getItemById(refundItem.orderItemId);
                if (!item || refundItem.maxQuantity <= 0) return null;

                return (
                  <div
                    key={refundItem.orderItemId}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      refundItem.selected ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <Checkbox
                      checked={refundItem.selected}
                      onCheckedChange={() => toggleItem(index)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.productName}</p>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(parseFloat(item.price), currency)} ×{" "}
                        {item.quantity}
                        {item.quantityRefunded > 0 && (
                          <span className="ml-1">
                            ({item.quantityRefunded} already refunded)
                          </span>
                        )}
                      </p>
                    </div>

                    {refundItem.selected && (
                      <div className="flex items-center gap-4">
                        {/* Quantity selector */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() => updateQuantity(index, -1)}
                            disabled={refundItem.quantity <= 1}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">
                            {refundItem.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() => updateQuantity(index, 1)}
                            disabled={
                              refundItem.quantity >= refundItem.maxQuantity
                            }
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>

                        {/* Unit amount */}
                        <div className="w-24">
                          <Input
                            type="number"
                            value={refundItem.unitRefundAmount}
                            onChange={(e) =>
                              updateUnitAmount(index, e.target.value)
                            }
                            min={0}
                            max={refundItem.maxUnitAmount}
                            step={0.01}
                            className="h-8 text-sm"
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refund details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={reasonCode}
                onValueChange={(v) => setReasonCode(v as RefundReason)}
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Refund Method</Label>
              <Select
                value={refundMethod}
                onValueChange={(v) =>
                  setRefundMethod(
                    v as
                      | "original_payment"
                      | "cash"
                      | "store_credit"
                      | "exchange"
                  )
                }
              >
                <SelectTrigger id="method">
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
          </div>

          {/* Reason details */}
          <div className="space-y-2">
            <Label htmlFor="details">Additional Details (optional)</Label>
            <Textarea
              id="details"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Provide more context about the refund..."
              rows={2}
            />
          </div>

          {/* Customer notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Customer Notes (optional)</Label>
            <Textarea
              id="notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Notes visible to the customer..."
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Refund Total</span>
              <span
                className={
                  !isValidAmount && subtotal > 0 ? "text-destructive" : ""
                }
              >
                {formatPrice(subtotal, currency)}
              </span>
            </div>
            {subtotal > availableForRefund && (
              <p className="mt-1 text-sm text-destructive">
                Exceeds available refund amount
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !isValidAmount}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Refund Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
