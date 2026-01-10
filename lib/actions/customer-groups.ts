"use server";

import { revalidatePath } from "next/cache";
import {
  getTenantCustomerGroups,
  getCustomerGroupById,
  createCustomerGroup,
  updateCustomerGroup,
  deleteCustomerGroup,
  getCustomerGroupMembers,
} from "@/lib/db/queries/pricing";
import type { CustomerGroup, NewCustomerGroup } from "@/lib/db/schema";

export type CustomerGroupActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
  data?: CustomerGroup | CustomerGroup[];
};

export interface CustomerGroupInput {
  name: string;
  description?: string;
  type: "retail" | "wholesale" | "vip";
  isDefault?: boolean;
}

/**
 * Get all customer groups for a tenant
 */
export async function getCustomerGroupsAction(
  tenantId: string
): Promise<CustomerGroupActionResult> {
  try {
    const groups = await getTenantCustomerGroups(tenantId);
    return {
      success: true,
      data: groups,
    };
  } catch (error) {
    console.error("Error getting customer groups:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to get customer groups",
      },
    };
  }
}

/**
 * Create a new customer group
 */
export async function createCustomerGroupAction(
  tenantId: string,
  input: CustomerGroupInput
): Promise<CustomerGroupActionResult> {
  try {
    // Validate input
    if (!input.name || input.name.trim().length < 2) {
      return {
        success: false,
        error: { message: "Group name must be at least 2 characters", field: "name" },
      };
    }

    const group = await createCustomerGroup({
      tenantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      isDefault: input.isDefault ?? false,
    } as NewCustomerGroup);

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: group,
    };
  } catch (error) {
    console.error("Error creating customer group:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to create customer group",
      },
    };
  }
}

/**
 * Update an existing customer group
 */
export async function updateCustomerGroupAction(
  groupId: string,
  input: Partial<CustomerGroupInput>
): Promise<CustomerGroupActionResult> {
  try {
    // Validate input
    if (input.name !== undefined && input.name.trim().length < 2) {
      return {
        success: false,
        error: { message: "Group name must be at least 2 characters", field: "name" },
      };
    }

    const group = await updateCustomerGroup(groupId, {
      name: input.name?.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      isDefault: input.isDefault,
    });

    if (!group) {
      return {
        success: false,
        error: { message: "Customer group not found" },
      };
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: group,
    };
  } catch (error) {
    console.error("Error updating customer group:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to update customer group",
      },
    };
  }
}

/**
 * Delete a customer group
 */
export async function deleteCustomerGroupAction(
  groupId: string
): Promise<CustomerGroupActionResult> {
  try {
    // Check if group has members
    const members = await getCustomerGroupMembers(groupId);
    if (members.length > 0) {
      return {
        success: false,
        error: {
          message: `Cannot delete group with ${members.length} member${members.length > 1 ? "s" : ""}. Remove members first.`,
        },
      };
    }

    await deleteCustomerGroup(groupId);

    revalidatePath(`/dashboard`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting customer group:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to delete customer group",
      },
    };
  }
}

/**
 * Get a single customer group with member count
 */
export async function getCustomerGroupAction(
  groupId: string
): Promise<CustomerGroupActionResult> {
  try {
    const group = await getCustomerGroupById(groupId);
    if (!group) {
      return {
        success: false,
        error: { message: "Customer group not found" },
      };
    }

    return {
      success: true,
      data: group,
    };
  } catch (error) {
    console.error("Error getting customer group:", error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to get customer group",
      },
    };
  }
}
