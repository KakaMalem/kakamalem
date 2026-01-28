"use server";

import { db } from "@/lib/db";
import { deliveryZones, type DeliveryZone } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import {
  deliveryZoneCreateSchema,
  reorderDeliveryZonesSchema,
  type DeliveryZoneInput,
  type ReorderDeliveryZonesInput,
} from "@/lib/validations/delivery-zones";
import { completeOnboardingItem } from "@/lib/db/queries/onboarding";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Get all delivery zones for a tenant
 */
export async function getDeliveryZones(
  tenantId: string
): Promise<DeliveryZone[]> {
  return db.query.deliveryZones.findMany({
    where: eq(deliveryZones.tenantId, tenantId),
    orderBy: [asc(deliveryZones.displayOrder)],
  });
}

/**
 * Get active delivery zones for a tenant (for customer-facing validation)
 */
export async function getActiveDeliveryZones(
  tenantId: string
): Promise<DeliveryZone[]> {
  return db.query.deliveryZones.findMany({
    where: and(
      eq(deliveryZones.tenantId, tenantId),
      eq(deliveryZones.isActive, true)
    ),
    orderBy: [asc(deliveryZones.displayOrder)],
  });
}

/**
 * Get a single delivery zone by ID
 */
export async function getDeliveryZone(
  tenantId: string,
  zoneId: string
): Promise<DeliveryZone | undefined> {
  return db.query.deliveryZones.findFirst({
    where: and(
      eq(deliveryZones.tenantId, tenantId),
      eq(deliveryZones.id, zoneId)
    ),
  });
}

/**
 * Create a new delivery zone
 */
export async function createDeliveryZone(
  tenantId: string,
  input: DeliveryZoneInput
): Promise<ActionResult<{ id: string }>> {
  const result = deliveryZoneCreateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  try {
    const [zone] = await db
      .insert(deliveryZones)
      .values({
        tenantId,
        name: input.name,
        zoneType: input.zoneType,
        centerLat: input.centerLat?.toString(),
        centerLng: input.centerLng?.toString(),
        radiusMeters: input.radiusMeters,
        polygonCoordinates: input.polygonCoordinates,
        deliveryFee: input.deliveryFee.toString(),
        minOrderAmount: input.minOrderAmount?.toString() ?? null,
        freeShippingThreshold: input.freeShippingThreshold?.toString() ?? null,
        estimatedDeliveryTime: input.estimatedDeliveryTime ?? null,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
        color: input.color,
      })
      .returning({ id: deliveryZones.id });

    // Mark onboarding item as complete (async, don't block)
    completeOnboardingItem(tenantId, "setup_shipping").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    return { success: true, data: { id: zone.id } };
  } catch (error) {
    console.error("Error creating delivery zone:", error);
    return {
      success: false,
      error: {
        message: "Failed to create delivery zone. Please try again.",
      },
    };
  }
}

/**
 * Update an existing delivery zone
 */
export async function updateDeliveryZone(
  tenantId: string,
  zoneId: string,
  input: DeliveryZoneInput
): Promise<ActionResult> {
  const result = deliveryZoneCreateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  try {
    await db
      .update(deliveryZones)
      .set({
        name: input.name,
        zoneType: input.zoneType,
        centerLat: input.centerLat?.toString(),
        centerLng: input.centerLng?.toString(),
        radiusMeters: input.radiusMeters,
        polygonCoordinates: input.polygonCoordinates,
        deliveryFee: input.deliveryFee.toString(),
        minOrderAmount: input.minOrderAmount?.toString() ?? null,
        freeShippingThreshold: input.freeShippingThreshold?.toString() ?? null,
        estimatedDeliveryTime: input.estimatedDeliveryTime ?? null,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
        color: input.color,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(deliveryZones.tenantId, tenantId), eq(deliveryZones.id, zoneId))
      );

    return { success: true };
  } catch (error) {
    console.error("Error updating delivery zone:", error);
    return {
      success: false,
      error: {
        message: "Failed to update delivery zone. Please try again.",
      },
    };
  }
}

/**
 * Delete a delivery zone
 */
export async function deleteDeliveryZone(
  tenantId: string,
  zoneId: string
): Promise<ActionResult> {
  try {
    await db
      .delete(deliveryZones)
      .where(
        and(eq(deliveryZones.tenantId, tenantId), eq(deliveryZones.id, zoneId))
      );

    return { success: true };
  } catch (error) {
    console.error("Error deleting delivery zone:", error);
    return {
      success: false,
      error: {
        message: "Failed to delete delivery zone. Please try again.",
      },
    };
  }
}

/**
 * Toggle delivery zone active status
 */
export async function toggleDeliveryZoneStatus(
  tenantId: string,
  zoneId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    await db
      .update(deliveryZones)
      .set({
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(deliveryZones.tenantId, tenantId), eq(deliveryZones.id, zoneId))
      );

    return { success: true };
  } catch (error) {
    console.error("Error toggling delivery zone status:", error);
    return {
      success: false,
      error: {
        message: "Failed to update zone status. Please try again.",
      },
    };
  }
}

/**
 * Reorder delivery zones (update display order)
 */
export async function reorderDeliveryZones(
  tenantId: string,
  input: ReorderDeliveryZonesInput
): Promise<ActionResult> {
  const result = reorderDeliveryZonesSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: { message: issue.message },
    };
  }

  try {
    const updates = input.zoneIds.map((id, index) =>
      db
        .update(deliveryZones)
        .set({ displayOrder: index, updatedAt: new Date().toISOString() })
        .where(
          and(eq(deliveryZones.tenantId, tenantId), eq(deliveryZones.id, id))
        )
    );

    await Promise.all(updates);

    return { success: true };
  } catch (error) {
    console.error("Error reordering delivery zones:", error);
    return {
      success: false,
      error: {
        message: "Failed to reorder zones. Please try again.",
      },
    };
  }
}
