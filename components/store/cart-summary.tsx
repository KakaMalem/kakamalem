"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Tag, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  useCartItemCount,
  useCartItems,
  getApplicableTierPrice,
} from "@/lib/stores/use-cart-store";
import {
  useCartCampaignDiscounts,
  calculateDiscountedPrice,
} from "@/lib/hooks/use-campaign-discounts";

interface CartSummaryProps {
  storeSlug: string;
  currency: string;
  checkoutEnabled?: boolean;
  contactPhone?: string | null;
  tenantId?: string;
}

export function CartSummary({
  storeSlug,
  currency: _currency,
  checkoutEnabled = true,
  contactPhone,
  tenantId,
}: CartSummaryProps) {
  const { format: formatPrice } = useCurrencyStore();
  const itemCount = useCartItemCount();
  const items = useCartItems();

  // Fetch campaign discounts
  const { discountsMap } = useCartCampaignDiscounts(tenantId || null, items);

  // Calculate totals with both campaign and tier discounts
  const { originalSubtotal, campaignSavings, tierSavings, finalSubtotal } =
    useMemo(() => {
      let originalSubtotal = 0;
      let campaignSavings = 0;
      let tierSavings = 0;
      let finalSubtotal = 0;

      for (const item of items) {
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
          campaignSavings +=
            (originalPrice - afterCampaignPrice) * item.quantity;
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

        finalSubtotal += effectivePrice * item.quantity;
      }

      return { originalSubtotal, campaignSavings, tierSavings, finalSubtotal };
    }, [items, discountsMap]);

  const totalSavings = campaignSavings + tierSavings;

  // Future: These could be calculated based on store settings
  const shipping = 0; // Free shipping or calculated at checkout
  const tax = 0; // Calculated at checkout

  const total = finalSubtotal + shipping + tax;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Order Summary</h2>

      <div className="mt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span>
            {totalSavings > 0 ? (
              <span className="line-through text-muted-foreground">
                {formatPrice(originalSubtotal)}
              </span>
            ) : (
              formatPrice(originalSubtotal)
            )}
          </span>
        </div>

        {campaignSavings > 0 && (
          <div className="flex items-center justify-between text-sm text-red-600">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Sale discounts
            </span>
            <span>-{formatPrice(campaignSavings)}</span>
          </div>
        )}

        {tierSavings > 0 && (
          <div className="flex items-center justify-between text-sm text-green-600">
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Bulk discounts
            </span>
            <span>-{formatPrice(tierSavings)}</span>
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
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {checkoutEnabled ? (
        <>
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
        </>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Online checkout is not available. Please contact the store to
              complete your purchase.
            </p>
            {contactPhone && (
              <a
                href={`tel:${contactPhone}`}
                className="mt-2 inline-block text-primary hover:underline"
              >
                Call: {contactPhone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
