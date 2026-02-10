"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  storeFollows,
  marketplaceProfiles,
  marketplaceStoreCategories,
  tenants,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth/server";
import { getTenantById } from "@/lib/db/queries/tenants";

// =============================================================================
// INFINITE SCROLL — fetch more stores
// =============================================================================

export async function fetchMoreStores(options: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  city?: string;
  sort?: "recommended" | "newest" | "rating" | "popular" | "name";
}) {
  const { getMarketplaceStores } = await import("@/lib/db/queries/marketplace");
  return getMarketplaceStores(options);
}

// =============================================================================
// FOLLOW / UNFOLLOW
// =============================================================================

export async function followStore(tenantId: string) {
  const user = await getUser();
  if (!user) {
    return { error: "You must be logged in to follow stores" };
  }

  try {
    // Check if already following
    const existing = await db
      .select({ id: storeFollows.id })
      .from(storeFollows)
      .where(
        and(
          eq(storeFollows.userId, user.id),
          eq(storeFollows.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: true }; // Already following
    }

    await db.insert(storeFollows).values({
      userId: user.id,
      tenantId,
    });

    return { success: true };
  } catch {
    return { error: "Failed to follow store" };
  }
}

export async function unfollowStore(tenantId: string) {
  const user = await getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }

  try {
    await db
      .delete(storeFollows)
      .where(
        and(
          eq(storeFollows.userId, user.id),
          eq(storeFollows.tenantId, tenantId)
        )
      );

    return { success: true };
  } catch {
    return { error: "Failed to unfollow store" };
  }
}

// =============================================================================
// MARKETPLACE PROFILE SETTINGS
// =============================================================================

export type MarketplaceSettingsInput = {
  marketplaceEnabled: boolean;
  coverImage?: string | null;
  tags?: string[];
  featuredProductIds?: string[];
  priceRange?: number;
  categoryIds?: string[];
};

export async function updateMarketplaceProfile(
  storeId: string,
  storeSlug: string,
  settings: MarketplaceSettingsInput
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    // Update the marketplace toggle on the tenant
    await db
      .update(tenants)
      .set({
        marketplaceEnabled: settings.marketplaceEnabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, storeId));

    // Upsert marketplace profile
    const existing = await db
      .select({ id: marketplaceProfiles.id })
      .from(marketplaceProfiles)
      .where(eq(marketplaceProfiles.tenantId, storeId))
      .limit(1);

    const profileData = {
      coverImage: settings.coverImage ?? null,
      tags: settings.tags ?? [],
      featuredProductIds: settings.featuredProductIds ?? [],
      priceRange: settings.priceRange ?? 2,
      updatedAt: new Date().toISOString(),
    };

    if (existing.length > 0) {
      await db
        .update(marketplaceProfiles)
        .set(profileData)
        .where(eq(marketplaceProfiles.tenantId, storeId));
    } else {
      await db.insert(marketplaceProfiles).values({
        tenantId: storeId,
        ...profileData,
      });
    }

    // Sync categories
    if (settings.categoryIds !== undefined) {
      // Delete existing
      await db
        .delete(marketplaceStoreCategories)
        .where(eq(marketplaceStoreCategories.tenantId, storeId));

      // Insert new
      if (settings.categoryIds.length > 0) {
        await db.insert(marketplaceStoreCategories).values(
          settings.categoryIds.map((categoryId) => ({
            tenantId: storeId,
            categoryId,
          }))
        );
      }
    }

    revalidatePath(`/dashboard/${storeSlug}/settings/marketplace`, "page");
    revalidatePath("/marketplace", "page");
    revalidatePath(`/marketplace/stores/${storeSlug}`, "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update marketplace settings:", error);
    return {
      error: {
        message: "Failed to update marketplace settings. Please try again.",
      },
    };
  }
}
