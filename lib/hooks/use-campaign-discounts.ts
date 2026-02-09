"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  applyCampaignDiscount,
  type CampaignDiscount,
} from "@/lib/utils/pricing-display";

// Re-export CampaignDiscount type for consumers
export type { CampaignDiscount };

/**
 * Active campaign data from API
 */
interface ActiveCampaign {
  id: string;
  name: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  scope: "store_wide" | "categories" | "products";
  eligibleCategories: string[] | null;
  eligibleProducts: string[] | null;
  excludedProducts: string[] | null;
  showBadge: boolean;
  badgeText: string | null;
  priority: number;
}

interface ProductForDiscount {
  productId: string;
  categoryId: string | null;
}

/**
 * Fetch active campaigns for a tenant
 */
async function fetchActiveCampaigns(
  tenantId: string
): Promise<ActiveCampaign[]> {
  const response = await fetch(`/api/campaigns/active?tenantId=${tenantId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch campaigns");
  }
  const data = await response.json();
  return data.campaigns || [];
}

/**
 * Find the best applicable campaign for a product
 */
function findApplicableCampaign(
  product: ProductForDiscount,
  campaigns: ActiveCampaign[]
): CampaignDiscount | null {
  for (const campaign of campaigns) {
    // Check if product is excluded
    if (
      campaign.excludedProducts &&
      campaign.excludedProducts.includes(product.productId)
    ) {
      continue;
    }

    let applies = false;

    // Check scope
    if (campaign.scope === "store_wide") {
      applies = true;
    } else if (
      campaign.scope === "categories" &&
      product.categoryId &&
      campaign.eligibleCategories?.includes(product.categoryId)
    ) {
      applies = true;
    } else if (
      campaign.scope === "products" &&
      campaign.eligibleProducts?.includes(product.productId)
    ) {
      applies = true;
    }

    if (applies) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountValue: parseFloat(campaign.discountValue),
        badgeText: campaign.showBadge ? campaign.badgeText : null,
      };
    }
  }

  return null;
}

/**
 * Hook to get active campaigns for a tenant
 */
export function useActiveCampaigns(tenantId: string | null) {
  return useQuery({
    queryKey: ["activeCampaigns", tenantId],
    queryFn: () => fetchActiveCampaigns(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get campaign discounts for cart items
 * Returns a map of productId -> CampaignDiscount
 */
export function useCartCampaignDiscounts(
  tenantId: string | null,
  cartItems: Array<{
    product: { id: string; categoryId?: string | null };
  }>
) {
  const {
    data: campaigns = [],
    isLoading,
    error,
  } = useActiveCampaigns(tenantId);

  const discountsMap = useMemo(() => {
    if (!campaigns.length || !cartItems.length) {
      return new Map<string, CampaignDiscount>();
    }

    const map = new Map<string, CampaignDiscount>();

    for (const item of cartItems) {
      const discount = findApplicableCampaign(
        {
          productId: item.product.id,
          categoryId: item.product.categoryId ?? null,
        },
        campaigns
      );

      if (discount) {
        map.set(item.product.id, discount);
      }
    }

    return map;
  }, [campaigns, cartItems]);

  return {
    discountsMap,
    campaigns,
    isLoading,
    error,
  };
}

/**
 * Calculate discounted price for a single product
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discount: CampaignDiscount | null
): number {
  if (!discount) return originalPrice;
  return applyCampaignDiscount(originalPrice, discount);
}

/**
 * Calculate cart totals with campaign discounts applied
 */
export function calculateCartTotalsWithDiscounts(
  items: Array<{
    product: { id: string; price: string; categoryId?: string | null };
    variant?: { price: string } | null;
    quantity: number;
  }>,
  campaigns: ActiveCampaign[]
): {
  subtotal: number;
  discountTotal: number;
  total: number;
} {
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);

    const lineTotal = basePrice * item.quantity;
    subtotal += lineTotal;

    // Find applicable campaign discount
    const discount = findApplicableCampaign(
      {
        productId: item.product.id,
        categoryId: item.product.categoryId ?? null,
      },
      campaigns
    );

    if (discount) {
      const discountedPrice = applyCampaignDiscount(basePrice, discount);
      const lineDiscount = (basePrice - discountedPrice) * item.quantity;
      discountTotal += lineDiscount;
    }
  }

  return {
    subtotal,
    discountTotal,
    total: subtotal - discountTotal,
  };
}
