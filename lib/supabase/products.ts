"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { products, productImages, productCategories, media } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { productSchema, type ProductInput } from "@/lib/validations/products";
import { generateUniqueProductSlug } from "@/lib/db/queries/slugs";
import { getUser } from "@/lib/supabase/auth";

export type ProductActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
  data?: {
    id: string;
    slug: string;
  };
};

/**
 * Create a new product
 */
export async function createProduct(
  tenantId: string,
  input: ProductInput
): Promise<ProductActionResult> {
  try {
    // Validate input
    const result = productSchema.safeParse(input);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return {
        success: false,
        error: {
          message: firstError.message,
          field: firstError.path[0] as string,
        },
      };
    }

    const data = result.data;

    // Auto-generate unique slug from product name (industry standard approach)
    const uniqueSlug = await generateUniqueProductSlug(tenantId, data.name);

    // Create product
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: data.name,
        slug: uniqueSlug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        showStock: data.showStock,
        weight: data.weight && data.weight !== "" ? data.weight : null,
        length: data.length && data.length !== "" ? data.length : null,
        width: data.width && data.width !== "" ? data.width : null,
        height: data.height && data.height !== "" ? data.height : null,
        isActive: data.isActive,
        displayOrder: parseInt(data.displayOrder || "0"),
      })
      .returning({ id: products.id, slug: products.slug });

    // Add product images if provided
    if (data.imageIds && data.imageIds.length > 0) {
      const imageValues = data.imageIds.map((mediaId, index) => ({
        productId: newProduct.id,
        mediaId,
        position: index,
      }));

      await db.insert(productImages).values(imageValues);
    }

    // Add product categories if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoryValues = data.categoryIds.map((categoryId) => ({
        productId: newProduct.id,
        categoryId,
      }));

      await db.insert(productCategories).values(categoryValues);
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: {
        id: newProduct.id,
        slug: newProduct.slug,
      },
    };
  } catch (error) {
    console.error("Error creating product:", error);

    // Provide more specific error messages based on error type
    let errorMessage = "Failed to create product. Please try again.";

    if (error instanceof Error) {
      // Database constraint violations
      if (error.message.includes("unique constraint")) {
        errorMessage = "A product with this name already exists in your store.";
      } else if (error.message.includes("foreign key constraint")) {
        errorMessage = "Invalid category or media reference.";
      } else if (error.message.includes("not null constraint")) {
        errorMessage = "Missing required product information.";
      } else if (error.message.includes("permission denied") || error.message.includes("RLS")) {
        errorMessage = "You don't have permission to create products.";
      } else {
        // Include error details in development/debugging
        errorMessage = `Failed to create product: ${error.message}`;
      }
    }

    return {
      success: false,
      error: {
        message: errorMessage,
      },
    };
  }
}

/**
 * Helper function to upload a file to storage and create media entry
 */
async function uploadFileToStorage(
  tenantId: string,
  userId: string,
  file: File
): Promise<{ id: string; url: string } | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Generate unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(fileName);

    // Save to media table
    const [newMedia] = await db
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

    return newMedia;
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

/**
 * Create a new product with staged image uploads
 * Images are uploaded during form submission, not before
 * Uses database transaction for atomicity
 */
export async function createProductWithImages(
  tenantId: string,
  input: ProductInput,
  stagedFiles: File[]
): Promise<ProductActionResult> {
  const uploadedMediaIds: string[] = [];

  try {
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        error: { message: "Not authenticated" },
      };
    }

    // Validate input
    const result = productSchema.safeParse(input);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return {
        success: false,
        error: {
          message: firstError.message,
          field: firstError.path[0] as string,
        },
      };
    }

    const data = result.data;

    // Auto-generate unique slug from product name
    const uniqueSlug = await generateUniqueProductSlug(tenantId, data.name);

    // Upload staged files first (storage operations cannot be in transaction)
    for (const file of stagedFiles) {
      const uploaded = await uploadFileToStorage(tenantId, user.id, file);
      if (uploaded) {
        uploadedMediaIds.push(uploaded.id);
      }
    }

    // Combine existing media IDs with newly uploaded ones
    // Existing IDs come first, then new uploads (to maintain order)
    const allImageIds = [...(data.imageIds || []), ...uploadedMediaIds];

    // Use database transaction for all DB operations (atomic)
    const newProduct = await db.transaction(async (tx) => {
      // Create product
      const [product] = await tx
        .insert(products)
        .values({
          tenantId,
          name: data.name,
          slug: uniqueSlug,
          description: data.description || null,
          price: data.price,
          categoryId: data.categoryId || null,
          trackInventory: data.trackInventory,
          stock: parseInt(data.stock || "0"),
          allowBackorder: data.allowBackorder,
          lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
          showStock: data.showStock,
          weight: data.weight && data.weight !== "" ? data.weight : null,
          length: data.length && data.length !== "" ? data.length : null,
          width: data.width && data.width !== "" ? data.width : null,
          height: data.height && data.height !== "" ? data.height : null,
          isActive: data.isActive,
          displayOrder: parseInt(data.displayOrder || "0"),
        })
        .returning({ id: products.id, slug: products.slug });

      // Add product images if provided
      if (allImageIds.length > 0) {
        const imageValues = allImageIds.map((mediaId, index) => ({
          productId: product.id,
          mediaId,
          position: index,
        }));

        await tx.insert(productImages).values(imageValues);
      }

      // Add product categories if provided
      if (data.categoryIds && data.categoryIds.length > 0) {
        const categoryValues = data.categoryIds.map((categoryId) => ({
          productId: product.id,
          categoryId,
        }));

        await tx.insert(productCategories).values(categoryValues);
      }

      return product;
    });

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: {
        id: newProduct.id,
        slug: newProduct.slug,
      },
    };
  } catch (error) {
    console.error("Error creating product with images:", error);

    // Clean up uploaded media if product creation failed
    if (uploadedMediaIds.length > 0) {
      await cleanupOrphanedMedia(uploadedMediaIds).catch(cleanupError => {
        console.error("Error cleaning up orphaned media:", cleanupError);
      });
    }

    // Provide more specific error messages based on error type
    let errorMessage = "Failed to create product. Please try again.";

    if (error instanceof Error) {
      // Storage/upload errors
      if (error.message.includes("storage") || error.message.includes("upload")) {
        errorMessage = "Failed to upload product images. Please try again.";
      } else if (error.message.includes("unique constraint")) {
        errorMessage = "A product with this name already exists in your store.";
      } else if (error.message.includes("foreign key constraint")) {
        errorMessage = "Invalid category or media reference.";
      } else if (error.message.includes("not null constraint")) {
        errorMessage = "Missing required product information.";
      } else if (error.message.includes("permission denied") || error.message.includes("RLS")) {
        errorMessage = "You don't have permission to create products.";
      } else {
        // Include error details in development/debugging
        errorMessage = `Failed to create product: ${error.message}`;
      }
    }

    return {
      success: false,
      error: {
        message: errorMessage,
      },
    };
  }
}

/**
 * Update an existing product with staged image uploads
 * Images are uploaded during form submission, not before
 * Uses database transaction for atomicity
 */
export async function updateProductWithImages(
  tenantId: string,
  productId: string,
  input: ProductInput,
  stagedFiles: File[]
): Promise<ProductActionResult> {
  const uploadedMediaIds: string[] = [];

  try {
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        error: { message: "Not authenticated" },
      };
    }

    // Validate input
    const result = productSchema.safeParse(input);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return {
        success: false,
        error: {
          message: firstError.message,
          field: firstError.path[0] as string,
        },
      };
    }

    const data = result.data;

    // Auto-generate unique slug from product name (update case)
    const uniqueSlug = await generateUniqueProductSlug(tenantId, data.name, productId);

    // Upload staged files first (storage operations cannot be in transaction)
    for (const file of stagedFiles) {
      const uploaded = await uploadFileToStorage(tenantId, user.id, file);
      if (uploaded) {
        uploadedMediaIds.push(uploaded.id);
      }
    }

    // Combine existing media IDs with newly uploaded ones
    const allImageIds = [...(data.imageIds || []), ...uploadedMediaIds];

    // Use database transaction for all DB operations (atomic)
    const updatedProduct = await db.transaction(async (tx) => {
      // Update product
      const [product] = await tx
        .update(products)
        .set({
          name: data.name,
          slug: uniqueSlug,
          description: data.description || null,
          price: data.price,
          categoryId: data.categoryId || null,
          trackInventory: data.trackInventory,
          stock: parseInt(data.stock || "0"),
          allowBackorder: data.allowBackorder,
          lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
          showStock: data.showStock,
          weight: data.weight && data.weight !== "" ? data.weight : null,
          length: data.length && data.length !== "" ? data.length : null,
          width: data.width && data.width !== "" ? data.width : null,
          height: data.height && data.height !== "" ? data.height : null,
          isActive: data.isActive,
          displayOrder: parseInt(data.displayOrder || "0"),
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .returning({ id: products.id, slug: products.slug });

      if (!product) {
        throw new Error("Product not found");
      }

      // Update product images
      // First, delete existing images
      await tx
        .delete(productImages)
        .where(eq(productImages.productId, productId));

      // Then, add new images
      if (allImageIds.length > 0) {
        const imageValues = allImageIds.map((mediaId, index) => ({
          productId: productId,
          mediaId,
          position: index,
        }));

        await tx.insert(productImages).values(imageValues);
      }

      // Update product categories
      // First, delete existing categories
      await tx
        .delete(productCategories)
        .where(eq(productCategories.productId, productId));

      // Then, add new categories
      if (data.categoryIds && data.categoryIds.length > 0) {
        const categoryValues = data.categoryIds.map((categoryId) => ({
          productId: productId,
          categoryId,
        }));

        await tx.insert(productCategories).values(categoryValues);
      }

      return product;
    });

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: {
        id: updatedProduct.id,
        slug: updatedProduct.slug,
      },
    };
  } catch (error) {
    console.error("Error updating product with images:", error);

    // Clean up uploaded media if product update failed
    if (uploadedMediaIds.length > 0) {
      await cleanupOrphanedMedia(uploadedMediaIds).catch(cleanupError => {
        console.error("Error cleaning up orphaned media:", cleanupError);
      });
    }

    // Provide more specific error messages based on error type
    let errorMessage = "Failed to update product. Please try again.";

    if (error instanceof Error) {
      // Storage/upload errors
      if (error.message.includes("storage") || error.message.includes("upload")) {
        errorMessage = "Failed to upload product images. Please try again.";
      } else if (error.message.includes("unique constraint")) {
        errorMessage = "A product with this name already exists in your store.";
      } else if (error.message.includes("foreign key constraint")) {
        errorMessage = "Invalid category or media reference.";
      } else if (error.message.includes("not null constraint")) {
        errorMessage = "Missing required product information.";
      } else if (error.message.includes("permission denied") || error.message.includes("RLS")) {
        errorMessage = "You don't have permission to update this product.";
      } else {
        // Include error details in development/debugging
        errorMessage = `Failed to update product: ${error.message}`;
      }
    }

    return {
      success: false,
      error: {
        message: errorMessage,
      },
    };
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  tenantId: string,
  productId: string,
  input: ProductInput
): Promise<ProductActionResult> {
  try {
    // Validate input
    const result = productSchema.safeParse(input);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return {
        success: false,
        error: {
          message: firstError.message,
          field: firstError.path[0] as string,
        },
      };
    }

    const data = result.data;

    // Auto-generate unique slug from product name (update case)
    const uniqueSlug = await generateUniqueProductSlug(tenantId, data.name, productId);

    // Update product
    const [updatedProduct] = await db
      .update(products)
      .set({
        name: data.name,
        slug: uniqueSlug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        showStock: data.showStock,
        weight: data.weight && data.weight !== "" ? data.weight : null,
        length: data.length && data.length !== "" ? data.length : null,
        width: data.width && data.width !== "" ? data.width : null,
        height: data.height && data.height !== "" ? data.height : null,
        isActive: data.isActive,
        displayOrder: parseInt(data.displayOrder || "0"),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
      .returning({ id: products.id, slug: products.slug });

    if (!updatedProduct) {
      return {
        success: false,
        error: {
          message: "Product not found",
        },
      };
    }

    // Update product images
    // First, delete existing images
    await db
      .delete(productImages)
      .where(eq(productImages.productId, productId));

    // Then, add new images
    if (data.imageIds && data.imageIds.length > 0) {
      const imageValues = data.imageIds.map((mediaId, index) => ({
        productId: productId,
        mediaId,
        position: index,
      }));

      await db.insert(productImages).values(imageValues);
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: {
        id: updatedProduct.id,
        slug: updatedProduct.slug,
      },
    };
  } catch (error) {
    console.error("Error updating product:", error);

    // Provide more specific error messages based on error type
    let errorMessage = "Failed to update product. Please try again.";

    if (error instanceof Error) {
      // Database constraint violations
      if (error.message.includes("unique constraint")) {
        errorMessage = "A product with this name already exists in your store.";
      } else if (error.message.includes("foreign key constraint")) {
        errorMessage = "Invalid category or media reference.";
      } else if (error.message.includes("not null constraint")) {
        errorMessage = "Missing required product information.";
      } else if (error.message.includes("permission denied") || error.message.includes("RLS")) {
        errorMessage = "You don't have permission to update this product.";
      } else {
        // Include error details in development/debugging
        errorMessage = `Failed to update product: ${error.message}`;
      }
    }

    return {
      success: false,
      error: {
        message: errorMessage,
      },
    };
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(
  tenantId: string,
  productId: string
): Promise<ProductActionResult> {
  try {
    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
      .returning({ id: products.id, slug: products.slug });

    if (!deleted) {
      return {
        success: false,
        error: {
          message: "Product not found",
        },
      };
    }

    revalidatePath(`/dashboard`);

    return {
      success: true,
      data: {
        id: deleted.id,
        slug: deleted.slug,
      },
    };
  } catch (error) {
    console.error("Error deleting product:", error);
    return {
      success: false,
      error: {
        message: "Failed to delete product. Please try again.",
      },
    };
  }
}

/**
 * Bulk activate products
 */
export async function bulkActivateProducts(
  tenantId: string,
  productIds: string[]
): Promise<ProductActionResult> {
  try {
    await db
      .update(products)
      .set({ isActive: true, updatedAt: new Date() })
      .where(
        and(eq(products.tenantId, tenantId), inArray(products.id, productIds))
      );

    revalidatePath(`/dashboard`);

    return { success: true };
  } catch (error) {
    console.error("Error activating products:", error);
    return {
      success: false,
      error: {
        message: "Failed to activate products. Please try again.",
      },
    };
  }
}

/**
 * Bulk deactivate products
 */
export async function bulkDeactivateProducts(
  tenantId: string,
  productIds: string[]
): Promise<ProductActionResult> {
  try {
    await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(products.tenantId, tenantId), inArray(products.id, productIds))
      );

    revalidatePath(`/dashboard`);

    return { success: true };
  } catch (error) {
    console.error("Error deactivating products:", error);
    return {
      success: false,
      error: {
        message: "Failed to deactivate products. Please try again.",
      },
    };
  }
}

/**
 * Bulk delete products
 */
export async function bulkDeleteProducts(
  tenantId: string,
  productIds: string[]
): Promise<ProductActionResult> {
  try {
    await db
      .delete(products)
      .where(
        and(eq(products.tenantId, tenantId), inArray(products.id, productIds))
      );

    revalidatePath(`/dashboard`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting products:", error);
    return {
      success: false,
      error: {
        message: "Failed to delete products. Please try again.",
      },
    };
  }
}

/**
 * Reorder products
 */
export async function reorderProducts(
  tenantId: string,
  data: { productIds: string[] }
): Promise<ProductActionResult> {
  try {
    // Update display order for each product
    for (let i = 0; i < data.productIds.length; i++) {
      await db
        .update(products)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(
          and(eq(products.id, data.productIds[i]), eq(products.tenantId, tenantId))
        );
    }

    revalidatePath(`/dashboard`);

    return { success: true };
  } catch (error) {
    console.error("Error reordering products:", error);
    return {
      success: false,
      error: {
        message: "Failed to reorder products. Please try again.",
      },
    };
  }
}

/**
 * Upload media file to Supabase Storage
 */
export async function uploadProductImage(
  tenantId: string,
  file: File
): Promise<{
  success: boolean;
  error?: string;
  data?: { id: string; url: string };
}> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Import Supabase client dynamically to avoid issues
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Generate unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: "Failed to upload image" };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(fileName);

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
      .returning({ id: media.id, url: media.url });

    return {
      success: true,
      data: {
        id: newMedia.id,
        url: newMedia.url,
      },
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

/**
 * Clean up orphaned media records and storage files
 * Used when product creation fails after media upload
 */
async function cleanupOrphanedMedia(mediaIds: string[]): Promise<void> {
  try {
    if (mediaIds.length === 0) return;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get media records to find storage paths
    const mediaRecords = await db
      .select({ url: media.url })
      .from(media)
      .where(inArray(media.id, mediaIds));

    // Delete from storage
    for (const record of mediaRecords) {
      // Extract file path from public URL
      const url = new URL(record.url);
      const pathParts = url.pathname.split('/storage/v1/object/public/media/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage.from("media").remove([filePath]);
      }
    }

    // Delete media records from database
    await db.delete(media).where(inArray(media.id, mediaIds));

    console.log(`Cleaned up ${mediaIds.length} orphaned media records`);
  } catch (error) {
    console.error("Error in cleanupOrphanedMedia:", error);
    // Don't throw - this is a cleanup operation
  }
}
