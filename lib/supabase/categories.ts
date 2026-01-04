"use server";

import { db } from "@/lib/db";
import { categories, media } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  categorySchema,
  reorderCategoriesSchema,
  type CategoryInput,
  type ReorderCategoriesInput,
} from "@/lib/validations/categories";
import { getMaxCategoryDisplayOrder } from "@/lib/db/queries/categories";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Create a new category
 */
export async function createCategory(
  tenantId: string,
  input: CategoryInput
): Promise<ActionResult<{ id: string }>> {
  const result = categorySchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Auto-generate unique slug from name
  const { generateUniqueCategorySlug } = await import("@/lib/db/queries/slugs");
  const slug = await generateUniqueCategorySlug(tenantId, input.name);

  // Get max display order if not specified
  let displayOrder = input.displayOrder;
  if (displayOrder === 0) {
    const maxOrder = await getMaxCategoryDisplayOrder(tenantId);
    displayOrder = maxOrder + 1;
  }

  const [category] = await db
    .insert(categories)
    .values({
      tenantId,
      name: input.name,
      slug,
      description: input.description || null,
      imageId: input.imageId || null,
      displayOrder,
    })
    .returning({ id: categories.id });

  return { success: true, data: { id: category.id } };
}

/**
 * Update an existing category
 */
export async function updateCategory(
  tenantId: string,
  categoryId: string,
  input: CategoryInput
): Promise<ActionResult> {
  const result = categorySchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Auto-generate unique slug from name
  const { generateUniqueCategorySlug } = await import("@/lib/db/queries/slugs");
  const slug = await generateUniqueCategorySlug(tenantId, input.name, categoryId);

  await db
    .update(categories)
    .set({
      name: input.name,
      slug,
      description: input.description || null,
      imageId: input.imageId || null,
      displayOrder: input.displayOrder,
      updatedAt: new Date(),
    })
    .where(
      and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId))
    );

  return { success: true };
}

/**
 * Delete a category
 */
export async function deleteCategory(
  tenantId: string,
  categoryId: string
): Promise<ActionResult> {
  // Note: Products with this category will have their categoryId set to null
  // due to the "set null" foreign key constraint
  await db
    .delete(categories)
    .where(
      and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId))
    );

  return { success: true };
}

/**
 * Reorder categories (update display order)
 */
export async function reorderCategories(
  tenantId: string,
  input: ReorderCategoriesInput
): Promise<ActionResult> {
  const result = reorderCategoriesSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: { message: issue.message },
    };
  }

  // Update each category's display order based on its position in the array
  const updates = input.categoryIds.map((id, index) =>
    db
      .update(categories)
      .set({ displayOrder: index, updatedAt: new Date() })
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
  );

  await Promise.all(updates);

  return { success: true };
}

/**
 * Helper to upload a file to storage and create media record
 */
async function uploadFileToStorage(
  tenantId: string,
  userId: string,
  file: File
): Promise<{ id: string; url: string } | null> {
  console.log("📁 [uploadFileToStorage] Starting upload...", {
    tenantId,
    userId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });

  try {
    const supabase = await createClient();
    console.log("✅ [uploadFileToStorage] Supabase client created");

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${ext}`;
    const filePath = `${tenantId}/${fileName}`;
    console.log("📝 [uploadFileToStorage] Generated file path:", filePath);

    // Upload to storage
    console.log("⬆️ [uploadFileToStorage] Uploading to storage bucket 'media'...");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ [uploadFileToStorage] Storage upload error:", uploadError);
      return null;
    }
    console.log("✅ [uploadFileToStorage] File uploaded to storage:", uploadData);

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);
    console.log("🔗 [uploadFileToStorage] Public URL generated:", publicUrl);

    // Create media record
    console.log("💾 [uploadFileToStorage] Creating media record in database...");
    const [mediaRecord] = await db
      .insert(media)
      .values({
        tenantId,
        uploadedById: userId,
        url: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
      .returning({ id: media.id, url: media.url });

    if (!mediaRecord) {
      console.error("❌ [uploadFileToStorage] Failed to create media record");
      return null;
    }
    console.log("✅ [uploadFileToStorage] Media record created:", mediaRecord);

    return { id: mediaRecord.id, url: mediaRecord.url };
  } catch (error) {
    console.error("❌ [uploadFileToStorage] Unexpected error:", error);
    return null;
  }
}

/**
 * Create a new category with optional staged image file
 */
export async function createCategoryWithImage(
  tenantId: string,
  input: CategoryInput,
  stagedFile: File | null
): Promise<ActionResult<{ id: string }>> {
  console.log("🚀 [createCategoryWithImage] Starting...", {
    tenantId,
    input,
    hasStagedFile: !!stagedFile,
    fileSize: stagedFile?.size,
    fileName: stagedFile?.name,
  });

  const user = await getUser();
  if (!user) {
    console.log("❌ [createCategoryWithImage] User not authenticated");
    return {
      success: false,
      error: { message: "Not authenticated" },
    };
  }
  console.log("✅ [createCategoryWithImage] User authenticated:", user.id);

  const result = categorySchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    console.log("❌ [createCategoryWithImage] Validation failed:", issue);
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }
  console.log("✅ [createCategoryWithImage] Validation passed");

  // Auto-generate unique slug from name
  const { generateUniqueCategorySlug } = await import("@/lib/db/queries/slugs");
  const slug = await generateUniqueCategorySlug(tenantId, input.name);
  console.log("✅ [createCategoryWithImage] Generated unique slug:", slug);

  // Upload staged file if provided
  let imageId = input.imageId || null;
  if (stagedFile) {
    console.log("📤 [createCategoryWithImage] Uploading staged file...");
    const uploadResult = await uploadFileToStorage(tenantId, user.id, stagedFile);
    if (uploadResult) {
      imageId = uploadResult.id;
      console.log("✅ [createCategoryWithImage] File uploaded successfully:", {
        imageId,
        url: uploadResult.url,
      });
    } else {
      console.log("❌ [createCategoryWithImage] File upload failed");
      return {
        success: false,
        error: {
          message: "Failed to upload image. Please try again.",
        },
      };
    }
  } else {
    console.log("ℹ️ [createCategoryWithImage] No staged file to upload");
  }

  // Get max display order if not specified
  let displayOrder = input.displayOrder;
  if (displayOrder === 0) {
    console.log("🔢 [createCategoryWithImage] Getting max display order...");
    const maxOrder = await getMaxCategoryDisplayOrder(tenantId);
    displayOrder = maxOrder + 1;
    console.log("✅ [createCategoryWithImage] Display order set to:", displayOrder);
  }

  try {
    console.log("💾 [createCategoryWithImage] Inserting category into database...");
    const [category] = await db
      .insert(categories)
      .values({
        tenantId,
        name: input.name,
        slug,
        description: input.description || null,
        imageId,
        displayOrder,
      })
      .returning({ id: categories.id });

    console.log("✅ [createCategoryWithImage] Category created successfully:", category.id);
    return { success: true, data: { id: category.id } };
  } catch (error) {
    console.error("❌ [createCategoryWithImage] Error creating category:", error);
    return {
      success: false,
      error: {
        message: "Failed to create category. Please try again.",
      },
    };
  }
}

/**
 * Update an existing category with optional staged image file
 */
export async function updateCategoryWithImage(
  tenantId: string,
  categoryId: string,
  input: CategoryInput,
  stagedFile: File | null
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "Not authenticated" },
    };
  }

  const result = categorySchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  // Auto-generate unique slug from name
  const { generateUniqueCategorySlug } = await import("@/lib/db/queries/slugs");
  const slug = await generateUniqueCategorySlug(tenantId, input.name, categoryId);

  // Upload staged file if provided
  let imageId = input.imageId || null;
  if (stagedFile) {
    const uploadResult = await uploadFileToStorage(tenantId, user.id, stagedFile);
    if (uploadResult) {
      imageId = uploadResult.id;
    } else {
      return {
        success: false,
        error: {
          message: "Failed to upload image. Please try again.",
        },
      };
    }
  }

  try {
    await db
      .update(categories)
      .set({
        name: input.name,
        slug,
        description: input.description || null,
        imageId,
        displayOrder: input.displayOrder,
        updatedAt: new Date(),
      })
      .where(
        and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId))
      );

    return { success: true };
  } catch (error) {
    console.error("Error updating category:", error);
    return {
      success: false,
      error: {
        message: "Failed to update category. Please try again.",
      },
    };
  }
}
