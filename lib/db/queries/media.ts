import { db } from "@/lib/db";
import { media, productImages, categories } from "@/lib/db/schema";
import { eq, desc, and, ilike, count, inArray } from "drizzle-orm";

export type MediaItem = typeof media.$inferSelect;

export interface MediaQueryOptions {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Get paginated media library for a tenant
 */
export async function getMediaLibrary(
  tenantId: string,
  options: MediaQueryOptions = {}
) {
  const { search, page = 1, limit = 24 } = options;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(media.tenantId, tenantId)];

  if (search) {
    conditions.push(ilike(media.fileName, `%${search}%`));
  }

  const whereClause = and(...conditions);

  // Get total count for pagination
  const [countResult] = await db
    .select({ count: count() })
    .from(media)
    .where(whereClause);

  const totalCount = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get media items
  const items = await db
    .select()
    .from(media)
    .where(whereClause)
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Get a single media item by ID
 */
export async function getMediaById(
  tenantId: string,
  mediaId: string
): Promise<MediaItem | null> {
  const [item] = await db
    .select()
    .from(media)
    .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)));

  return item ?? null;
}

/**
 * Get multiple media items by IDs
 */
export async function getMediaByIds(
  tenantId: string,
  mediaIds: string[]
): Promise<MediaItem[]> {
  if (mediaIds.length === 0) return [];

  const items = await db
    .select()
    .from(media)
    .where(and(eq(media.tenantId, tenantId), inArray(media.id, mediaIds)));

  return items;
}

/**
 * Get recent media items (for quick selection in media selector)
 */
export async function getRecentMedia(
  tenantId: string,
  limit: number = 12
): Promise<MediaItem[]> {
  const items = await db
    .select()
    .from(media)
    .where(eq(media.tenantId, tenantId))
    .orderBy(desc(media.createdAt))
    .limit(limit);

  return items;
}

/**
 * Get media usage count (how many products/categories use this media)
 */
export async function getMediaUsageCount(
  tenantId: string,
  mediaId: string
): Promise<{ productCount: number; categoryCount: number }> {
  // Count usage in product_images
  const [productResult] = await db
    .select({ count: count() })
    .from(productImages)
    .where(eq(productImages.mediaId, mediaId));

  // Count usage in categories
  const [categoryResult] = await db
    .select({ count: count() })
    .from(categories)
    .where(
      and(eq(categories.tenantId, tenantId), eq(categories.imageId, mediaId))
    );

  return {
    productCount: productResult?.count ?? 0,
    categoryCount: categoryResult?.count ?? 0,
  };
}
