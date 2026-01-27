import { cache } from "react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  wishlists,
  wishlistItems,
  products,
  media,
  productImages,
} from "@/lib/db/schema";

// =============================================================================
// WISHLIST QUERIES
// =============================================================================
// Wishlists are tenant-scoped - each user has a separate wishlist per store

export type Wishlist = typeof wishlists.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;

/**
 * Get or create the default wishlist for a user at a specific store
 */
export const getOrCreateDefaultWishlist = cache(
  async (tenantId: string, userId: string) => {
    // Try to find existing default wishlist
    let wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.userId, userId),
        eq(wishlists.isDefault, true)
      ),
    });

    // Create if doesn't exist
    if (!wishlist) {
      const [newWishlist] = await db
        .insert(wishlists)
        .values({
          tenantId,
          userId,
          name: "My Wishlist",
          isDefault: true,
        })
        .returning();
      wishlist = newWishlist;
    }

    return wishlist;
  }
);

/**
 * Get wishlist items with product details for a user at a store
 */
export const getWishlistItems = cache(
  async (tenantId: string, userId: string) => {
    const wishlist = await getOrCreateDefaultWishlist(tenantId, userId);

    const items = await db
      .select({
        id: wishlistItems.id,
        productId: wishlistItems.productId,
        variantId: wishlistItems.variantId,
        note: wishlistItems.note,
        addedAt: wishlistItems.addedAt,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
          status: products.status,
          hasVariants: products.hasVariants,
          stock: products.stock,
          trackInventory: products.trackInventory,
        },
        productImage: {
          id: media.id,
          url: media.url,
          alt: media.altText,
        },
      })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.position, 0)
        )
      )
      .leftJoin(media, eq(productImages.mediaId, media.id))
      .where(eq(wishlistItems.wishlistId, wishlist.id))
      .orderBy(desc(wishlistItems.addedAt));

    return items;
  }
);

/**
 * Check if a product is in the user's wishlist at a store
 */
export const isProductInWishlist = cache(
  async (
    tenantId: string,
    userId: string,
    productId: string,
    variantId?: string
  ) => {
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.userId, userId),
        eq(wishlists.isDefault, true)
      ),
    });

    if (!wishlist) return false;

    const item = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId),
        variantId
          ? eq(wishlistItems.variantId, variantId)
          : eq(wishlistItems.variantId, variantId as unknown as string) // null check
      ),
    });

    return !!item;
  }
);

/**
 * Get wishlist item count for a user at a store
 */
export const getWishlistItemCount = cache(
  async (tenantId: string, userId: string) => {
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.userId, userId),
        eq(wishlists.isDefault, true)
      ),
    });

    if (!wishlist) return 0;

    const items = await db.query.wishlistItems.findMany({
      where: eq(wishlistItems.wishlistId, wishlist.id),
      columns: { id: true },
    });

    return items.length;
  }
);

/**
 * Get all product IDs in the user's wishlist at a store.
 * Used to hydrate the client-side wishlist store.
 */
export const getWishlistedProductIds = cache(
  async (tenantId: string, userId: string) => {
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.userId, userId),
        eq(wishlists.isDefault, true)
      ),
    });

    if (!wishlist) return [];

    const items = await db.query.wishlistItems.findMany({
      where: eq(wishlistItems.wishlistId, wishlist.id),
      columns: { productId: true },
    });

    return items.map((item) => item.productId);
  }
);
