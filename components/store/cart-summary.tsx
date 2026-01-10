"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import {
  useCartSubtotal,
  useCartItemCount,
  useCartItems,
  getApplicableTierPrice,
} from "@/lib/stores/use-cart-store";

interface CartSummaryProps {
  storeSlug: string;
  currency: string;
}

export function CartSummary({ storeSlug, currency }: CartSummaryProps) {
  const subtotal = useCartSubtotal();
  const itemCount = useCartItemCount();
  const items = useCartItems();

  // Calculate total savings from tier pricing
  const totalSavings = useMemo(() => {
    return items.reduce((savings, item) => {
      const basePrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);
      const effectivePrice = getApplicableTierPrice(
        basePrice,
        item.quantity,
        item.product.priceTiers || []
      );
      const itemSavings = (basePrice - effectivePrice) * item.quantity;
      return savings + itemSavings;
    }, 0);
  }, [items]);

  // Future: These could be calculated based on store settings
  const shipping = 0; // Free shipping or calculated at checkout
  const tax = 0; // Calculated at checkout

  const total = subtotal + shipping + tax;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Order Summary</h2>

      <div className="mt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>

        {totalSavings > 0 && (
          <div className="flex items-center justify-between text-sm text-green-600">
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Bulk discounts
            </span>
            <span>-{formatPrice(totalSavings, currency)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span className="text-muted-foreground">Calculated at checkout</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span className="text-muted-foreground">Calculated at checkout</span>
        </div>

        <Separator />

        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(total, currency)}</span>
        </div>
      </div>

      <Button
        size="lg"
        className="mt-6 w-full"
        asChild
        disabled={itemCount === 0}
      >
        <Link href={`/store/${storeSlug}/checkout`}>
          Proceed to Checkout
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>

      {/* Trust Badges */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        <span>Secure checkout</span>
      </div>
    </div>
  );
}
