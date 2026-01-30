"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Package, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { useCheckoutTotals } from "@/lib/stores/use-checkout-store";
import type { Cart, CartPriceTier } from "@/lib/db/queries/carts";

/**
 * Get the applicable tier price for a given quantity
 */
function getApplicableTierPrice(
  basePrice: number,
  quantity: number,
  priceTiers: CartPriceTier[]
): number {
  if (!priceTiers || priceTiers.length === 0) return basePrice;

  const sortedTiers = [...priceTiers].sort(
    (a, b) => b.minQuantity - a.minQuantity
  );

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        return parseFloat(tier.price);
      }
    }
  }

  return basePrice;
}

interface CheckoutSummaryProps {
  cart: Cart;
  currency: string;
}

export function CheckoutSummary({ cart, currency }: CheckoutSummaryProps) {
  const { subtotal, shippingTotal, taxTotal, total } = useCheckoutTotals();

  // Calculate total savings from tier pricing
  const totalSavings = useMemo(() => {
    return cart.items.reduce((savings, item) => {
      const basePrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);
      const effectivePrice = getApplicableTierPrice(
        basePrice,
        item.quantity,
        item.product.priceTiers || []
      );
      return savings + (basePrice - effectivePrice) * item.quantity;
    }, 0);
  }, [cart.items]);

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cart.items.map((item) => {
            const basePrice = item.variant?.price
              ? parseFloat(item.variant.price)
              : parseFloat(item.product.price);
            const effectivePrice = getApplicableTierPrice(
              basePrice,
              item.quantity,
              item.product.priceTiers || []
            );
            const hasTierDiscount = effectivePrice < basePrice;

            return (
              <div key={item.id} className="flex gap-3">
                {/* Image - prioritize variant image over product image */}
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.variant?.image?.url || item.product.image?.url ? (
                    <Image
                      src={
                        item.variant?.image?.url ||
                        item.product.image?.url ||
                        ""
                      }
                      alt={
                        item.variant?.image?.altText ||
                        item.product.image?.altText ||
                        item.product.name
                      }
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  {/* Quantity badge */}
                  <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {item.quantity}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">
                    {item.product.name}
                  </p>
                  {item.variant?.displayName && (
                    <p className="text-xs text-muted-foreground">
                      {item.variant.displayName}
                    </p>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {hasTierDiscount ? (
                      <span>
                        <span className="text-green-600">
                          {formatPrice(effectivePrice, currency)}
                        </span>{" "}
                        <span className="line-through text-xs">
                          {formatPrice(basePrice, currency)}
                        </span>{" "}
                        &times; {item.quantity}
                      </span>
                    ) : (
                      <span>
                        {formatPrice(basePrice, currency)} &times;{" "}
                        {item.quantity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="shrink-0 text-sm font-medium">
                  {formatPrice(effectivePrice * item.quantity, currency)}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal, currency)}</span>
          </div>

          {totalSavings > 0 && (
            <div className="flex items-center justify-between text-green-600">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Bulk discounts
              </span>
              <span>-{formatPrice(totalSavings, currency)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>
              {shippingTotal === 0 ? (
                <span className="text-muted-foreground">
                  Calculated at next step
                </span>
              ) : (
                formatPrice(shippingTotal, currency)
              )}
            </span>
          </div>

          {taxTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(taxTotal, currency)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(total, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
