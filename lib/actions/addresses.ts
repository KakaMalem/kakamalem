"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAddresses } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { computeH3Index, computePlusCode, reverseGeocode } from "@/lib/geo";
import { addressSchema, type AddressInput } from "@/lib/validations/addresses";

// =============================================================================
// CONSTANTS
// =============================================================================

// Max GPS accuracy to store (100km) - values higher are unrealistic and may cause DB overflow
const MAX_ACCURACY_METERS = 100000;

/**
 * Sanitize GPS accuracy value to prevent database overflow
 * The accuracy column is DECIMAL(8,2) which maxes at 999999.99
 * Unrealistic values (e.g., from VPN/emulated locations) are capped
 */
function sanitizeAccuracy(accuracy: number | undefined): string | null {
  if (accuracy === undefined || accuracy === null) {
    return null;
  }
  // Cap at maximum reasonable value
  const capped = Math.min(accuracy, MAX_ACCURACY_METERS);
  return capped.toString();
}

// =============================================================================
// SERVER ACTIONS
// =============================================================================

/**
 * Create a new address for the current user
 */
export async function createAddressAction(input: AddressInput) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  const validation = addressSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: "Invalid address data",
        issues: validation.error.issues,
      },
    };
  }

  const data = validation.data;

  // Use auth user name if firstName/lastName not provided
  let firstName = data.firstName || "";
  let lastName = data.lastName || "";
  if (!firstName && !lastName && user.name) {
    // Split name into first and last (first word = first name, rest = last name)
    const nameParts = user.name.trim().split(/\s+/);
    firstName = nameParts[0] || "";
    lastName = nameParts.slice(1).join(" ") || "";
  }

  try {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(userAddresses.userId, user.id),
            eq(userAddresses.isDefault, true)
          )
        );
    }

    // Count existing addresses to generate label and check for first address
    const existingAddresses = await db.query.userAddresses.findMany({
      where: eq(userAddresses.userId, user.id),
      columns: { id: true },
    });
    const addressNumber = existingAddresses.length + 1;
    const shouldBeDefault = data.isDefault || existingAddresses.length === 0;

    // Compute geospatial indices and reverse geocode city
    const h3Index = computeH3Index(data.latitude, data.longitude);
    const plusCode = computePlusCode(data.latitude, data.longitude);
    const city = await reverseGeocode(data.latitude, data.longitude);

    const [newAddress] = await db
      .insert(userAddresses)
      .values({
        userId: user.id,
        label: String(addressNumber),
        firstName,
        lastName,
        phone: data.phone,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
        h3Index,
        plusCode,
        city,
        accuracy: sanitizeAccuracy(data.accuracy),
        source: data.source || null,
        notes: data.notes || null,
        isDefault: shouldBeDefault,
      })
      .returning();

    revalidatePath("/store/[slug]/account/addresses", "page");
    return { data: newAddress };
  } catch (error) {
    console.error("Failed to create address:", error);
    return { error: { message: "Failed to create address" } };
  }
}

/**
 * Update an existing address
 */
export async function updateAddressAction(
  addressId: string,
  input: AddressInput
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  const validation = addressSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: "Invalid address data",
        issues: validation.error.issues,
      },
    };
  }

  const data = validation.data;

  try {
    // Verify ownership
    const existingAddress = await db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, user.id)
      ),
    });

    if (!existingAddress) {
      return { error: { message: "Address not found" } };
    }

    // If setting as default, unset other defaults first
    if (data.isDefault && !existingAddress.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(userAddresses.userId, user.id),
            eq(userAddresses.isDefault, true)
          )
        );
    }

    // Use auth user name if firstName/lastName not provided
    let firstName = data.firstName || "";
    let lastName = data.lastName || "";
    if (!firstName && !lastName && user.name) {
      const nameParts = user.name.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Compute geospatial indices and reverse geocode city
    const h3Index = computeH3Index(data.latitude, data.longitude);
    const plusCode = computePlusCode(data.latitude, data.longitude);
    const city = await reverseGeocode(data.latitude, data.longitude);

    const [updatedAddress] = await db
      .update(userAddresses)
      .set({
        // Keep existing label (auto-generated number)
        firstName,
        lastName,
        phone: data.phone,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
        h3Index,
        plusCode,
        city,
        accuracy: sanitizeAccuracy(data.accuracy),
        source: data.source || null,
        notes: data.notes || null,
        isDefault: data.isDefault,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userAddresses.id, addressId))
      .returning();

    revalidatePath("/store/[slug]/account/addresses", "page");
    return { data: updatedAddress };
  } catch (error) {
    console.error("Failed to update address:", error);
    return { error: { message: "Failed to update address" } };
  }
}

/**
 * Delete an address
 */
export async function deleteAddressAction(addressId: string) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  try {
    // Verify ownership
    const existingAddress = await db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, user.id)
      ),
    });

    if (!existingAddress) {
      return { error: { message: "Address not found" } };
    }

    const wasDefault = existingAddress.isDefault;

    await db.delete(userAddresses).where(eq(userAddresses.id, addressId));

    // If we deleted the default, make another one default
    if (wasDefault) {
      const remainingAddresses = await db.query.userAddresses.findMany({
        where: eq(userAddresses.userId, user.id),
        orderBy: (addresses, { desc }) => [desc(addresses.createdAt)],
        limit: 1,
      });

      if (remainingAddresses.length > 0) {
        await db
          .update(userAddresses)
          .set({ isDefault: true, updatedAt: new Date().toISOString() })
          .where(eq(userAddresses.id, remainingAddresses[0].id));
      }
    }

    revalidatePath("/store/[slug]/account/addresses", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete address:", error);
    return { error: { message: "Failed to delete address" } };
  }
}

/**
 * Set an address as the default
 */
export async function setDefaultAddressAction(addressId: string) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  try {
    // Verify ownership
    const existingAddress = await db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, user.id)
      ),
    });

    if (!existingAddress) {
      return { error: { message: "Address not found" } };
    }

    // Unset current default
    await db
      .update(userAddresses)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(userAddresses.userId, user.id),
          eq(userAddresses.isDefault, true)
        )
      );

    // Set new default
    await db
      .update(userAddresses)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(userAddresses.id, addressId));

    revalidatePath("/store/[slug]/account/addresses", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to set default address:", error);
    return { error: { message: "Failed to set default address" } };
  }
}
