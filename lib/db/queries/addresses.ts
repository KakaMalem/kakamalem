import { cache } from "react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAddresses } from "@/lib/db/schema";

// =============================================================================
// USER ADDRESS QUERIES
// =============================================================================
// Addresses are platform-wide (not tenant-scoped) - they work at any store

export type UserAddress = typeof userAddresses.$inferSelect;
export type NewUserAddress = typeof userAddresses.$inferInsert;

/**
 * Get all addresses for a user, ordered by default first then by creation date
 */
export const getUserAddresses = cache(async (userId: string) => {
  return db.query.userAddresses.findMany({
    where: eq(userAddresses.userId, userId),
    orderBy: [desc(userAddresses.isDefault), desc(userAddresses.createdAt)],
  });
});

/**
 * Get a single address by ID (with ownership check)
 */
export const getAddressById = cache(
  async (addressId: string, userId: string) => {
    return db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, userId)
      ),
    });
  }
);

/**
 * Get the user's default address
 */
export const getDefaultAddress = cache(async (userId: string) => {
  return db.query.userAddresses.findFirst({
    where: and(
      eq(userAddresses.userId, userId),
      eq(userAddresses.isDefault, true)
    ),
  });
});

/**
 * Get address count for a user
 */
export const getAddressCount = cache(async (userId: string) => {
  const addresses = await db.query.userAddresses.findMany({
    where: eq(userAddresses.userId, userId),
    columns: { id: true },
  });
  return addresses.length;
});
