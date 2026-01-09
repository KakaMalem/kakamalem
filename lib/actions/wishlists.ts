"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { wishlists, wishlistItems } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { getOrCreateDefaultWishlist } from "@/lib/db/queries/wishlists";

// =============================================================================
// WISHLIST SERVER ACTIONS
// =============================================================================

/**
 * Add a product to the user's wishlist at a specific store
 */
export async function addToWishlistAction(
  tenantId: string,
  productId: string,
  variantId?: string,
  note?: string
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Please log in to save items to your wishlist" } };
  }

  try {
    // Get or create the default wishlist
    const wishlist = await getOrCreateDefaultWishlist(tenantId, user.id);

    // Check if item already exists
    const existingItem = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId)
      ),
    });

    if (existingItem) {
      return { error: { message: "Item is already in your wishlist" } };
    }

    // Add the item
    const [newItem] = await db
      .insert(wishlistItems)
      .values({
        tenantId,
        wishlistId: wishlist.id,
        productId,
        variantId: variantId || null,
        note: note || null,
      })
      .returning();

    revalidatePath("/store/[slug]/account/wishlist", "page");
    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { data: newItem };
  } catch (error) {
    console.error("Failed to add to wishlist:", error);
    return { error: { message: "Failed to add item to wishlist" } };
  }
}

/**
 * Remove a product from the user's wishlist
 */
export async function removeFromWishlistAction(
  tenantId: string,
  productId: string,
  variantId?: string
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  try {
    // Get the default wishlist
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.userId, user.id),
        eq(wishlists.isDefault, true)
      ),
    });

    if (!wishlist) {
      return { error: { message: "Wishlist not found" } };
    }

    // Find and delete the item
    const conditions = [
      eq(wishlistItems.wishlistId, wishlist.id),
      eq(wishlistItems.productId, productId),
    ];

    // If variantId is specified, include it in the condition
    if (variantId) {
      conditions.push(eq(wishlistItems.variantId, variantId));
    }

    await db.delete(wishlistItems).where(and(...conditions));

    revalidatePath("/store/[slug]/account/wishlist", "page");
    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to remove from wishlist:", error);
    return { error: { message: "Failed to remove item from wishlist" } };
  }
}

/**
 * Remove a wishlist item by its ID
 */
export async function removeWishlistItemAction(itemId: string) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  try {
    // Verify the item belongs to the user
    const item = await db.query.wishlistItems.findFirst({
      where: eq(wishlistItems.id, itemId),
      with: {
        wishlist: true,
      },
    });

    if (!item || item.wishlist.userId !== user.id) {
      return { error: { message: "Item not found" } };
    }

    await db.delete(wishlistItems).where(eq(wishlistItems.id, itemId));

    revalidatePath("/store/[slug]/account/wishlist", "page");
    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to remove wishlist item:", error);
    return { error: { message: "Failed to remove item" } };
  }
}

/**
 * Toggle a product in the wishlist (add if not exists, remove if exists)
 */
export async function toggleWishlistAction(
  tenantId: string,
  productId: string,
  variantId?: string
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Please log in to save items to your wishlist" } };
  }

  try {
    // Get or create the default wishlist
    const wishlist = await getOrCreateDefaultWishlist(tenantId, user.id);

    // Check if item already exists
    const existingItem = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId)
      ),
    });

    if (existingItem) {
      // Remove it
      await db.delete(wishlistItems).where(eq(wishlistItems.id, existingItem.id));
      revalidatePath("/store/[slug]/account/wishlist", "page");
      revalidatePath("/store/[slug]/product/[productSlug]", "page");
      return { data: { action: "removed" as const } };
    } else {
      // Add it
      await db.insert(wishlistItems).values({
        tenantId,
        wishlistId: wishlist.id,
        productId,
        variantId: variantId || null,
      });
      revalidatePath("/store/[slug]/account/wishlist", "page");
      revalidatePath("/store/[slug]/product/[productSlug]", "page");
      return { data: { action: "added" as const } };
    }
  } catch (error) {
    console.error("Failed to toggle wishlist:", error);
    return { error: { message: "Failed to update wishlist" } };
  }
}
