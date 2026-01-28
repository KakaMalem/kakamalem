"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  shippingZones,
  shippingMethods,
  shippingWeightTiers,
} from "@/lib/db/schema";
import { getUser, hasStoreAccess } from "@/lib/auth/server";
import {
  shippingZoneSchema,
  shippingMethodSchema,
  type ShippingZoneInput,
  type ShippingMethodInput,
} from "@/lib/validations/shipping";
import { completeOnboardingItem } from "@/lib/db/queries/onboarding";

// =============================================================================
// TYPES
// =============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: { message: string } };

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function verifyStoreAccess(
  tenantId: string,
  minRole: "owner" | "admin" | "staff" = "admin"
): Promise<ActionResult<{ userId: string }>> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Not authenticated" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access.hasAccess) {
    return { success: false, error: { message: "Access denied" } };
  }

  // Check role hierarchy: owner > admin > staff
  const roleHierarchy = { owner: 3, admin: 2, staff: 1 };
  const userRoleLevel =
    roleHierarchy[access.role as keyof typeof roleHierarchy] || 0;
  const requiredRoleLevel = roleHierarchy[minRole];

  if (userRoleLevel < requiredRoleLevel) {
    return {
      success: false,
      error: { message: `Requires ${minRole} or higher role` },
    };
  }

  return { success: true, data: { userId: user.id } };
}

// =============================================================================
// SHIPPING ZONE ACTIONS
// =============================================================================

/**
 * Get all shipping zones for a tenant
 */
export async function getShippingZonesAction(tenantId: string) {
  const accessCheck = await verifyStoreAccess(tenantId, "staff");
  if (!accessCheck.success) {
    return accessCheck;
  }

  try {
    const zones = await db.query.shippingZones.findMany({
      where: eq(shippingZones.tenantId, tenantId),
      orderBy: [desc(shippingZones.priority), desc(shippingZones.createdAt)],
      with: {
        methods: {
          orderBy: [shippingMethods.displayOrder],
        },
      },
    });

    return { success: true as const, data: zones };
  } catch (error) {
    console.error("Failed to fetch shipping zones:", error);
    return {
      success: false as const,
      error: { message: "Failed to fetch shipping zones" },
    };
  }
}

/**
 * Create a new shipping zone
 */
export async function createShippingZoneAction(
  tenantId: string,
  storeSlug: string,
  input: ShippingZoneInput
): Promise<ActionResult<{ id: string }>> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  const validation = shippingZoneSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { message: validation.error.issues[0]?.message || "Invalid data" },
    };
  }

  const data = validation.data;

  try {
    const [newZone] = await db
      .insert(shippingZones)
      .values({
        tenantId,
        name: data.name,
        description: data.description || null,
        countries: data.countries || null,
        states: data.states || null,
        cities: data.cities || null,
        postalCodes: data.postalCodes || null,
        priority: data.priority,
        isActive: data.isActive,
      })
      .returning({ id: shippingZones.id });

    // Mark onboarding item as complete (async, don't block)
    completeOnboardingItem(tenantId, "setup_shipping").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true, data: { id: newZone.id } };
  } catch (error) {
    console.error("Failed to create shipping zone:", error);
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return {
        success: false,
        error: { message: "A zone with this name already exists" },
      };
    }
    return {
      success: false,
      error: { message: "Failed to create shipping zone" },
    };
  }
}

/**
 * Update a shipping zone
 */
export async function updateShippingZoneAction(
  tenantId: string,
  storeSlug: string,
  zoneId: string,
  input: ShippingZoneInput
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  const validation = shippingZoneSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { message: validation.error.issues[0]?.message || "Invalid data" },
    };
  }

  const data = validation.data;

  try {
    // Verify zone belongs to tenant
    const existing = await db.query.shippingZones.findFirst({
      where: and(
        eq(shippingZones.id, zoneId),
        eq(shippingZones.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Zone not found" } };
    }

    await db
      .update(shippingZones)
      .set({
        name: data.name,
        description: data.description || null,
        countries: data.countries || null,
        states: data.states || null,
        cities: data.cities || null,
        postalCodes: data.postalCodes || null,
        priority: data.priority,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shippingZones.id, zoneId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update shipping zone:", error);
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return {
        success: false,
        error: { message: "A zone with this name already exists" },
      };
    }
    return {
      success: false,
      error: { message: "Failed to update shipping zone" },
    };
  }
}

/**
 * Delete a shipping zone
 */
export async function deleteShippingZoneAction(
  tenantId: string,
  storeSlug: string,
  zoneId: string
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  try {
    // Verify zone belongs to tenant
    const existing = await db.query.shippingZones.findFirst({
      where: and(
        eq(shippingZones.id, zoneId),
        eq(shippingZones.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Zone not found" } };
    }

    // Delete zone (cascade will delete methods)
    await db.delete(shippingZones).where(eq(shippingZones.id, zoneId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete shipping zone:", error);
    return {
      success: false,
      error: { message: "Failed to delete shipping zone" },
    };
  }
}

// =============================================================================
// SHIPPING METHOD ACTIONS
// =============================================================================

/**
 * Create a new shipping method
 */
export async function createShippingMethodAction(
  tenantId: string,
  storeSlug: string,
  input: ShippingMethodInput
): Promise<ActionResult<{ id: string }>> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  const validation = shippingMethodSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { message: validation.error.issues[0]?.message || "Invalid data" },
    };
  }

  const data = validation.data;

  try {
    // Verify zone belongs to tenant
    const zone = await db.query.shippingZones.findFirst({
      where: and(
        eq(shippingZones.id, data.zoneId),
        eq(shippingZones.tenantId, tenantId)
      ),
    });

    if (!zone) {
      return { success: false, error: { message: "Zone not found" } };
    }

    const [newMethod] = await db
      .insert(shippingMethods)
      .values({
        tenantId,
        zoneId: data.zoneId,
        name: data.name,
        description: data.description || null,
        minDeliveryDays: data.minDeliveryDays || null,
        maxDeliveryDays: data.maxDeliveryDays || null,
        rateType: data.rateType,
        baseRate: data.baseRate,
        perItemRate: data.perItemRate || null,
        perKgRate: data.perKgRate || null,
        freeShippingThreshold: data.freeShippingThreshold || null,
        minWeight: data.minWeight || null,
        maxWeight: data.maxWeight || null,
        handlingFee: data.handlingFee || null,
        includesInsurance: data.includesInsurance,
        insuranceRate: data.insuranceRate || null,
        includesTracking: data.includesTracking,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      })
      .returning({ id: shippingMethods.id });

    // Mark onboarding item as complete (async, don't block)
    completeOnboardingItem(tenantId, "setup_shipping").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true, data: { id: newMethod.id } };
  } catch (error) {
    console.error("Failed to create shipping method:", error);
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return {
        success: false,
        error: {
          message: "A method with this name already exists in this zone",
        },
      };
    }
    return {
      success: false,
      error: { message: "Failed to create shipping method" },
    };
  }
}

/**
 * Update a shipping method
 */
export async function updateShippingMethodAction(
  tenantId: string,
  storeSlug: string,
  methodId: string,
  input: ShippingMethodInput
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  const validation = shippingMethodSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { message: validation.error.issues[0]?.message || "Invalid data" },
    };
  }

  const data = validation.data;

  try {
    // Verify method belongs to tenant
    const existing = await db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, methodId),
        eq(shippingMethods.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Method not found" } };
    }

    await db
      .update(shippingMethods)
      .set({
        zoneId: data.zoneId,
        name: data.name,
        description: data.description || null,
        minDeliveryDays: data.minDeliveryDays || null,
        maxDeliveryDays: data.maxDeliveryDays || null,
        rateType: data.rateType,
        baseRate: data.baseRate,
        perItemRate: data.perItemRate || null,
        perKgRate: data.perKgRate || null,
        freeShippingThreshold: data.freeShippingThreshold || null,
        minWeight: data.minWeight || null,
        maxWeight: data.maxWeight || null,
        handlingFee: data.handlingFee || null,
        includesInsurance: data.includesInsurance,
        insuranceRate: data.insuranceRate || null,
        includesTracking: data.includesTracking,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shippingMethods.id, methodId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update shipping method:", error);
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return {
        success: false,
        error: {
          message: "A method with this name already exists in this zone",
        },
      };
    }
    return {
      success: false,
      error: { message: "Failed to update shipping method" },
    };
  }
}

/**
 * Delete a shipping method
 */
export async function deleteShippingMethodAction(
  tenantId: string,
  storeSlug: string,
  methodId: string
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  try {
    // Verify method belongs to tenant
    const existing = await db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, methodId),
        eq(shippingMethods.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Method not found" } };
    }

    // Delete weight tiers first
    await db
      .delete(shippingWeightTiers)
      .where(eq(shippingWeightTiers.methodId, methodId));

    // Delete method
    await db.delete(shippingMethods).where(eq(shippingMethods.id, methodId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete shipping method:", error);
    return {
      success: false,
      error: { message: "Failed to delete shipping method" },
    };
  }
}

/**
 * Toggle shipping method active status
 */
export async function toggleShippingMethodAction(
  tenantId: string,
  storeSlug: string,
  methodId: string,
  isActive: boolean
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  try {
    // Verify method belongs to tenant
    const existing = await db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, methodId),
        eq(shippingMethods.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Method not found" } };
    }

    await db
      .update(shippingMethods)
      .set({
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shippingMethods.id, methodId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle shipping method:", error);
    return {
      success: false,
      error: { message: "Failed to update shipping method" },
    };
  }
}

/**
 * Toggle shipping zone active status
 */
export async function toggleShippingZoneAction(
  tenantId: string,
  storeSlug: string,
  zoneId: string,
  isActive: boolean
): Promise<ActionResult> {
  const accessCheck = await verifyStoreAccess(tenantId, "admin");
  if (!accessCheck.success) {
    return accessCheck;
  }

  try {
    // Verify zone belongs to tenant
    const existing = await db.query.shippingZones.findFirst({
      where: and(
        eq(shippingZones.id, zoneId),
        eq(shippingZones.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: { message: "Zone not found" } };
    }

    await db
      .update(shippingZones)
      .set({
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shippingZones.id, zoneId));

    revalidatePath(`/dashboard/${storeSlug}/shipping`);
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle shipping zone:", error);
    return {
      success: false,
      error: { message: "Failed to update shipping zone" },
    };
  }
}
