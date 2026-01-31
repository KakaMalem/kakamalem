import { cache } from "react";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { storeLocations } from "@/lib/db/schema";

// =============================================================================
// STORE LOCATION QUERIES
// =============================================================================
// Store locations are tenant-scoped - each store can have multiple locations

export type StoreLocation = typeof storeLocations.$inferSelect;
export type NewStoreLocation = typeof storeLocations.$inferInsert;

/**
 * Get all locations for a store, ordered by primary first then display order
 */
export const getStoreLocations = cache(async (tenantId: string) => {
  return db.query.storeLocations.findMany({
    where: eq(storeLocations.tenantId, tenantId),
    orderBy: [desc(storeLocations.isPrimary), asc(storeLocations.displayOrder)],
  });
});

/**
 * Get active locations for a store (for storefront display)
 */
export const getActiveStoreLocations = cache(async (tenantId: string) => {
  return db.query.storeLocations.findMany({
    where: and(
      eq(storeLocations.tenantId, tenantId),
      eq(storeLocations.isActive, true)
    ),
    orderBy: [desc(storeLocations.isPrimary), asc(storeLocations.displayOrder)],
  });
});

/**
 * Get a single location by ID (with tenant ownership check)
 */
export const getStoreLocationById = cache(
  async (locationId: string, tenantId: string) => {
    return db.query.storeLocations.findFirst({
      where: and(
        eq(storeLocations.id, locationId),
        eq(storeLocations.tenantId, tenantId)
      ),
    });
  }
);

/**
 * Get the primary location for a store
 */
export const getPrimaryStoreLocation = cache(async (tenantId: string) => {
  return db.query.storeLocations.findFirst({
    where: and(
      eq(storeLocations.tenantId, tenantId),
      eq(storeLocations.isPrimary, true)
    ),
  });
});

/**
 * Get location count for a store
 */
export const getStoreLocationCount = cache(async (tenantId: string) => {
  const locations = await db.query.storeLocations.findMany({
    where: eq(storeLocations.tenantId, tenantId),
    columns: { id: true },
  });
  return locations.length;
});

/**
 * Create a new store location
 */
export async function createStoreLocation(
  data: Omit<NewStoreLocation, "id" | "createdAt" | "updatedAt">
) {
  // If this is the first location or marked as primary, clear other primaries
  if (data.isPrimary) {
    await db
      .update(storeLocations)
      .set({ isPrimary: false })
      .where(eq(storeLocations.tenantId, data.tenantId));
  }

  const [location] = await db.insert(storeLocations).values(data).returning();
  return location;
}

/**
 * Update a store location
 */
export async function updateStoreLocation(
  locationId: string,
  tenantId: string,
  data: Partial<
    Omit<NewStoreLocation, "id" | "tenantId" | "createdAt" | "updatedAt">
  >
) {
  // If setting as primary, clear other primaries first
  if (data.isPrimary) {
    await db
      .update(storeLocations)
      .set({ isPrimary: false })
      .where(eq(storeLocations.tenantId, tenantId));
  }

  const [updated] = await db
    .update(storeLocations)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(storeLocations.id, locationId),
        eq(storeLocations.tenantId, tenantId)
      )
    )
    .returning();

  return updated;
}

/**
 * Delete a store location
 */
export async function deleteStoreLocation(
  locationId: string,
  tenantId: string
) {
  const [deleted] = await db
    .delete(storeLocations)
    .where(
      and(
        eq(storeLocations.id, locationId),
        eq(storeLocations.tenantId, tenantId)
      )
    )
    .returning();

  return deleted;
}

/**
 * Set a location as primary (clears other primaries)
 */
export async function setLocationAsPrimary(
  locationId: string,
  tenantId: string
) {
  // Clear all primaries for this tenant
  await db
    .update(storeLocations)
    .set({ isPrimary: false })
    .where(eq(storeLocations.tenantId, tenantId));

  // Set the new primary
  const [updated] = await db
    .update(storeLocations)
    .set({ isPrimary: true, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(storeLocations.id, locationId),
        eq(storeLocations.tenantId, tenantId)
      )
    )
    .returning();

  return updated;
}
