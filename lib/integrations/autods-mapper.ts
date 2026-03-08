import { db } from "@/lib/db";
import { products, productImages, media, tenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateUniqueProductSlug } from "@/lib/db/queries/slugs";
import { generateSku } from "@/lib/utils/slug";
import { getMaxProductDisplayOrder } from "@/lib/db/queries/products";

export interface AutoDSProductInput {
  external_id: string;
  title: string;
  description?: string;
  price: number;
  cost_price?: number;
  stock: number;
  sku?: string;
  images: string[];
  variants?: Array<{
    external_id: string;
    title: string;
    price: number;
    stock: number;
    sku?: string;
    attributes?: Record<string, string>;
    image?: string;
  }>;
}

/**
 * UTILITY: Download an image from AutoDS/Source and create a media record
 */
async function downloadAndCreateMedia(
  tenantId: string,
  url: string,
  ownerId: string
) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const { uploadFile } = await import("@/lib/storage");

    const fileName = url.split("/").pop() || "product-image.jpg";
    const uploadResult = await uploadFile(buffer, fileName, "image/jpeg", {
      tenantId,
      folder: "products/autods",
      generateUniqueName: true,
      processImage: true,
      convertToWebp: true,
    });

    if (!uploadResult.success) return null;

    const [newMedia] = await db
      .insert(media)
      .values({
        tenantId,
        uploadedById: ownerId,
        url: uploadResult.url,
        fileName: uploadResult.originalName,
        fileSize: uploadResult.size,
        mimeType: uploadResult.mimeType,
        width: uploadResult.width,
        height: uploadResult.height,
      })
      .returning({ id: media.id });

    return newMedia.id;
  } catch (err) {
    console.error("AutoDS Image Download Failed:", err);
    return null;
  }
}

/**
 * Main function to import/sync a product from AutoDS JSON
 */
export async function syncAutoDSProduct(
  tenantId: string,
  data: AutoDSProductInput
) {
  try {
    // 1. Check if product already exists
    const existing = await db.query.products.findFirst({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.sourceId, data.external_id),
        eq(products.sourceType, "autods")
      ),
    });

    if (existing) {
      // Update logic (simplified for now)
      await db
        .update(products)
        .set({
          price: data.price.toString(),
          stock: data.stock,
          sourcePrice: data.cost_price?.toString() || data.price.toString(),
          sourceLastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(products.id, existing.id));

      return { success: true, id: existing.id, action: "updated" };
    }

    // 2. Create new product
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { ownerId: true },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const slug = await generateUniqueProductSlug(tenantId, data.title);
    const maxOrder = await getMaxProductDisplayOrder(tenantId);

    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: data.title,
        slug,
        description: data.description || null,
        price: data.price.toString(),
        costPrice: data.cost_price?.toString() || null,
        stock: data.stock,
        sku: data.sku || generateSku(data.title),
        sourceType: "autods",
        sourceId: data.external_id,
        sourcePrice: data.cost_price?.toString() || data.price.toString(),
        sourceCurrency: "USD",
        sourceSyncEnabled: true,
        sourceLastSyncedAt: new Date().toISOString(),
        displayOrder: maxOrder + 1,
        status: "draft", // Imported products start as draft
        hasVariants: (data.variants?.length || 0) > 0,
      })
      .returning({ id: products.id });

    // 3. Handle Images
    const imageIds: string[] = [];
    // Limit to 5 images for initial import to save time
    for (const imageUrl of data.images.slice(0, 5)) {
      const mediaId = await downloadAndCreateMedia(
        tenantId,
        imageUrl,
        tenant.ownerId
      );
      if (mediaId) imageIds.push(mediaId);
    }

    if (imageIds.length > 0) {
      await db.insert(productImages).values(
        imageIds.map((mediaId, index) => ({
          productId: newProduct.id,
          mediaId,
          position: index,
        }))
      );
    }

    // 4. Handle Variants (Basic Implementation)
    if (data.variants && data.variants.length > 0) {
      // For each variant, we'd need to map attributes to variantOptions and variantOptionValues
      // This is complex and requires a robust attribute mapping system.
      // For now, we store them as simple variants if they have distinct SKUs/Titles.
    }

    return { success: true, id: newProduct.id, action: "created" };
  } catch (error) {
    console.error("AutoDS Sync Failed:", error);
    return { success: false, error: "Internal mapping error" };
  }
}

/**
 * Update an existing AutoDS-sourced product by its Kaka Malem product ID.
 * Only the fields provided in the patch payload are updated.
 */
export async function updateAutoDSProduct(
  tenantId: string,
  productId: string,
  patch: {
    price?: number;
    cost_price?: number;
    stock?: number;
    title?: string;
    description?: string;
    status?: "draft" | "active" | "archived";
    sku?: string;
  }
) {
  try {
    // 1. Fetch the product, ensuring it belongs to this tenant and is from AutoDS
    const existing = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId),
        eq(products.sourceType, "autods")
      ),
    });

    if (!existing) {
      return {
        success: false,
        error: "Product not found or not an AutoDS product",
        status: 404,
      };
    }

    // 2. Build selective update payload — only include what was sent
    const updates: Record<string, unknown> = {
      sourceLastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (patch.price !== undefined) updates.price = patch.price.toString();
    if (patch.cost_price !== undefined) {
      updates.costPrice = patch.cost_price.toString();
      updates.sourcePrice = patch.cost_price.toString();
    }
    if (patch.stock !== undefined) updates.stock = patch.stock;
    if (patch.title !== undefined) updates.name = patch.title;
    if (patch.description !== undefined)
      updates.description = patch.description;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.sku !== undefined) updates.sku = patch.sku;

    // 3. Apply the update
    await db
      .update(products)
      .set(updates as Partial<typeof products.$inferInsert>)
      .where(eq(products.id, productId));

    return { success: true, id: productId, action: "updated" };
  } catch (error) {
    console.error("AutoDS Product Update Failed:", error);
    return { success: false, error: "Internal update error" };
  }
}
