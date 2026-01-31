"use server";

import { revalidatePath } from "next/cache";
import { canManageStore } from "@/lib/auth/context";
import { computePlusCode, reverseGeocode } from "@/lib/geo";
import {
  createStoreLocation,
  updateStoreLocation,
  deleteStoreLocation,
  setLocationAsPrimary,
  getStoreLocationById,
} from "@/lib/db/queries/store-locations";
import {
  storeLocationSchema,
  type StoreLocationInput,
} from "@/lib/validations/stores";

// =============================================================================
// SERVER ACTIONS FOR STORE LOCATIONS
// =============================================================================

/**
 * Create a new store location
 */
export async function createStoreLocationAction(
  tenantId: string,
  input: StoreLocationInput
) {
  // Verify user has permission to manage this store
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { error: { message: "Not authorized to manage this store" } };
  }

  const validation = storeLocationSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: "Invalid location data",
        issues: validation.error.issues,
      },
    };
  }

  const data = validation.data;

  try {
    // Compute Plus Code and reverse geocode city
    const plusCode = computePlusCode(data.latitude, data.longitude);
    const city = await reverseGeocode(data.latitude, data.longitude);

    const location = await createStoreLocation({
      tenantId,
      name: data.name,
      latitude: data.latitude.toString(),
      longitude: data.longitude.toString(),
      city: city || data.city || null,
      plusCode: plusCode || data.plusCode || null,
      accuracy: data.accuracy ?? null,
      source: data.source ?? null,
      phone: data.phone || null,
      email: data.email || null,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      displayOrder: data.displayOrder,
    });

    revalidatePath("/dashboard/[slug]/settings/locations", "page");
    return { data: location };
  } catch (error) {
    console.error("Failed to create store location:", error);
    return { error: { message: "Failed to create store location" } };
  }
}

/**
 * Update an existing store location
 */
export async function updateStoreLocationAction(
  tenantId: string,
  locationId: string,
  input: StoreLocationInput
) {
  // Verify user has permission to manage this store
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { error: { message: "Not authorized to manage this store" } };
  }

  const validation = storeLocationSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: "Invalid location data",
        issues: validation.error.issues,
      },
    };
  }

  const data = validation.data;

  try {
    // Verify the location exists and belongs to this tenant
    const existing = await getStoreLocationById(locationId, tenantId);
    if (!existing) {
      return { error: { message: "Location not found" } };
    }

    // Compute Plus Code and reverse geocode city
    const plusCode = computePlusCode(data.latitude, data.longitude);
    const city = await reverseGeocode(data.latitude, data.longitude);

    const location = await updateStoreLocation(locationId, tenantId, {
      name: data.name,
      latitude: data.latitude.toString(),
      longitude: data.longitude.toString(),
      city: city || data.city || null,
      plusCode: plusCode || data.plusCode || null,
      accuracy: data.accuracy ?? null,
      source: data.source ?? null,
      phone: data.phone || null,
      email: data.email || null,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      displayOrder: data.displayOrder,
    });

    revalidatePath("/dashboard/[slug]/settings/locations", "page");
    return { data: location };
  } catch (error) {
    console.error("Failed to update store location:", error);
    return { error: { message: "Failed to update store location" } };
  }
}

/**
 * Delete a store location
 */
export async function deleteStoreLocationAction(
  tenantId: string,
  locationId: string
) {
  // Verify user has permission to manage this store
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { error: { message: "Not authorized to manage this store" } };
  }

  try {
    // Verify the location exists and belongs to this tenant
    const existing = await getStoreLocationById(locationId, tenantId);
    if (!existing) {
      return { error: { message: "Location not found" } };
    }

    await deleteStoreLocation(locationId, tenantId);

    revalidatePath("/dashboard/[slug]/settings/locations", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete store location:", error);
    return { error: { message: "Failed to delete store location" } };
  }
}

/**
 * Set a location as primary
 */
export async function setPrimaryLocationAction(
  tenantId: string,
  locationId: string
) {
  // Verify user has permission to manage this store
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { error: { message: "Not authorized to manage this store" } };
  }

  try {
    // Verify the location exists and belongs to this tenant
    const existing = await getStoreLocationById(locationId, tenantId);
    if (!existing) {
      return { error: { message: "Location not found" } };
    }

    await setLocationAsPrimary(locationId, tenantId);

    revalidatePath("/dashboard/[slug]/settings/locations", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to set primary location:", error);
    return { error: { message: "Failed to set primary location" } };
  }
}
