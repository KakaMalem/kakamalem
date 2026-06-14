"use client";

import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  useCheckoutTotals,
  useCheckoutSectionNavigation,
  type CheckoutSection,
} from "@/lib/stores/use-checkout-store";

const SECTION_ORDER: CheckoutSection[] = [
  "contact",
  "delivery",
  "shipping",
  "payment",
];

/**
 * Sticky bottom bar on mobile/tablet checkout (hidden on lg+, where the
 * order summary lives in a sidebar).
 *
 * Keeps the live total visible while the shopper scrolls through the form,
 * and acts as a wayfinding CTA — it expands and scrolls to the next step
 * the shopper needs to act on. The actual validation + "Place Order" logic
 * stays inside each accordion section; this bar never submits.
 */
export function CheckoutStickyBar() {
  const { format: formatPrice } = useCurrencyStore();
  const { subtotal, total } = useCheckoutTotals();
  const { completedSections, setExpandedSection } =
    useCheckoutSectionNavigation();

  const targetSection =
    SECTION_ORDER.find((s) => !completedSections.includes(s)) ?? "payment";
  const isPayment = targetSection === "payment";

  const displayTotal = total > 0 ? total : subtotal;

  const goToSection = useCallback(() => {
    setExpandedSection(targetSection);
    // Let the section expand before scrolling to it.
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-section="${targetSection}"]`);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  }, [targetSection, setExpandedSection]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-lg font-bold leading-none">
            {formatPrice(displayTotal)}
          </span>
        </div>
        <Button
          className="h-12 flex-1 rounded-xl"
          size="lg"
          onClick={goToSection}
        >
          {isPayment ? "Review & Pay" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
