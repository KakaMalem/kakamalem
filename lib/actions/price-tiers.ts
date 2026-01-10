"use server";

import { revalidatePath } from "next/cache";
import {
  replaceProductPriceTiers,
  getProductPriceTiers,
} from "@/lib/db/queries/pricing";
import type { PriceTier } from "@/lib/db/schema";

export type PriceTierActionResult = {
  success: boolean;
  error?: {
    message: string;
  };
  data?: PriceTier[];
};

export interface PriceTierInput {
  minQuantity: number;
  maxQuantity: number | null;
  price: string;
}

/**
 * Save price tiers for a product
 * Replaces all existing tiers with the new ones
 */
export async function savePriceTiers(
  productId: string,
  tenantId: string,
  tiers: PriceTierInput[]
): Promise<PriceTierActionResult> {
  try {
    // Validate tiers
    for (const tier of tiers) {
      if (tier.minQuantity < 1) {
        return {
          success: false,
          error: { message: "Minimum quantity must be at least 1" },
        };
      }
      if (tier.maxQuantity !== null && tier.maxQuantity < tier.minQuantity) {
        return {
          success: false,
          error: {
            message:
              "Maximum quantity must be greater than or equal to minimum",
          },
        };
      }
      const price = parseFloat(tier.price);
      if (isNaN(price) || price < 0) {
        return {
          success: false,
          error: { message: "Price must be a valid positive number" },
        };
      }
    }

    // Check for overlapping ranges
    const sortedTiers = [...tiers].sort(
      (a, b) => a.minQuantity - b.minQuantity
    );
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];

      // If current has no max, it should be the last tier
      if (current.maxQuantity === null && i < sortedTiers.length - 1) {
        return {
          success: false,
          error: {
            message: "Only the last tier can have unlimited maximum quantity",
          },
        };
      }

      // Check for overlap
      if (
        current.maxQuantity !== null &&
        current.maxQuantity >= next.minQuantity
      ) {
        return {
          success: false,
          error: {
            message: `Tier ranges overlap: ${current.minQuantity}-${current.maxQuantity} and ${next.minQuantity}+`,
          },
        };
      }
    }

    // Save tiers
    const savedTiers = await replaceProductPriceTiers(
      productId,
      tenantId,
      tiers.map((tier) => ({
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        price: tier.price,
      }))
    );

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: savedTiers,
    };
  } catch (error) {
    console.error("Error saving price tiers:", error);
    return {
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : "Failed to save price tiers",
      },
    };
  }
}

/**
 * Get price tiers for a product
 */
export async function getPriceTiersAction(
  productId: string
): Promise<PriceTierActionResult> {
  try {
    const tiers = await getProductPriceTiers(productId);
    return {
      success: true,
      data: tiers,
    };
  } catch (error) {
    console.error("Error getting price tiers:", error);
    return {
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : "Failed to get price tiers",
      },
    };
  }
}
