"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Tag, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStoreBasePath } from "@/components/store/store-path-provider";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useCartItemCount } from "@/lib/stores/use-cart-store";
import { useCartCheckoutTotals } from "@/lib/hooks/use-cart-totals";

interface CartSummaryProps {
  storeSlug: string;
  currency: string;
  checkoutEnabled?: boolean;
  contactPhone?: string | null;
  tenantId?: string;
}

export function CartSummary({
  storeSlug: _storeSlug,
  currency: _currency,
  checkoutEnabled = true,
  contactPhone,
  tenantId,
}: CartSummaryProps) {
  const basePath = useStoreBasePath();
  const { format: formatPrice } = useCurrencyStore();
  const itemCount = useCartItemCount();

  // Shared money math (campaign + tier discounts) — see useCartCheckoutTotals
  const {
    originalSubtotal,
    campaignSavings,
    tierSavings,
    totalSavings,
    total,
  } = useCartCheckoutTotals(tenantId || null);

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
            <Link href={`${basePath}/checkout`}>
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
