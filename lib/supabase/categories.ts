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
import {
  checkCategorySlugAvailable,
  getMaxCategoryDisplayOrder,
} from "@/lib/db/queries/categories";
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

  // Check slug uniqueness
  const isSlugAvailable = await checkCategorySlugAvailable(tenantId, input.slug);
  if (!isSlugAvailable) {
    return {
      success: false,
      error: {
        message: "This URL is already in use. Please choose a different one.",
        field: "slug",
      },
    };
  }

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
      slug: input.slug,
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

  // Check slug uniqueness (excluding current category)
  const isSlugAvailable = await checkCategorySlugAvailable(
    tenantId,
    input.slug,
    categoryId
  );
  if (!isSlugAvailable) {
    return {
      success: false,
      error: {
        message: "This URL is already in use. Please choose a different one.",
        field: "slug",
      },
    };
  }

  await db
    .update(categories)
    .set({
      name: input.name,
      slug: input.slug,
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
  const supabase = await createClient();

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${ext}`;
  const filePath = `${tenantId}/${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, file);

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return null;
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(filePath);

  // Create media record
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
    .returning({ id: media.id });

  return { id: mediaRecord.id, url: publicUrl };
}

/**
 * Create a new category with optional staged image file
 */
export async function createCategoryWithImage(
  tenantId: string,
  input: CategoryInput,
  stagedFile: File | null
): Promise<ActionResult<{ id: string }>> {
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

  // Check slug uniqueness
  const isSlugAvailable = await checkCategorySlugAvailable(tenantId, input.slug);
  if (!isSlugAvailable) {
    return {
      success: false,
      error: {
        message: "This URL is already in use. Please choose a different one.",
        field: "slug",
      },
    };
  }

  // Upload staged file if provided
  let imageId = input.imageId || null;
  if (stagedFile) {
    const uploadResult = await uploadFileToStorage(tenantId, user.id, stagedFile);
    if (uploadResult) {
      imageId = uploadResult.id;
    }
  }

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
      slug: input.slug,
      description: input.description || null,
      imageId,
      displayOrder,
    })
    .returning({ id: categories.id });

  return { success: true, data: { id: category.id } };
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

  // Check slug uniqueness (excluding current category)
  const isSlugAvailable = await checkCategorySlugAvailable(
    tenantId,
    input.slug,
    categoryId
  );
  if (!isSlugAvailable) {
    return {
      success: false,
      error: {
        message: "This URL is already in use. Please choose a different one.",
        field: "slug",
      },
    };
  }

  // Upload staged file if provided
  let imageId = input.imageId || null;
  if (stagedFile) {
    const uploadResult = await uploadFileToStorage(tenantId, user.id, stagedFile);
    if (uploadResult) {
      imageId = uploadResult.id;
    }
  }

  await db
    .update(categories)
    .set({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      imageId,
      displayOrder: input.displayOrder,
      updatedAt: new Date(),
    })
    .where(
      and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId))
    );

  return { success: true };
}
