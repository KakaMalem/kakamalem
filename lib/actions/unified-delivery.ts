"use server";

import { db } from "@/lib/db";
import {
  unifiedDeliveryZones,
  unifiedDeliveryMethods,
  unifiedWeightTiers,
} from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canManageStore } from "@/lib/auth/context";
import {
  createUnifiedZoneSchema,
  updateUnifiedZoneSchema,
  createUnifiedMethodSchema,
  updateUnifiedMethodSchema,
  createMethodWithTiersSchema,
  bulkUpdateZoneOrderSchema,
  ZONE_SPECIFICITY_SCORES,
  type CreateUnifiedZoneInput,
  type UpdateUnifiedZoneInput,
  type CreateUnifiedMethodInput,
  type UpdateUnifiedMethodInput,
  type CreateMethodWithTiersInput,
  type BulkUpdateZoneOrderInput,
  type UnifiedZoneType,
} from "@/lib/validations/unified-delivery";

// =============================================================================
// TYPES
// =============================================================================

export type UnifiedZone = typeof unifiedDeliveryZones.$inferSelect;
export type UnifiedMethod = typeof unifiedDeliveryMethods.$inferSelect;
export type UnifiedWeightTier = typeof unifiedWeightTiers.$inferSelect;

export type UnifiedZoneWithMethods = UnifiedZone & {
  methods: UnifiedMethod[];
};

export type UnifiedMethodWithTiers = UnifiedMethod & {
  weightTiers: UnifiedWeightTier[];
};

// =============================================================================
// ZONE CRUD OPERATIONS
// =============================================================================

/**
 * Get all unified delivery zones for a tenant
 */
export async function getUnifiedZones(
  tenantId: string
): Promise<UnifiedZoneWithMethods[]> {
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: eq(unifiedDeliveryZones.tenantId, tenantId),
    with: {
      methods: {
        orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
      },
    },
    orderBy: [
      desc(unifiedDeliveryZones.specificityScore),
      asc(unifiedDeliveryZones.displayOrder),
    ],
  });

  return zones;
}

/**
 * Get a single unified delivery zone by ID
 */
export async function getUnifiedZone(
  tenantId: string,
  zoneId: string
): Promise<UnifiedZoneWithMethods | null> {
  const zone = await db.query.unifiedDeliveryZones.findFirst({
    where: and(
      eq(unifiedDeliveryZones.id, zoneId),
      eq(unifiedDeliveryZones.tenantId, tenantId)
    ),
    with: {
      methods: {
        orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
      },
    },
  });

  return zone ?? null;
}

/**
 * Create a new unified delivery zone
 */
export async function createUnifiedZone(
  tenantId: string,
  input: CreateUnifiedZoneInput
): Promise<{ success: boolean; zone?: UnifiedZone; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = createUnifiedZoneSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Validation failed",
    };
  }

  const data = validation.data;
  const specificityScore = ZONE_SPECIFICITY_SCORES[data.zoneType];

  try {
    const [zone] = await db
      .insert(unifiedDeliveryZones)
      .values({
        tenantId,
        name: data.name,
        zoneType: data.zoneType,
        specificityScore,
        polygonGeojson: data.polygonGeojson,
        centerLat: data.centerLat?.toString(),
        centerLng: data.centerLng?.toString(),
        radiusMeters: data.radiusMeters,
        countries: data.countries,
        regions: data.regions,
        cities: data.cities,
        postalPatterns: data.postalPatterns,
        color: data.color,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      })
      .returning();

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, zone };
  } catch (error) {
    console.error("Error creating unified zone:", error);
    return { success: false, error: "Failed to create zone" };
  }
}

/**
 * Update an existing unified delivery zone
 */
export async function updateUnifiedZone(
  tenantId: string,
  zoneId: string,
  input: UpdateUnifiedZoneInput
): Promise<{ success: boolean; zone?: UnifiedZone; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = updateUnifiedZoneSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Validation failed",
    };
  }

  const data = validation.data;

  // Calculate specificity score if zone type is being updated
  const specificityScore = data.zoneType
    ? ZONE_SPECIFICITY_SCORES[data.zoneType]
    : undefined;

  try {
    const [zone] = await db
      .update(unifiedDeliveryZones)
      .set({
        ...data,
        specificityScore,
        centerLat: data.centerLat?.toString(),
        centerLng: data.centerLng?.toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(unifiedDeliveryZones.id, zoneId),
          eq(unifiedDeliveryZones.tenantId, tenantId)
        )
      )
      .returning();

    if (!zone) {
      return { success: false, error: "Zone not found" };
    }

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, zone };
  } catch (error) {
    console.error("Error updating unified zone:", error);
    return { success: false, error: "Failed to update zone" };
  }
}

/**
 * Delete a unified delivery zone
 */
export async function deleteUnifiedZone(
  tenantId: string,
  zoneId: string
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await db
      .delete(unifiedDeliveryZones)
      .where(
        and(
          eq(unifiedDeliveryZones.id, zoneId),
          eq(unifiedDeliveryZones.tenantId, tenantId)
        )
      )
      .returning({ id: unifiedDeliveryZones.id });

    if (result.length === 0) {
      return { success: false, error: "Zone not found" };
    }

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting unified zone:", error);
    return { success: false, error: "Failed to delete zone" };
  }
}

/**
 * Toggle zone active status
 */
export async function toggleUnifiedZoneActive(
  tenantId: string,
  zoneId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db
      .update(unifiedDeliveryZones)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(unifiedDeliveryZones.id, zoneId),
          eq(unifiedDeliveryZones.tenantId, tenantId)
        )
      );

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error toggling zone:", error);
    return { success: false, error: "Failed to toggle zone" };
  }
}

/**
 * Bulk update zone display order
 */
export async function bulkUpdateZoneOrder(
  tenantId: string,
  input: BulkUpdateZoneOrderInput
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = bulkUpdateZoneOrderSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    await db.transaction(async (tx) => {
      for (const { id, displayOrder } of validation.data) {
        await tx
          .update(unifiedDeliveryZones)
          .set({ displayOrder, updatedAt: new Date().toISOString() })
          .where(
            and(
              eq(unifiedDeliveryZones.id, id),
              eq(unifiedDeliveryZones.tenantId, tenantId)
            )
          );
      }
    });

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error updating zone order:", error);
    return { success: false, error: "Failed to update order" };
  }
}

// =============================================================================
// METHOD CRUD OPERATIONS
// =============================================================================

/**
 * Get all methods for a zone
 */
export async function getUnifiedMethods(
  tenantId: string,
  zoneId: string
): Promise<UnifiedMethodWithTiers[]> {
  const methods = await db.query.unifiedDeliveryMethods.findMany({
    where: and(
      eq(unifiedDeliveryMethods.tenantId, tenantId),
      eq(unifiedDeliveryMethods.zoneId, zoneId)
    ),
    with: {
      weightTiers: {
        orderBy: [asc(unifiedWeightTiers.minWeight)],
      },
    },
    orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
  });

  return methods;
}

/**
 * Get a single method by ID
 */
export async function getUnifiedMethod(
  tenantId: string,
  methodId: string
): Promise<UnifiedMethodWithTiers | null> {
  const method = await db.query.unifiedDeliveryMethods.findFirst({
    where: and(
      eq(unifiedDeliveryMethods.id, methodId),
      eq(unifiedDeliveryMethods.tenantId, tenantId)
    ),
    with: {
      weightTiers: {
        orderBy: [asc(unifiedWeightTiers.minWeight)],
      },
    },
  });

  return method ?? null;
}

/**
 * Create a new delivery method
 */
export async function createUnifiedMethod(
  tenantId: string,
  input: CreateUnifiedMethodInput
): Promise<{ success: boolean; method?: UnifiedMethod; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = createUnifiedMethodSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Validation failed",
    };
  }

  const data = validation.data;

  // Verify the zone exists and belongs to this tenant
  const zone = await db.query.unifiedDeliveryZones.findFirst({
    where: and(
      eq(unifiedDeliveryZones.id, data.zoneId),
      eq(unifiedDeliveryZones.tenantId, tenantId)
    ),
  });

  if (!zone) {
    return { success: false, error: "Zone not found" };
  }

  try {
    const [method] = await db
      .insert(unifiedDeliveryMethods)
      .values({
        tenantId,
        zoneId: data.zoneId,
        name: data.name,
        description: data.description,
        methodType: data.methodType,
        minDeliveryDays: data.minDeliveryDays,
        maxDeliveryDays: data.maxDeliveryDays,
        estimatedTime: data.estimatedTime,
        rateType: data.rateType,
        baseRate: data.baseRate.toString(),
        perItemRate: data.perItemRate?.toString(),
        perKgRate: data.perKgRate?.toString(),
        freeShippingThreshold: data.freeShippingThreshold?.toString(),
        minOrderAmount: data.minOrderAmount?.toString(),
        minWeight: data.minWeight?.toString(),
        maxWeight: data.maxWeight?.toString(),
        handlingFee: data.handlingFee.toString(),
        includesInsurance: data.includesInsurance,
        insuranceRate: data.insuranceRate?.toString(),
        includesTracking: data.includesTracking,
        pickupLocationName: data.pickupLocationName,
        pickupLocationAddress: data.pickupLocationAddress,
        pickupLocationLat: data.pickupLocationLat?.toString(),
        pickupLocationLng: data.pickupLocationLng?.toString(),
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      })
      .returning();

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, method };
  } catch (error) {
    console.error("Error creating unified method:", error);
    return { success: false, error: "Failed to create method" };
  }
}

/**
 * Create a method with weight tiers (transaction)
 */
export async function createMethodWithTiers(
  tenantId: string,
  input: CreateMethodWithTiersInput
): Promise<{ success: boolean; method?: UnifiedMethod; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = createMethodWithTiersSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Validation failed",
    };
  }

  const { weightTiers, ...methodData } = validation.data;

  try {
    const result = await db.transaction(async (tx) => {
      // Create the method
      const [method] = await tx
        .insert(unifiedDeliveryMethods)
        .values({
          tenantId,
          zoneId: methodData.zoneId,
          name: methodData.name,
          description: methodData.description,
          methodType: methodData.methodType,
          minDeliveryDays: methodData.minDeliveryDays,
          maxDeliveryDays: methodData.maxDeliveryDays,
          estimatedTime: methodData.estimatedTime,
          rateType: methodData.rateType,
          baseRate: methodData.baseRate.toString(),
          perItemRate: methodData.perItemRate?.toString(),
          perKgRate: methodData.perKgRate?.toString(),
          freeShippingThreshold: methodData.freeShippingThreshold?.toString(),
          minOrderAmount: methodData.minOrderAmount?.toString(),
          minWeight: methodData.minWeight?.toString(),
          maxWeight: methodData.maxWeight?.toString(),
          handlingFee: methodData.handlingFee.toString(),
          includesInsurance: methodData.includesInsurance,
          insuranceRate: methodData.insuranceRate?.toString(),
          includesTracking: methodData.includesTracking,
          pickupLocationName: methodData.pickupLocationName,
          pickupLocationAddress: methodData.pickupLocationAddress,
          pickupLocationLat: methodData.pickupLocationLat?.toString(),
          pickupLocationLng: methodData.pickupLocationLng?.toString(),
          displayOrder: methodData.displayOrder,
          isActive: methodData.isActive,
        })
        .returning();

      // Create weight tiers if provided
      if (weightTiers && weightTiers.length > 0) {
        await tx.insert(unifiedWeightTiers).values(
          weightTiers.map((tier) => ({
            tenantId,
            methodId: method.id,
            minWeight: tier.minWeight.toString(),
            maxWeight: tier.maxWeight?.toString(),
            rate: tier.rate.toString(),
            perKgRateInTier: tier.perKgRateInTier?.toString(),
          }))
        );
      }

      return method;
    });

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, method: result };
  } catch (error) {
    console.error("Error creating method with tiers:", error);
    return { success: false, error: "Failed to create method" };
  }
}

/**
 * Update a delivery method
 */
export async function updateUnifiedMethod(
  tenantId: string,
  methodId: string,
  input: UpdateUnifiedMethodInput
): Promise<{ success: boolean; method?: UnifiedMethod; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = updateUnifiedMethodSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Validation failed",
    };
  }

  const data = validation.data;

  try {
    const [method] = await db
      .update(unifiedDeliveryMethods)
      .set({
        name: data.name,
        description: data.description,
        methodType: data.methodType,
        minDeliveryDays: data.minDeliveryDays,
        maxDeliveryDays: data.maxDeliveryDays,
        estimatedTime: data.estimatedTime,
        rateType: data.rateType,
        baseRate: data.baseRate?.toString(),
        perItemRate: data.perItemRate?.toString(),
        perKgRate: data.perKgRate?.toString(),
        freeShippingThreshold: data.freeShippingThreshold?.toString(),
        minOrderAmount: data.minOrderAmount?.toString(),
        minWeight: data.minWeight?.toString(),
        maxWeight: data.maxWeight?.toString(),
        handlingFee: data.handlingFee?.toString(),
        includesInsurance: data.includesInsurance,
        insuranceRate: data.insuranceRate?.toString(),
        includesTracking: data.includesTracking,
        pickupLocationName: data.pickupLocationName,
        pickupLocationAddress: data.pickupLocationAddress,
        pickupLocationLat: data.pickupLocationLat?.toString(),
        pickupLocationLng: data.pickupLocationLng?.toString(),
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(unifiedDeliveryMethods.id, methodId),
          eq(unifiedDeliveryMethods.tenantId, tenantId)
        )
      )
      .returning();

    if (!method) {
      return { success: false, error: "Method not found" };
    }

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, method };
  } catch (error) {
    console.error("Error updating unified method:", error);
    return { success: false, error: "Failed to update method" };
  }
}

/**
 * Delete a delivery method
 */
export async function deleteUnifiedMethod(
  tenantId: string,
  methodId: string
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await db
      .delete(unifiedDeliveryMethods)
      .where(
        and(
          eq(unifiedDeliveryMethods.id, methodId),
          eq(unifiedDeliveryMethods.tenantId, tenantId)
        )
      )
      .returning({ id: unifiedDeliveryMethods.id });

    if (result.length === 0) {
      return { success: false, error: "Method not found" };
    }

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting unified method:", error);
    return { success: false, error: "Failed to delete method" };
  }
}

/**
 * Toggle method active status
 */
export async function toggleUnifiedMethodActive(
  tenantId: string,
  methodId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db
      .update(unifiedDeliveryMethods)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(unifiedDeliveryMethods.id, methodId),
          eq(unifiedDeliveryMethods.tenantId, tenantId)
        )
      );

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error toggling method:", error);
    return { success: false, error: "Failed to toggle method" };
  }
}

// =============================================================================
// WEIGHT TIERS MANAGEMENT
// =============================================================================

/**
 * Replace all weight tiers for a method
 */
export async function replaceWeightTiers(
  tenantId: string,
  methodId: string,
  tiers: {
    minWeight: number;
    maxWeight: number | null;
    rate: number;
    perKgRateInTier?: number;
  }[]
): Promise<{ success: boolean; error?: string }> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify the method exists and belongs to this tenant
  const method = await db.query.unifiedDeliveryMethods.findFirst({
    where: and(
      eq(unifiedDeliveryMethods.id, methodId),
      eq(unifiedDeliveryMethods.tenantId, tenantId)
    ),
  });

  if (!method) {
    return { success: false, error: "Method not found" };
  }

  try {
    await db.transaction(async (tx) => {
      // Delete existing tiers
      await tx
        .delete(unifiedWeightTiers)
        .where(eq(unifiedWeightTiers.methodId, methodId));

      // Insert new tiers
      if (tiers.length > 0) {
        await tx.insert(unifiedWeightTiers).values(
          tiers.map((tier) => ({
            tenantId,
            methodId,
            minWeight: tier.minWeight.toString(),
            maxWeight: tier.maxWeight?.toString(),
            rate: tier.rate.toString(),
            perKgRateInTier: tier.perKgRateInTier?.toString(),
          }))
        );
      }
    });

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true };
  } catch (error) {
    console.error("Error replacing weight tiers:", error);
    return { success: false, error: "Failed to update weight tiers" };
  }
}

// =============================================================================
// ZONE STATISTICS
// =============================================================================

/**
 * Get zone statistics for the dashboard
 */
export async function getUnifiedZoneStats(tenantId: string): Promise<{
  totalZones: number;
  activeZones: number;
  totalMethods: number;
  zonesByType: Record<UnifiedZoneType, number>;
}> {
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: eq(unifiedDeliveryZones.tenantId, tenantId),
    with: {
      methods: true,
    },
  });

  const zonesByType: Record<UnifiedZoneType, number> = {
    polygon: 0,
    radius: 0,
    postal: 0,
    city: 0,
    region: 0,
    country: 0,
    worldwide: 0,
  };

  let totalMethods = 0;
  let activeZones = 0;

  for (const zone of zones) {
    zonesByType[zone.zoneType as UnifiedZoneType]++;
    totalMethods += zone.methods.length;
    if (zone.isActive) activeZones++;
  }

  return {
    totalZones: zones.length,
    activeZones,
    totalMethods,
    zonesByType,
  };
}

// =============================================================================
// COMBINED ZONE + METHOD CREATION
// =============================================================================

export interface CreateDeliveryOptionInput {
  // Zone fields
  zone: CreateUnifiedZoneInput;

  // Method fields
  method: {
    name: string;
    description?: string;
    methodType: "local_delivery" | "standard" | "express" | "pickup" | "custom";
    rateType:
      | "flat"
      | "per_item"
      | "weight_based"
      | "weight_tiered"
      | "price_based"
      | "free";
    baseRate: number;
    perItemRate?: number;
    perKgRate?: number;
    freeShippingThreshold?: number;
    minOrderAmount?: number;
    minDeliveryDays?: number;
    maxDeliveryDays?: number;
    estimatedTime?: string;
    handlingFee?: number;
    includesTracking?: boolean;
    pickupLocationName?: string;
    pickupLocationAddress?: string;
    pickupLocationLat?: number;
    pickupLocationLng?: number;
  };
}

/**
 * Create a delivery option (zone + method) in a single transaction
 */
export async function createDeliveryOption(
  tenantId: string,
  input: CreateDeliveryOptionInput
): Promise<{
  success: boolean;
  zone?: UnifiedZone;
  method?: UnifiedMethod;
  error?: string;
}> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate zone input
  const zoneValidation = createUnifiedZoneSchema.safeParse(input.zone);
  if (!zoneValidation.success) {
    return {
      success: false,
      error:
        zoneValidation.error.issues[0]?.message || "Zone validation failed",
    };
  }

  const zoneData = zoneValidation.data;
  const specificityScore = ZONE_SPECIFICITY_SCORES[zoneData.zoneType];

  try {
    const result = await db.transaction(async (tx) => {
      // Create the zone
      const [zone] = await tx
        .insert(unifiedDeliveryZones)
        .values({
          tenantId,
          name: zoneData.name,
          zoneType: zoneData.zoneType,
          specificityScore,
          polygonGeojson: zoneData.polygonGeojson,
          centerLat: zoneData.centerLat?.toString(),
          centerLng: zoneData.centerLng?.toString(),
          radiusMeters: zoneData.radiusMeters,
          countries: zoneData.countries,
          regions: zoneData.regions,
          cities: zoneData.cities,
          postalPatterns: zoneData.postalPatterns,
          color: zoneData.color,
          displayOrder: zoneData.displayOrder,
          isActive: zoneData.isActive,
        })
        .returning();

      // Create the method linked to the zone
      const [method] = await tx
        .insert(unifiedDeliveryMethods)
        .values({
          tenantId,
          zoneId: zone.id,
          name: input.method.name,
          description: input.method.description,
          methodType: input.method.methodType,
          rateType: input.method.rateType,
          baseRate: input.method.baseRate.toString(),
          perItemRate: input.method.perItemRate?.toString(),
          perKgRate: input.method.perKgRate?.toString(),
          freeShippingThreshold: input.method.freeShippingThreshold?.toString(),
          minOrderAmount: input.method.minOrderAmount?.toString(),
          minDeliveryDays: input.method.minDeliveryDays,
          maxDeliveryDays: input.method.maxDeliveryDays,
          estimatedTime: input.method.estimatedTime,
          handlingFee: (input.method.handlingFee ?? 0).toString(),
          includesTracking: input.method.includesTracking ?? true,
          pickupLocationName: input.method.pickupLocationName,
          pickupLocationAddress: input.method.pickupLocationAddress,
          pickupLocationLat: input.method.pickupLocationLat?.toString(),
          pickupLocationLng: input.method.pickupLocationLng?.toString(),
          displayOrder: 0,
          isActive: true,
        })
        .returning();

      return { zone, method };
    });

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, zone: result.zone, method: result.method };
  } catch (error) {
    console.error("Error creating delivery option:", error);
    return { success: false, error: "Failed to create delivery option" };
  }
}

/**
 * Update a delivery option (zone + method) in a single transaction
 */
export async function updateDeliveryOption(
  tenantId: string,
  zoneId: string,
  methodId: string,
  input: CreateDeliveryOptionInput
): Promise<{
  success: boolean;
  zone?: UnifiedZone;
  method?: UnifiedMethod;
  error?: string;
}> {
  const canManage = await canManageStore(tenantId);
  if (!canManage) {
    return { success: false, error: "Unauthorized" };
  }

  const zoneData = input.zone;
  const specificityScore = ZONE_SPECIFICITY_SCORES[zoneData.zoneType];

  try {
    const result = await db.transaction(async (tx) => {
      // Update the zone
      const [zone] = await tx
        .update(unifiedDeliveryZones)
        .set({
          name: zoneData.name,
          zoneType: zoneData.zoneType,
          specificityScore,
          polygonGeojson: zoneData.polygonGeojson,
          centerLat: zoneData.centerLat?.toString(),
          centerLng: zoneData.centerLng?.toString(),
          radiusMeters: zoneData.radiusMeters,
          countries: zoneData.countries,
          regions: zoneData.regions,
          cities: zoneData.cities,
          postalPatterns: zoneData.postalPatterns,
          color: zoneData.color,
          isActive: zoneData.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(unifiedDeliveryZones.id, zoneId),
            eq(unifiedDeliveryZones.tenantId, tenantId)
          )
        )
        .returning();

      if (!zone) {
        throw new Error("Zone not found");
      }

      // Update the method
      const [method] = await tx
        .update(unifiedDeliveryMethods)
        .set({
          name: input.method.name,
          description: input.method.description,
          methodType: input.method.methodType,
          rateType: input.method.rateType,
          baseRate: input.method.baseRate.toString(),
          perItemRate: input.method.perItemRate?.toString(),
          perKgRate: input.method.perKgRate?.toString(),
          freeShippingThreshold: input.method.freeShippingThreshold?.toString(),
          minOrderAmount: input.method.minOrderAmount?.toString(),
          minDeliveryDays: input.method.minDeliveryDays,
          maxDeliveryDays: input.method.maxDeliveryDays,
          estimatedTime: input.method.estimatedTime,
          handlingFee: (input.method.handlingFee ?? 0).toString(),
          includesTracking: input.method.includesTracking ?? true,
          pickupLocationName: input.method.pickupLocationName,
          pickupLocationAddress: input.method.pickupLocationAddress,
          pickupLocationLat: input.method.pickupLocationLat?.toString(),
          pickupLocationLng: input.method.pickupLocationLng?.toString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(unifiedDeliveryMethods.id, methodId),
            eq(unifiedDeliveryMethods.tenantId, tenantId)
          )
        )
        .returning();

      if (!method) {
        throw new Error("Method not found");
      }

      return { zone, method };
    });

    revalidatePath(`/dashboard/${tenantId}/settings/delivery`);
    return { success: true, zone: result.zone, method: result.method };
  } catch (error) {
    console.error("Error updating delivery option:", error);
    return { success: false, error: "Failed to update delivery option" };
  }
}

// =============================================================================
// CHECKOUT INTEGRATION
// =============================================================================

import {
  findMatchingZones,
  getBestMatchingZone,
  calculateRates,
  type MatchLocationInput,
  type ZoneMatchResult,
  type CalculatedRate,
} from "@/lib/delivery/zone-matcher";

/**
 * Get delivery options for a customer location (for checkout).
 * Returns all matching zones with their available methods and calculated rates.
 */
export async function getDeliveryOptions(
  tenantId: string,
  location: MatchLocationInput,
  orderData: {
    subtotal: number;
    itemCount: number;
    totalWeightKg?: number;
  }
): Promise<{
  success: boolean;
  zones?: Array<ZoneMatchResult & { rates: CalculatedRate[] }>;
  error?: string;
}> {
  try {
    // Find all matching zones
    const matchingZones = await findMatchingZones(tenantId, location);

    if (matchingZones.length === 0) {
      return {
        success: true,
        zones: [],
      };
    }

    // Calculate rates for each zone
    const zonesWithRates = await Promise.all(
      matchingZones.map(async (zone) => {
        const rates = await calculateRates(tenantId, zone.zone.id, orderData);
        return {
          ...zone,
          rates,
        };
      })
    );

    // Filter out zones with no available methods/rates
    const validZones = zonesWithRates.filter((z) => z.rates.length > 0);

    return {
      success: true,
      zones: validZones,
    };
  } catch (error) {
    console.error("Error getting delivery options:", error);
    return {
      success: false,
      error: "Failed to get delivery options",
    };
  }
}

/**
 * Get the best delivery option for a customer location.
 * Returns the most specific matching zone with calculated rates.
 */
export async function getBestDeliveryOption(
  tenantId: string,
  location: MatchLocationInput,
  orderData: {
    subtotal: number;
    itemCount: number;
    totalWeightKg?: number;
  }
): Promise<{
  success: boolean;
  zone?: ZoneMatchResult & { rates: CalculatedRate[] };
  error?: string;
}> {
  try {
    const bestZone = await getBestMatchingZone(tenantId, location);

    if (!bestZone) {
      return { success: true, zone: undefined };
    }

    const rates = await calculateRates(tenantId, bestZone.zone.id, orderData);

    return {
      success: true,
      zone: {
        ...bestZone,
        rates,
      },
    };
  } catch (error) {
    console.error("Error getting best delivery option:", error);
    return {
      success: false,
      error: "Failed to get delivery option",
    };
  }
}

/**
 * Check if unified delivery is enabled for a tenant.
 * Returns true if the tenant has at least one active zone with methods.
 */
export async function isUnifiedDeliveryEnabled(
  tenantId: string
): Promise<boolean> {
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: and(
      eq(unifiedDeliveryZones.tenantId, tenantId),
      eq(unifiedDeliveryZones.isActive, true)
    ),
    with: {
      methods: {
        where: eq(unifiedDeliveryMethods.isActive, true),
        limit: 1,
      },
    },
    limit: 1,
  });

  return zones.some((z) => z.methods.length > 0);
}

// =============================================================================
// CHECKOUT VISUALIZATION
// =============================================================================

/**
 * Unified zone display format for checkout map visualization.
 * Works with both legacy radius zones and new unified zones.
 */
export interface CheckoutDeliveryZone {
  id: string;
  name: string;
  zoneType: "radius" | "polygon" | "country" | "worldwide";
  color: string | null;
  // For radius zones
  centerLat: string | null;
  centerLng: string | null;
  radiusMeters: number | null;
  // For polygon zones
  polygonGeojson: unknown | null;
  // Pricing info (from first active method)
  deliveryFee: string | null;
  freeShippingThreshold: string | null;
  estimatedDeliveryTime: string | null;
  isActive: boolean;
}

/**
 * Get unified zones formatted for checkout visualization.
 * Returns zones that can be displayed on the checkout map.
 */
export async function getUnifiedZonesForCheckout(
  tenantId: string
): Promise<CheckoutDeliveryZone[]> {
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: and(
      eq(unifiedDeliveryZones.tenantId, tenantId),
      eq(unifiedDeliveryZones.isActive, true)
    ),
    with: {
      methods: {
        where: eq(unifiedDeliveryMethods.isActive, true),
        orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
        limit: 1,
      },
    },
    orderBy: [
      desc(unifiedDeliveryZones.specificityScore),
      asc(unifiedDeliveryZones.displayOrder),
    ],
  });

  return zones
    .filter(
      (z) =>
        // Only include zones with active methods and valid geometry
        z.methods.length > 0 &&
        (z.zoneType === "radius" ||
          z.zoneType === "polygon" ||
          z.zoneType === "country" ||
          z.zoneType === "worldwide")
    )
    .map((z) => {
      const method = z.methods[0];

      // Build estimated delivery time string
      let estimatedTime: string | null = method?.estimatedTime || null;
      if (
        !estimatedTime &&
        method?.minDeliveryDays &&
        method?.maxDeliveryDays
      ) {
        estimatedTime = `${method.minDeliveryDays}-${method.maxDeliveryDays} days`;
      }

      return {
        id: z.id,
        name: z.name,
        zoneType: z.zoneType as "radius" | "polygon" | "country" | "worldwide",
        color: z.color,
        centerLat: z.centerLat,
        centerLng: z.centerLng,
        radiusMeters: z.radiusMeters,
        polygonGeojson: z.polygonGeojson,
        deliveryFee: method?.baseRate || "0",
        freeShippingThreshold: method?.freeShippingThreshold || null,
        estimatedDeliveryTime: estimatedTime,
        isActive: z.isActive,
      };
    });
}
