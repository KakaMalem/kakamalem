"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAddresses } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { z } from "zod";

// =============================================================================
// ADDRESS VALIDATION SCHEMAS
// =============================================================================

export const addressSchema = z.object({
  label: z.string().max(100).optional(),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(50).optional(),
  street1: z.string().min(1, "Street address is required").max(255),
  street2: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State/Province is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  countryCode: z.string().length(2, "Country is required"),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

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

    // Check if this is the first address - make it default automatically
    const existingAddresses = await db.query.userAddresses.findMany({
      where: eq(userAddresses.userId, user.id),
      columns: { id: true },
    });
    const shouldBeDefault = data.isDefault || existingAddresses.length === 0;

    const [newAddress] = await db
      .insert(userAddresses)
      .values({
        userId: user.id,
        label: data.label || null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        street1: data.street1,
        street2: data.street2 || null,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        countryCode: data.countryCode,
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

    const [updatedAddress] = await db
      .update(userAddresses)
      .set({
        label: data.label || null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        street1: data.street1,
        street2: data.street2 || null,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        countryCode: data.countryCode,
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
