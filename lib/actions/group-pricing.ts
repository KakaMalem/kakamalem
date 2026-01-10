"use server";

import { revalidatePath } from "next/cache";
import {
  getProductGroupPrices,
  setProductGroupPrice,
  deleteProductGroupPrice,
} from "@/lib/db/queries/pricing";
import type { CustomerGroupPrice } from "@/lib/db/schema";

export type GroupPriceActionResult = {
  success: boolean;
  error?: {
    message: string;
  };
  data?: CustomerGroupPrice[];
};

export interface GroupPriceInput {
  customerGroupId: string;
  price: string;
  compareAtPrice?: string | null;
}

/**
 * Get all group prices for a product
 */
export async function getGroupPricesAction(
  productId: string
): Promise<GroupPriceActionResult> {
  try {
    const prices = await getProductGroupPrices(productId);
    return {
      success: true,
      data: prices,
    };
  } catch (error) {
    console.error("Error getting group prices:", error);
    return {
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : "Failed to get group prices",
      },
    };
  }
}

/**
 * Save group prices for a product
 * Replaces/updates prices for the specified groups
 */
export async function saveGroupPrices(
  productId: string,
  tenantId: string,
  prices: GroupPriceInput[]
): Promise<GroupPriceActionResult> {
  try {
    // Validate prices
    for (const priceItem of prices) {
      const price = parseFloat(priceItem.price);
      if (isNaN(price) || price < 0) {
        return {
          success: false,
          error: { message: "Price must be a valid positive number" },
        };
      }

      if (priceItem.compareAtPrice) {
        const comparePrice = parseFloat(priceItem.compareAtPrice);
        if (isNaN(comparePrice) || comparePrice < 0) {
          return {
            success: false,
            error: {
              message: "Compare-at price must be a valid positive number",
            },
          };
        }
      }
    }

    // Get existing prices to determine which ones to delete
    const existingPrices = await getProductGroupPrices(productId);
    const newGroupIds = new Set(prices.map((p) => p.customerGroupId));

    // Delete prices for groups that are no longer in the list
    for (const existing of existingPrices) {
      if (!newGroupIds.has(existing.customerGroupId)) {
        await deleteProductGroupPrice(productId, existing.customerGroupId);
      }
    }

    // Save/update prices
    const savedPrices: CustomerGroupPrice[] = [];
    for (const priceItem of prices) {
      const saved = await setProductGroupPrice({
        productId,
        tenantId,
        customerGroupId: priceItem.customerGroupId,
        price: priceItem.price,
        compareAtPrice: priceItem.compareAtPrice || null,
      });
      savedPrices.push(saved);
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: savedPrices,
    };
  } catch (error) {
    console.error("Error saving group prices:", error);
    return {
      success: false,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Failed to save group prices",
      },
    };
  }
}

/**
 * Clear all group prices for a product
 */
export async function clearGroupPrices(
  productId: string
): Promise<GroupPriceActionResult> {
  try {
    const existingPrices = await getProductGroupPrices(productId);

    for (const price of existingPrices) {
      await deleteProductGroupPrice(productId, price.customerGroupId);
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: [],
    };
  } catch (error) {
    console.error("Error clearing group prices:", error);
    return {
      success: false,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Failed to clear group prices",
      },
    };
  }
}
