"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useCartItemCount } from "@/lib/stores/use-cart-store";
import { useCartCheckoutTotals } from "@/lib/hooks/use-cart-totals";
import { useStoreBasePath } from "@/components/store/store-path-provider";

interface CartStickyBarProps {
  tenantId: string;
}

/**
 * Sticky bottom checkout bar for the full cart page on mobile.
 * Mirrors the buy-bar / checkout-bar pattern: total always visible,
 * checkout one tap away. Hidden on md+ where the summary sidebar lives.
 */
export function CartStickyBar({ tenantId }: CartStickyBarProps) {
  const basePath = useStoreBasePath();
  const { format: formatPrice } = useCurrencyStore();
  const itemCount = useCartItemCount();
  const { total } = useCartCheckoutTotals(tenantId);

  if (itemCount === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-lg font-bold leading-none">
            {formatPrice(total)}
          </span>
        </div>
        <Button asChild size="lg" className="h-12 flex-1 gap-2 rounded-xl">
          <Link href={`${basePath}/checkout`}>
            Checkout
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
