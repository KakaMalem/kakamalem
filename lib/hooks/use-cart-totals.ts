"use client";

import { useMemo } from "react";

import {
  useCartItems,
  getApplicableTierPrice,
} from "@/lib/stores/use-cart-store";
import {
  useCartCampaignDiscounts,
  calculateDiscountedPrice,
} from "@/lib/hooks/use-campaign-discounts";

export interface CartCheckoutTotals {
  /** Sum of list prices before any discount */
  originalSubtotal: number;
  /** Amount saved from active campaign/sale discounts */
  campaignSavings: number;
  /** Amount saved from bulk/tier pricing */
  tierSavings: number;
  /** Subtotal after campaign + tier discounts */
  finalSubtotal: number;
  /** campaignSavings + tierSavings */
  totalSavings: number;
  /** Order total (shipping + tax are calculated later at checkout) */
  total: number;
}

/**
 * Single source of truth for cart money math — applies campaign discounts
 * first, then bulk/tier pricing, matching the order the checkout uses.
 * Shared by the cart summary and the mobile sticky checkout bar so they
 * never disagree.
 */
export function useCartCheckoutTotals(
  tenantId: string | null
): CartCheckoutTotals {
  const items = useCartItems();
  const { discountsMap } = useCartCampaignDiscounts(tenantId, items);

  return useMemo(() => {
    let originalSubtotal = 0;
    let campaignSavings = 0;
    let tierSavings = 0;
    let finalSubtotal = 0;

    for (const item of items) {
      const originalPrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);

      originalSubtotal += originalPrice * item.quantity;

      // Campaign/sale discount first
      const campaignDiscount = discountsMap.get(item.product.id);
      const afterCampaignPrice = calculateDiscountedPrice(
        originalPrice,
        campaignDiscount || null
      );
      if (campaignDiscount && afterCampaignPrice < originalPrice) {
        campaignSavings += (originalPrice - afterCampaignPrice) * item.quantity;
      }

      // Bulk/tier pricing on top of the campaign price
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

    const totalSavings = campaignSavings + tierSavings;
    // Shipping + tax are 0 here; both are calculated at checkout.
    const total = finalSubtotal;

    return {
      originalSubtotal,
      campaignSavings,
      tierSavings,
      finalSubtotal,
      totalSavings,
      total,
    };
  }, [items, discountsMap]);
}
