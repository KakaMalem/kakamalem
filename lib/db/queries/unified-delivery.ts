/**
 * Unified Delivery System - Database Queries
 */

import { db } from "@/lib/db";
import {
  unifiedDeliveryZones,
  unifiedDeliveryMethods,
  unifiedWeightTiers,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

// =============================================================================
// TYPES
// =============================================================================

export type UnifiedZone = typeof unifiedDeliveryZones.$inferSelect;
export type UnifiedMethod = typeof unifiedDeliveryMethods.$inferSelect;
export type UnifiedWeightTier = typeof unifiedWeightTiers.$inferSelect;

export type ZoneWithMethods = UnifiedZone & {
  methods: UnifiedMethod[];
};

export type MethodWithTiers = UnifiedMethod & {
  weightTiers: UnifiedWeightTier[];
};

// =============================================================================
// ZONE QUERIES
// =============================================================================

/**
 * Get all zones for a tenant with their methods.
 */
export async function getZonesWithMethods(
  tenantId: string
): Promise<ZoneWithMethods[]> {
  return db.query.unifiedDeliveryZones.findMany({
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
}

/**
 * Get all active zones for a tenant (for checkout).
 * Cached for 60 seconds to reduce database load during checkout.
 */
export const getActiveZonesWithMethods = unstable_cache(
  async (tenantId: string): Promise<ZoneWithMethods[]> => {
    return db.query.unifiedDeliveryZones.findMany({
      where: and(
        eq(unifiedDeliveryZones.tenantId, tenantId),
        eq(unifiedDeliveryZones.isActive, true)
      ),
      with: {
        methods: {
          where: eq(unifiedDeliveryMethods.isActive, true),
          orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
        },
      },
      orderBy: [
        desc(unifiedDeliveryZones.specificityScore),
        asc(unifiedDeliveryZones.displayOrder),
      ],
    });
  },
  ["active-zones"],
  { revalidate: 60, tags: ["unified-delivery"] }
);

/**
 * Get a single zone by ID.
 */
export async function getZoneById(
  tenantId: string,
  zoneId: string
): Promise<ZoneWithMethods | null> {
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

// =============================================================================
// METHOD QUERIES
// =============================================================================

/**
 * Get a method with its weight tiers.
 */
export async function getMethodWithTiers(
  tenantId: string,
  methodId: string
): Promise<MethodWithTiers | null> {
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
 * Get all methods for a zone.
 */
export async function getMethodsForZone(
  tenantId: string,
  zoneId: string
): Promise<MethodWithTiers[]> {
  return db.query.unifiedDeliveryMethods.findMany({
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
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get zone statistics for a tenant.
 */
export async function getZoneStats(tenantId: string) {
  const zones = await db
    .select({
      zoneType: unifiedDeliveryZones.zoneType,
      isActive: unifiedDeliveryZones.isActive,
      count: sql<number>`count(*)::int`,
    })
    .from(unifiedDeliveryZones)
    .where(eq(unifiedDeliveryZones.tenantId, tenantId))
    .groupBy(unifiedDeliveryZones.zoneType, unifiedDeliveryZones.isActive);

  const methodCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unifiedDeliveryMethods)
    .where(eq(unifiedDeliveryMethods.tenantId, tenantId));

  const stats = {
    totalZones: 0,
    activeZones: 0,
    inactiveZones: 0,
    totalMethods: methodCount[0]?.count ?? 0,
    byType: {} as Record<string, { active: number; inactive: number }>,
  };

  for (const row of zones) {
    stats.totalZones += row.count;
    if (row.isActive) {
      stats.activeZones += row.count;
    } else {
      stats.inactiveZones += row.count;
    }

    if (!stats.byType[row.zoneType]) {
      stats.byType[row.zoneType] = { active: 0, inactive: 0 };
    }
    if (row.isActive) {
      stats.byType[row.zoneType].active += row.count;
    } else {
      stats.byType[row.zoneType].inactive += row.count;
    }
  }

  return stats;
}

// =============================================================================
// CHECKOUT HELPERS
// =============================================================================

/**
 * Check if a tenant has any active delivery zones configured.
 * Used to determine if the new unified system should be used.
 */
export async function hasUnifiedDeliveryZones(
  tenantId: string
): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unifiedDeliveryZones)
    .where(
      and(
        eq(unifiedDeliveryZones.tenantId, tenantId),
        eq(unifiedDeliveryZones.isActive, true)
      )
    );

  return (result[0]?.count ?? 0) > 0;
}

/**
 * Get zones that have at least one active delivery method.
 * This filters out zones that were created but have no methods yet.
 */
export async function getZonesWithActiveMethods(
  tenantId: string
): Promise<ZoneWithMethods[]> {
  const zones = await db.query.unifiedDeliveryZones.findMany({
    where: and(
      eq(unifiedDeliveryZones.tenantId, tenantId),
      eq(unifiedDeliveryZones.isActive, true)
    ),
    with: {
      methods: {
        where: eq(unifiedDeliveryMethods.isActive, true),
        orderBy: [asc(unifiedDeliveryMethods.displayOrder)],
      },
    },
    orderBy: [
      desc(unifiedDeliveryZones.specificityScore),
      asc(unifiedDeliveryZones.displayOrder),
    ],
  });

  // Filter to only zones with at least one method
  return zones.filter((z) => z.methods.length > 0);
}
