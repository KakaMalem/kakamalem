"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adjustOrderShipping } from "@/lib/actions/orders";

interface OrderShippingAdjustmentProps {
  orderId: string;
  tenantId: string;
  currency: string;
  currentShipping: string;
  subtotal: string;
}

export function OrderShippingAdjustment({
  orderId,
  tenantId,
  currency,
  currentShipping,
  subtotal,
}: OrderShippingAdjustmentProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shippingAmount, setShippingAmount] = useState(currentShipping);
  const [reason, setReason] = useState("");

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `${num.toLocaleString()} ${currency}`;
  };

  const currentShippingNum = parseFloat(currentShipping);
  const subtotalNum = parseFloat(subtotal);

  const handleAdjustShipping = () => {
    const amount = parseFloat(shippingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid shipping amount");
      return;
    }

    startTransition(async () => {
      const result = await adjustOrderShipping(
        tenantId,
        orderId,
        amount,
        reason || undefined
      );

      if (result.success) {
        toast.success("Shipping updated successfully");
        setDialogOpen(false);
        setReason("");
      } else {
        toast.error(result.error?.message || "Failed to update shipping");
      }
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Truck className="size-3.5" />
          {currentShippingNum > 0 ? "Edit Shipping" : "Add Shipping"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Shipping Charge</DialogTitle>
          <DialogDescription>
            Change the shipping/delivery charge for this order. The total will
            be recalculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current info summary */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Subtotal</span>
              <span>{formatPrice(subtotalNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Shipping</span>
              <span>{formatPrice(currentShippingNum)}</span>
            </div>
          </div>

          {/* Shipping Amount */}
          <div className="space-y-2">
            <Label htmlFor="shipping">New Shipping Amount</Label>
            <div className="relative">
              <Input
                id="shipping"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
            {currentShippingNum > 0 && (
              <p className="text-xs text-muted-foreground">
                Current shipping: {formatPrice(currentShipping)}
              </p>
            )}
          </div>

          {/* Quick shipping options */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShippingAmount("0")}
            >
              Free Shipping
            </Button>
            {currentShippingNum > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setShippingAmount((currentShippingNum * 0.5).toFixed(2))
                  }
                >
                  50% Off
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShippingAmount(currentShipping)}
                >
                  Keep Current
                </Button>
              </>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Free shipping promotion, Customer complaint..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Preview new total */}
          {shippingAmount && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <div className="flex justify-between text-blue-700">
                <span>New Shipping</span>
                <span className="font-semibold">
                  {parseFloat(shippingAmount || "0") === 0
                    ? "Free"
                    : formatPrice(shippingAmount)}
                </span>
              </div>
              {currentShippingNum > 0 &&
                parseFloat(shippingAmount || "0") < currentShippingNum && (
                  <p className="text-xs text-blue-600 mt-1">
                    Saving{" "}
                    {formatPrice(
                      currentShippingNum - parseFloat(shippingAmount || "0")
                    )}{" "}
                    on shipping
                  </p>
                )}
              {parseFloat(shippingAmount || "0") > currentShippingNum && (
                <p className="text-xs text-blue-600 mt-1">
                  Adding{" "}
                  {formatPrice(
                    parseFloat(shippingAmount || "0") - currentShippingNum
                  )}{" "}
                  to shipping
                </p>
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
          <Button onClick={handleAdjustShipping} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Shipping"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
