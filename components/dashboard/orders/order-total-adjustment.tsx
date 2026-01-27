"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { adjustOrderTotal } from "@/lib/actions/orders";

interface OrderTotalAdjustmentProps {
  orderId: string;
  tenantId: string;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  currentTotal: string;
}

export function OrderTotalAdjustment({
  orderId,
  tenantId,
  currency,
  subtotal,
  shippingTotal,
  taxTotal,
  discountTotal,
  currentTotal,
}: OrderTotalAdjustmentProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [newTotal, setNewTotal] = useState(currentTotal);
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotalNum = parseFloat(subtotal);
  const shippingNum = parseFloat(shippingTotal);
  const taxNum = parseFloat(taxTotal);
  const originalTotal = subtotalNum + shippingNum + taxNum;
  const currentTotalNum = parseFloat(currentTotal);
  const currentDiscountNum = parseFloat(discountTotal);

  // Handle popover open state change
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Reset state when popover opens
      setNewTotal(currentTotal);
      setReason("");
      // Focus the input after a short delay to allow popover to open
      setTimeout(() => inputRef.current?.select(), 100);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `${num.toLocaleString()} ${currency}`;
  };

  const handleSave = () => {
    const newTotalNum = parseFloat(newTotal);
    if (isNaN(newTotalNum) || newTotalNum < 0) {
      toast.error("Please enter a valid total amount");
      return;
    }

    if (newTotalNum > originalTotal) {
      toast.error(`Total cannot exceed ${formatPrice(originalTotal)}`);
      return;
    }

    startTransition(async () => {
      const result = await adjustOrderTotal(
        tenantId,
        orderId,
        newTotalNum,
        reason || undefined
      );

      if (result.success) {
        const discountApplied = originalTotal - newTotalNum;
        if (discountApplied > 0) {
          toast.success(
            `Total updated. ${formatPrice(discountApplied)} discount applied.`
          );
        } else {
          toast.success("Total updated successfully");
        }
        setIsOpen(false);
      } else {
        toast.error(result.error?.message || "Failed to update total");
      }
    });
  };

  // Calculate preview discount
  const previewTotalNum = parseFloat(newTotal) || 0;
  const previewDiscount = Math.max(0, originalTotal - previewTotalNum);
  const hasDiscount = previewDiscount > 0;
  const discountChanged = previewDiscount !== currentDiscountNum;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto p-1 gap-1 font-semibold text-lg hover:bg-muted",
            currentDiscountNum > 0 && "text-green-600"
          )}
        >
          {formatPrice(currentTotal)}
          <Pencil className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium">Adjust Order Total</h4>
            <p className="text-sm text-muted-foreground">
              Change the total and discount will be calculated automatically.
            </p>
          </div>

          {/* Original breakdown */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotalNum)}</span>
            </div>
            {shippingNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatPrice(shippingNum)}</span>
              </div>
            )}
            {taxNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(taxNum)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Original Total</span>
              <span>{formatPrice(originalTotal)}</span>
            </div>
            {currentDiscountNum > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Current Discount</span>
                <span>-{formatPrice(currentDiscountNum)}</span>
              </div>
            )}
          </div>

          {/* New total input */}
          <div className="space-y-2">
            <Label htmlFor="newTotal">New Total</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="newTotal"
                type="number"
                step="0.01"
                min="0"
                max={originalTotal}
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          {/* Quick adjustment buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewTotal(originalTotal.toFixed(2))}
              disabled={isPending}
            >
              Full Price
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewTotal((originalTotal * 0.9).toFixed(2))}
              disabled={isPending}
            >
              10% Off
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewTotal((originalTotal * 0.8).toFixed(2))}
              disabled={isPending}
            >
              20% Off
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewTotal((originalTotal * 0.5).toFixed(2))}
              disabled={isPending}
            >
              50% Off
            </Button>
          </div>

          {/* Preview discount */}
          {hasDiscount && discountChanged && (
            <div className="rounded-lg bg-green-50 p-3 text-sm">
              <div className="flex justify-between text-green-700">
                <span>New Discount</span>
                <span className="font-semibold">
                  -{formatPrice(previewDiscount)}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                {((previewDiscount / originalTotal) * 100).toFixed(0)}% off
                original price
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Loyalty discount, Price match..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              <X className="size-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || parseFloat(newTotal) === currentTotalNum}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
