"use client";

import { useState, useTransition } from "react";
import { Tag, X, Loader2, Percent, Truck } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { useAppliedCoupon } from "@/lib/stores/use-checkout-store";
import { validateCouponAction } from "@/lib/actions/coupons";
import type { CartItemForCoupon } from "@/lib/validations/coupons";

interface PromoCodeInputProps {
  tenantId: string;
  subtotal: number;
  cartItems: CartItemForCoupon[];
  customerId?: string | null;
  currency: string;
}

export function PromoCodeInput({
  tenantId,
  subtotal,
  cartItems,
  customerId,
  currency,
}: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const { appliedCoupon, discountTotal, applyCoupon, removeCoupon } =
    useAppliedCoupon();

  const handleApply = () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast.error("Please enter a promo code");
      return;
    }

    startTransition(async () => {
      const result = await validateCouponAction(
        tenantId,
        trimmedCode,
        subtotal,
        cartItems,
        customerId
      );

      if (!result.valid) {
        toast.error(result.error.message);
        return;
      }

      applyCoupon({
        id: result.coupon.id,
        code: result.coupon.code,
        name: result.coupon.name,
        type: result.coupon.type,
        discountAmount: result.discountAmount,
      });

      toast.success("Promo code applied!");
      setCode("");
    });
  };

  const handleRemove = () => {
    removeCoupon();
    toast.success("Promo code removed");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  // Show applied coupon state
  if (appliedCoupon) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-green-100">
              {appliedCoupon.type === "free_shipping" ? (
                <Truck className="size-4 text-green-600" />
              ) : (
                <Percent className="size-4 text-green-600" />
              )}
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-green-800">
                {appliedCoupon.code}
              </p>
              <p className="text-xs text-green-600">
                {appliedCoupon.type === "free_shipping"
                  ? "Free shipping"
                  : appliedCoupon.type === "percentage"
                    ? `${appliedCoupon.name}`
                    : `${formatPrice(discountTotal, currency)} off`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="size-8 p-0 text-green-700 hover:bg-green-100 hover:text-green-900"
          >
            <X className="size-4" />
            <span className="sr-only">Remove promo code</span>
          </Button>
        </div>
      </div>
    );
  }

  // Show input state
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Tag className="size-4" />
        <span>Have a promo code?</span>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Enter code"
          disabled={isPending}
          className="font-mono uppercase"
          maxLength={50}
        />
        <Button
          onClick={handleApply}
          disabled={isPending || !code.trim()}
          variant="outline"
          className="shrink-0"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
    </div>
  );
}
