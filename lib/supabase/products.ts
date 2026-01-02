"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { products, productImages, media } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { productSchema, type ProductInput } from "@/lib/validations/products";
import { checkProductSlugAvailable } from "@/lib/db/queries/products";
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

    // Check if slug is available
    const slugAvailable = await checkProductSlugAvailable(tenantId, data.slug);
    if (!slugAvailable) {
      return {
        success: false,
        error: {
          message: "This product URL is already in use",
          field: "slug",
        },
      };
    }

    // Create product
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        weight: data.weight || null,
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
    return {
      success: false,
      error: {
        message: "Failed to create product. Please try again.",
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
      .from("product-images")
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
    } = supabase.storage.from("product-images").getPublicUrl(fileName);

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
 */
export async function createProductWithImages(
  tenantId: string,
  input: ProductInput,
  stagedFiles: File[]
): Promise<ProductActionResult> {
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

    // Check if slug is available
    const slugAvailable = await checkProductSlugAvailable(tenantId, data.slug);
    if (!slugAvailable) {
      return {
        success: false,
        error: {
          message: "This product URL is already in use",
          field: "slug",
        },
      };
    }

    // Upload staged files first
    const uploadedMediaIds: string[] = [];
    for (const file of stagedFiles) {
      const uploaded = await uploadFileToStorage(tenantId, user.id, file);
      if (uploaded) {
        uploadedMediaIds.push(uploaded.id);
      }
    }

    // Combine existing media IDs with newly uploaded ones
    // Existing IDs come first, then new uploads (to maintain order)
    const allImageIds = [...(data.imageIds || []), ...uploadedMediaIds];

    // Create product
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        weight: data.weight || null,
        isActive: data.isActive,
        displayOrder: parseInt(data.displayOrder || "0"),
      })
      .returning({ id: products.id, slug: products.slug });

    // Add product images if provided
    if (allImageIds.length > 0) {
      const imageValues = allImageIds.map((mediaId, index) => ({
        productId: newProduct.id,
        mediaId,
        position: index,
      }));

      await db.insert(productImages).values(imageValues);
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
    return {
      success: false,
      error: {
        message: "Failed to create product. Please try again.",
      },
    };
  }
}

/**
 * Update an existing product with staged image uploads
 * Images are uploaded during form submission, not before
 */
export async function updateProductWithImages(
  tenantId: string,
  productId: string,
  input: ProductInput,
  stagedFiles: File[]
): Promise<ProductActionResult> {
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

    // Check if slug is available (excluding current product)
    const slugAvailable = await checkProductSlugAvailable(
      tenantId,
      data.slug,
      productId
    );
    if (!slugAvailable) {
      return {
        success: false,
        error: {
          message: "This product URL is already in use",
          field: "slug",
        },
      };
    }

    // Upload staged files first
    const uploadedMediaIds: string[] = [];
    for (const file of stagedFiles) {
      const uploaded = await uploadFileToStorage(tenantId, user.id, file);
      if (uploaded) {
        uploadedMediaIds.push(uploaded.id);
      }
    }

    // Combine existing media IDs with newly uploaded ones
    const allImageIds = [...(data.imageIds || []), ...uploadedMediaIds];

    // Update product
    const [updatedProduct] = await db
      .update(products)
      .set({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        weight: data.weight || null,
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
    if (allImageIds.length > 0) {
      const imageValues = allImageIds.map((mediaId, index) => ({
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
    return {
      success: false,
      error: {
        message: "Failed to update product. Please try again.",
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

    // Check if slug is available (excluding current product)
    const slugAvailable = await checkProductSlugAvailable(
      tenantId,
      data.slug,
      productId
    );
    if (!slugAvailable) {
      return {
        success: false,
        error: {
          message: "This product URL is already in use",
          field: "slug",
        },
      };
    }

    // Update product
    const [updatedProduct] = await db
      .update(products)
      .set({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId || null,
        trackInventory: data.trackInventory,
        stock: parseInt(data.stock || "0"),
        allowBackorder: data.allowBackorder,
        lowStockThreshold: parseInt(data.lowStockThreshold || "0"),
        weight: data.weight || null,
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
    return {
      success: false,
      error: {
        message: "Failed to update product. Please try again.",
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
      .from("product-images")
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
    } = supabase.storage.from("product-images").getPublicUrl(fileName);

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
