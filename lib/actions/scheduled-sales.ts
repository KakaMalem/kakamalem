"use server";

import { revalidatePath } from "next/cache";
import {
  getTenantScheduledSales,
  getProductScheduledSales,
  createScheduledSale,
  updateScheduledSale,
  deleteScheduledSale,
  toggleScheduledSaleActive,
} from "@/lib/db/queries/pricing";
import type { ScheduledSale, NewScheduledSale } from "@/lib/db/schema";

export type ScheduledSaleActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
  data?: ScheduledSale | ScheduledSale[];
};

export interface ScheduledSaleInput {
  productId: string;
  name?: string;
  salePrice: string;
  startsAt: string;
  endsAt: string;
  priority?: number;
  isActive?: boolean;
}

/**
 * Get all scheduled sales for a tenant
 */
export async function getScheduledSalesAction(
  tenantId: string
): Promise<ScheduledSaleActionResult> {
  try {
    const sales = await getTenantScheduledSales(tenantId);
    return {
      success: true,
      data: sales,
    };
  } catch (error) {
    console.error("Error getting scheduled sales:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to get scheduled sales",
      },
    };
  }
}

/**
 * Get scheduled sales for a specific product
 */
export async function getProductScheduledSalesAction(
  productId: string
): Promise<ScheduledSaleActionResult> {
  try {
    const sales = await getProductScheduledSales(productId);
    return {
      success: true,
      data: sales,
    };
  } catch (error) {
    console.error("Error getting product sales:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to get product sales",
      },
    };
  }
}

/**
 * Create a new scheduled sale
 */
export async function createScheduledSaleAction(
  tenantId: string,
  input: ScheduledSaleInput
): Promise<ScheduledSaleActionResult> {
  try {
    // Validate input
    const salePrice = parseFloat(input.salePrice);
    if (isNaN(salePrice) || salePrice < 0) {
      return {
        success: false,
        error: { message: "Sale price must be a valid positive number", field: "salePrice" },
      };
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    if (isNaN(startsAt.getTime())) {
      return {
        success: false,
        error: { message: "Invalid start date", field: "startsAt" },
      };
    }

    if (isNaN(endsAt.getTime())) {
      return {
        success: false,
        error: { message: "Invalid end date", field: "endsAt" },
      };
    }

    if (endsAt <= startsAt) {
      return {
        success: false,
        error: { message: "End date must be after start date", field: "endsAt" },
      };
    }

    const sale = await createScheduledSale({
      tenantId,
      productId: input.productId,
      name: input.name?.trim() || null,
      salePrice: input.salePrice,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      priority: input.priority ?? 0,
      isActive: input.isActive ?? true,
    } as NewScheduledSale);

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: sale,
    };
  } catch (error) {
    console.error("Error creating scheduled sale:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to create scheduled sale",
      },
    };
  }
}

/**
 * Update an existing scheduled sale
 */
export async function updateScheduledSaleAction(
  saleId: string,
  input: Partial<ScheduledSaleInput>
): Promise<ScheduledSaleActionResult> {
  try {
    // Validate input
    if (input.salePrice !== undefined) {
      const salePrice = parseFloat(input.salePrice);
      if (isNaN(salePrice) || salePrice < 0) {
        return {
          success: false,
          error: { message: "Sale price must be a valid positive number", field: "salePrice" },
        };
      }
    }

    const updateData: Parameters<typeof updateScheduledSale>[1] = {};

    if (input.name !== undefined) {
      updateData.name = input.name?.trim() || null;
    }

    if (input.salePrice !== undefined) {
      updateData.salePrice = input.salePrice;
    }

    if (input.startsAt !== undefined) {
      const startsAt = new Date(input.startsAt);
      if (isNaN(startsAt.getTime())) {
        return {
          success: false,
          error: { message: "Invalid start date", field: "startsAt" },
        };
      }
      updateData.startsAt = startsAt.toISOString();
    }

    if (input.endsAt !== undefined) {
      const endsAt = new Date(input.endsAt);
      if (isNaN(endsAt.getTime())) {
        return {
          success: false,
          error: { message: "Invalid end date", field: "endsAt" },
        };
      }
      updateData.endsAt = endsAt.toISOString();
    }

    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }

    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    const sale = await updateScheduledSale(saleId, updateData);

    if (!sale) {
      return {
        success: false,
        error: { message: "Scheduled sale not found" },
      };
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: sale,
    };
  } catch (error) {
    console.error("Error updating scheduled sale:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to update scheduled sale",
      },
    };
  }
}

/**
 * Delete a scheduled sale
 */
export async function deleteScheduledSaleAction(
  saleId: string
): Promise<ScheduledSaleActionResult> {
  try {
    await deleteScheduledSale(saleId);

    revalidatePath(`/dashboard`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting scheduled sale:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to delete scheduled sale",
      },
    };
  }
}

/**
 * Toggle a scheduled sale's active status
 */
export async function toggleScheduledSaleActiveAction(
  saleId: string,
  isActive: boolean
): Promise<ScheduledSaleActionResult> {
  try {
    const sale = await toggleScheduledSaleActive(saleId, isActive);

    if (!sale) {
      return {
        success: false,
        error: { message: "Scheduled sale not found" },
      };
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: sale,
    };
  } catch (error) {
    console.error("Error toggling scheduled sale:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to toggle scheduled sale",
      },
    };
  }
}
