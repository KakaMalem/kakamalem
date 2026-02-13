"use client";

import { useMemo, useEffect } from "react";
import Image from "next/image";
import { Package, Tag, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  useCheckoutTotals,
  useCheckoutStore,
} from "@/lib/stores/use-checkout-store";
import {
  useCartCampaignDiscounts,
  calculateDiscountedPrice,
} from "@/lib/hooks/use-campaign-discounts";
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
  tenantId?: string;
}

export function CheckoutSummary({
  cart,
  currency: _currency,
  tenantId,
}: CheckoutSummaryProps) {
  const { format: formatPrice } = useCurrencyStore();
  const { subtotal, shippingTotal, taxTotal, total } = useCheckoutTotals();
  const updateTotals = useCheckoutStore((s) => s.updateTotals);

  // Fetch campaign discounts
  const { discountsMap } = useCartCampaignDiscounts(
    tenantId || null,
    cart.items
  );

  // Calculate totals with both campaign and tier discounts
  const { originalSubtotal, campaignSavings, tierSavings } = useMemo(() => {
    let originalSubtotal = 0;
    let campaignSavings = 0;
    let tierSavings = 0;

    for (const item of cart.items) {
      const originalPrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);

      originalSubtotal += originalPrice * item.quantity;

      // Apply campaign discount
      const campaignDiscount = discountsMap.get(item.product.id);
      const afterCampaignPrice = calculateDiscountedPrice(
        originalPrice,
        campaignDiscount || null
      );

      if (campaignDiscount && afterCampaignPrice < originalPrice) {
        campaignSavings += (originalPrice - afterCampaignPrice) * item.quantity;
      }

      // Apply tier discount (on top of campaign price)
      const effectivePrice = getApplicableTierPrice(
        afterCampaignPrice,
        item.quantity,
        item.product.priceTiers || []
      );

      if (effectivePrice < afterCampaignPrice) {
        tierSavings += (afterCampaignPrice - effectivePrice) * item.quantity;
      }
    }

    return { originalSubtotal, campaignSavings, tierSavings };
  }, [cart.items, discountsMap]);

  const totalSavings = campaignSavings + tierSavings;
  const effectiveSubtotal = originalSubtotal - totalSavings;

  // Sync the effective (discounted) subtotal to the checkout store
  // so that the total displayed everywhere (including mobile summary) is correct
  useEffect(() => {
    if (effectiveSubtotal > 0 && effectiveSubtotal !== subtotal) {
      updateTotals(effectiveSubtotal);
    }
  }, [effectiveSubtotal, subtotal, updateTotals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cart.items.map((item) => {
            const originalPrice = item.variant?.price
              ? parseFloat(item.variant.price)
              : parseFloat(item.product.price);

            // Apply campaign discount first
            const campaignDiscount = discountsMap.get(item.product.id);
            const afterCampaignPrice = calculateDiscountedPrice(
              originalPrice,
              campaignDiscount || null
            );

            // Then apply tier discount
            const effectivePrice = getApplicableTierPrice(
              afterCampaignPrice,
              item.quantity,
              item.product.priceTiers || []
            );

            const hasDiscount = effectivePrice < originalPrice;

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
                    {hasDiscount ? (
                      <span>
                        <span className="text-green-600">
                          {formatPrice(effectivePrice)}
                        </span>{" "}
                        <span className="line-through text-xs">
                          {formatPrice(originalPrice)}
                        </span>{" "}
                        &times; {item.quantity}
                      </span>
                    ) : (
                      <span>
                        {formatPrice(originalPrice)} &times; {item.quantity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="shrink-0 text-sm font-medium">
                  {formatPrice(effectivePrice * item.quantity)}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Subtotal</span>
            <span className="text-right">
              {totalSavings > 0 ? (
                <span className="flex items-baseline gap-1.5 justify-end flex-wrap">
                  <span className="line-through text-muted-foreground text-xs">
                    {formatPrice(originalSubtotal)}
                  </span>
                  <span>{formatPrice(effectiveSubtotal)}</span>
                </span>
              ) : (
                formatPrice(subtotal)
              )}
            </span>
          </div>

          {campaignSavings > 0 && (
            <div className="flex items-center justify-between gap-2 text-red-600">
              <span className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Sale discounts</span>
              </span>
              <span className="shrink-0">-{formatPrice(campaignSavings)}</span>
            </div>
          )}

          {tierSavings > 0 && (
            <div className="flex items-center justify-between gap-2 text-green-600">
              <span className="flex items-center gap-1.5 min-w-0">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Bulk discounts</span>
              </span>
              <span className="shrink-0">-{formatPrice(tierSavings)}</span>
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
                formatPrice(shippingTotal)
              )}
            </span>
          </div>

          {taxTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(taxTotal)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
