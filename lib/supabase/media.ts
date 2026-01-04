"use server";

import { db } from "@/lib/db";
import { media, productImages, categories } from "@/lib/db/schema";
import { eq, and, desc, ilike, count } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { z } from "zod";

export type MediaItem = typeof media.$inferSelect;

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

const updateAltTextSchema = z.object({
  altText: z.string().max(255, "Alt text must be 255 characters or less"),
});

interface MediaQueryOptions {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Get paginated media library for a tenant (server action wrapper)
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
 * Upload a media file to the library
 */
export async function uploadMedia(
  tenantId: string,
  file: File
): Promise<ActionResult<{ id: string; url: string; fileName: string }>> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: { message: "Not authenticated" } };
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { success: false, error: { message: "Only image files are allowed" } };
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: { message: "File size must be less than 5MB" } };
    }

    const supabase = await createClient();

    // Generate unique file name
    const fileExt = file.name.split(".").pop();
    const storagePath = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: { message: "Failed to upload image" } };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(storagePath);

    // Save to media table
    const [newMedia] = await db
      .insert(media)
      .values({
        tenantId,
        uploadedById: user.id,
        url: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
      .returning({ id: media.id, url: media.url, fileName: media.fileName });

    return {
      success: true,
      data: {
        id: newMedia.id,
        url: newMedia.url,
        fileName: newMedia.fileName || file.name,
      },
    };
  } catch (error) {
    console.error("Error uploading media:", error);
    return { success: false, error: { message: "Failed to upload image" } };
  }
}

/**
 * Update alt text for a media item
 */
export async function updateMediaAltText(
  tenantId: string,
  mediaId: string,
  altText: string
): Promise<ActionResult> {
  const validation = updateAltTextSchema.safeParse({ altText });
  if (!validation.success) {
    return {
      success: false,
      error: { message: validation.error.issues[0].message },
    };
  }

  await db
    .update(media)
    .set({ altText: altText || null })
    .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)));

  return { success: true };
}

/**
 * Delete a media item
 * Only allowed if not in use by any products or categories
 */
export async function deleteMedia(
  tenantId: string,
  mediaId: string
): Promise<ActionResult> {
  // Check if media is in use by products
  const productUsage = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(eq(productImages.mediaId, mediaId))
    .limit(1);

  if (productUsage.length > 0) {
    return {
      success: false,
      error: { message: "Cannot delete: this image is used by one or more products" },
    };
  }

  // Check if media is in use by categories
  const categoryUsage = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.imageId, mediaId)))
    .limit(1);

  if (categoryUsage.length > 0) {
    return {
      success: false,
      error: { message: "Cannot delete: this image is used by one or more categories" },
    };
  }

  // Get the media item to find storage path
  const [mediaItem] = await db
    .select({ url: media.url })
    .from(media)
    .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)));

  if (!mediaItem) {
    return { success: false, error: { message: "Media not found" } };
  }

  // Extract storage path from URL
  // URL format: https://xxx.supabase.co/storage/v1/object/public/media/[path]
  const url = new URL(mediaItem.url);
  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/media\/(.+)/);

  if (pathMatch) {
    const storagePath = pathMatch[1];
    const supabase = await createClient();

    // Delete from storage (don't fail if storage delete fails)
    await supabase.storage.from("media").remove([storagePath]);
  }

  // Delete from database
  await db
    .delete(media)
    .where(and(eq(media.tenantId, tenantId), eq(media.id, mediaId)));

  return { success: true };
}

/**
 * Force delete a media item (removes from products/categories first)
 */
export async function forceDeleteMedia(
  tenantId: string,
  mediaId: string
): Promise<ActionResult> {
  // Remove from product_images
  await db
    .delete(productImages)
    .where(eq(productImages.mediaId, mediaId));

  // Remove from categories (set imageId to null)
  await db
    .update(categories)
    .set({ imageId: null })
    .where(and(eq(categories.tenantId, tenantId), eq(categories.imageId, mediaId)));

  // Now delete the media item itself
  return deleteMedia(tenantId, mediaId);
}
