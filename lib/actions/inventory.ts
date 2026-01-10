"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { products, productVariants, inventoryMovements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth/server";

export type InventoryActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
  data?: {
    previousStock: number;
    newStock: number;
    movementId: string;
  };
};

export type AdjustmentInput = {
  productId: string;
  variantId?: string;
  adjustmentType: "add" | "remove" | "set";
  quantity: number;
  reason?: string;
};

/**
 * Adjust stock for a product or variant
 */
export async function adjustStock(
  tenantId: string,
  input: AdjustmentInput
): Promise<InventoryActionResult> {
  try {
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        error: { message: "Not authenticated" },
      };
    }

    const { productId, variantId, adjustmentType, quantity, reason } = input;

    // Validate quantity
    if (quantity < 0) {
      return {
        success: false,
        error: { message: "Quantity must be positive", field: "quantity" },
      };
    }

    if (adjustmentType !== "set" && quantity === 0) {
      return {
        success: false,
        error: {
          message: "Quantity cannot be zero for add/remove",
          field: "quantity",
        },
      };
    }

    let previousStock: number;
    let newStock: number;

    if (variantId) {
      // Adjust variant stock
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId)
        ),
        columns: { stock: true },
      });

      if (!variant) {
        return {
          success: false,
          error: { message: "Variant not found" },
        };
      }

      previousStock = variant.stock;

      if (adjustmentType === "add") {
        newStock = previousStock + quantity;
      } else if (adjustmentType === "remove") {
        newStock = Math.max(0, previousStock - quantity);
      } else {
        newStock = quantity;
      }

      // Update variant stock
      await db
        .update(productVariants)
        .set({
          stock: newStock,
          stockStatus:
            newStock === 0
              ? "out_of_stock"
              : newStock <= 5
                ? "low_stock"
                : "in_stock",
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(productVariants.id, variantId),
            eq(productVariants.tenantId, tenantId)
          )
        );
    } else {
      // Adjust product stock (simple product)
      const product = await db.query.products.findFirst({
        where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
        columns: { stock: true, hasVariants: true, trackInventory: true },
      });

      if (!product) {
        return {
          success: false,
          error: { message: "Product not found" },
        };
      }

      if (product.hasVariants) {
        return {
          success: false,
          error: {
            message:
              "This product has variants. Adjust stock on variants instead.",
          },
        };
      }

      if (!product.trackInventory) {
        return {
          success: false,
          error: { message: "Inventory tracking is disabled for this product" },
        };
      }

      previousStock = product.stock;

      if (adjustmentType === "add") {
        newStock = previousStock + quantity;
      } else if (adjustmentType === "remove") {
        newStock = Math.max(0, previousStock - quantity);
      } else {
        newStock = quantity;
      }

      // Update product stock
      await db
        .update(products)
        .set({
          stock: newStock,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(products.id, productId), eq(products.tenantId, tenantId))
        );
    }

    // Create inventory movement record
    const movementQuantity =
      adjustmentType === "set"
        ? newStock - previousStock
        : adjustmentType === "add"
          ? quantity
          : -quantity;

    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        productId,
        variantId: variantId || null,
        type: "adjustment",
        quantity: movementQuantity,
        previousStock,
        newStock,
        userId: user.id,
        reason:
          reason ||
          `Stock ${adjustmentType === "set" ? "set to" : adjustmentType === "add" ? "increased by" : "decreased by"} ${quantity}`,
      })
      .returning({ id: inventoryMovements.id });

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        previousStock,
        newStock,
        movementId: movement.id,
      },
    };
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return {
      success: false,
      error: { message: "Failed to adjust stock. Please try again." },
    };
  }
}

/**
 * Bulk adjust stock for multiple products
 */
export async function bulkAdjustStock(
  tenantId: string,
  adjustments: AdjustmentInput[]
): Promise<{
  success: boolean;
  results: { productId: string; success: boolean; error?: string }[];
}> {
  const results: { productId: string; success: boolean; error?: string }[] = [];

  for (const adjustment of adjustments) {
    const result = await adjustStock(tenantId, adjustment);
    results.push({
      productId: adjustment.productId,
      success: result.success,
      error: result.error?.message,
    });
  }

  const allSuccessful = results.every((r) => r.success);

  return {
    success: allSuccessful,
    results,
  };
}

/**
 * Record a stock movement (for sales, returns, restocks)
 */
export async function recordStockMovement(
  tenantId: string,
  data: {
    productId: string;
    variantId?: string;
    type: "sale" | "return" | "restock" | "reserved" | "released";
    quantity: number;
    orderId?: string;
    reason?: string;
  }
): Promise<InventoryActionResult> {
  try {
    const { productId, variantId, type, quantity, orderId, reason } = data;

    // Determine if adding or removing stock based on type
    const isAddition = ["return", "restock", "released"].includes(type);

    let previousStock: number;
    let newStock: number;

    if (variantId) {
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.id, variantId)
        ),
        columns: { stock: true },
      });

      if (!variant) {
        return { success: false, error: { message: "Variant not found" } };
      }

      previousStock = variant.stock;
      newStock = isAddition
        ? previousStock + quantity
        : Math.max(0, previousStock - quantity);

      await db
        .update(productVariants)
        .set({
          stock: newStock,
          stockStatus:
            newStock === 0
              ? "out_of_stock"
              : newStock <= 5
                ? "low_stock"
                : "in_stock",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productVariants.id, variantId));
    } else {
      const product = await db.query.products.findFirst({
        where: and(eq(products.tenantId, tenantId), eq(products.id, productId)),
        columns: { stock: true },
      });

      if (!product) {
        return { success: false, error: { message: "Product not found" } };
      }

      previousStock = product.stock;
      newStock = isAddition
        ? previousStock + quantity
        : Math.max(0, previousStock - quantity);

      await db
        .update(products)
        .set({ stock: newStock, updatedAt: new Date().toISOString() })
        .where(eq(products.id, productId));
    }

    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        productId,
        variantId: variantId || null,
        type,
        quantity: isAddition ? quantity : -quantity,
        previousStock,
        newStock,
        orderId: orderId || null,
        reason,
      })
      .returning({ id: inventoryMovements.id });

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        previousStock,
        newStock,
        movementId: movement.id,
      },
    };
  } catch (error) {
    console.error("Error recording stock movement:", error);
    return {
      success: false,
      error: { message: "Failed to record stock movement" },
    };
  }
}
