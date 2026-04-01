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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between gap-3 p-4 border rounded-xl bg-muted/30 hover:bg-muted/50 transition-all group overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center size-10 rounded-full bg-background border border-border group-hover:border-primary/30 transition-colors">
              <ShoppingBag className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                {itemCount}
              </span>
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {isOpen ? "Hide Details" : "Show Details"}
              </span>
              <span className="font-semibold text-sm truncate">
                {isOpen ? "Click to collapse" : "Order Summary"}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ml-1",
                isOpen && "rotate-180"
              )}
            />
          </div>
          <div className="flex flex-col items-end shrink-0 pl-2">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Total
            </span>
            <span className="font-bold text-base text-primary">
              {formatPrice(total)}
            </span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
        <div className="mt-3 border rounded-xl overflow-hidden shadow-sm">
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
