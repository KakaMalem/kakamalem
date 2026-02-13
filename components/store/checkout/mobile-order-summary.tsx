"use client";

import { useState } from "react";
import { ShoppingBag, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useCheckoutTotals } from "@/lib/stores/use-checkout-store";
import { CheckoutSummary } from "./checkout-summary";
import type { Cart } from "@/lib/db/queries/carts";

interface MobileOrderSummaryProps {
  cart: Cart;
  currency: string;
  tenantId?: string;
}

export function MobileOrderSummary({
  cart,
  currency,
  tenantId,
}: MobileOrderSummaryProps) {
  const { format: formatPrice } = useCurrencyStore();
  const [isOpen, setIsOpen] = useState(false);
  const { total } = useCheckoutTotals();
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="size-5" />
              <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {itemCount}
              </span>
            </div>
            <span className="font-medium">
              {isOpen ? "Hide order summary" : "Show order summary"}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
          <span className="font-semibold">{formatPrice(total)}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <CheckoutSummary
            cart={cart}
            currency={currency}
            tenantId={tenantId}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
