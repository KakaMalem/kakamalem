import { db } from "@/lib/db";
import { products, productImages, productCategories } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uploadFile } from "@/lib/storage";
import { createMediaRecord } from "@/lib/actions/media";
import {
  createProductVariantsInBulk,
  syncProductStockFromVariants,
  type BulkVariantCreationInput,
} from "@/lib/actions/variants";
import { generateUniqueProductSlug } from "@/lib/db/queries/slugs";
import { generateSku } from "@/lib/utils/slug";
import { getMaxProductDisplayOrder } from "@/lib/db/queries/products";
import { canAddProduct } from "@/lib/db/queries/billing";
import {
  convertToAFN,
  getExchangeRates,
  type ExchangeRates,
} from "@/lib/currency";
import type { AliExpressProduct, AliExpressImportResult } from "./types";

// =============================================================================
// ALIEXPRESS → KAKA MALEM PRODUCT IMPORTER
// =============================================================================

const MAX_CONCURRENT_DOWNLOADS = 5;

interface ImportOptions {
  tenantId: string;
  /** Override product name */
  name?: string;
  /** Override price */
  price?: string;
  /** Product status (default: "draft") */
  status?: "draft" | "active";
  /** Category IDs to assign */
  categoryIds?: string[];
}

/**
 * Downloads an image from a URL and returns a Buffer
 */
async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith("//")
      ? `https:${url}`
      : url.startsWith("http")
        ? url
        : `https://${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*,*/*",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip if too small (likely a placeholder)
    if (buffer.length < 1000) return null;

    return { buffer, mimeType: contentType.split(";")[0].trim() };
  } catch {
    return null;
  }
}

/**
 * Downloads multiple images with concurrency limit
 */
async function downloadImagesWithLimit(
  urls: string[],
  limit: number
): Promise<
  ({ buffer: Buffer; mimeType: string; originalUrl: string } | null)[]
> {
  const results: ({
    buffer: Buffer;
    mimeType: string;
    originalUrl: string;
  } | null)[] = [];

  for (let i = 0; i < urls.length; i += limit) {
    const batch = urls.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await downloadImage(url);
        return result ? { ...result, originalUrl: url } : null;
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Upload a downloaded image to the storage system and create a media record
 */
async function uploadAndCreateMedia(
  tenantId: string,
  imageData: { buffer: Buffer; mimeType: string },
  altText: string
): Promise<string | null> {
  const extMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const ext = extMap[imageData.mimeType] || ".jpg";
  const filename = `aliexpress-import${ext}`;

  // Upload and process with Sharp
  const uploadResult = await uploadFile(
    imageData.buffer,
    filename,
    imageData.mimeType,
    {
      tenantId,
      folder: "products",
      generateUniqueName: true,
      processImage: true,
      convertToWebp: true,
    }
  );

  if (!uploadResult.success) return null;

  // Create media record in database
  const mediaResult = await createMediaRecord(tenantId, {
    url: uploadResult.url,
    fileName: uploadResult.filename,
    fileSize: uploadResult.size,
    mimeType: uploadResult.mimeType,
    altText,
    width: uploadResult.width,
    height: uploadResult.height,
  });

  if (!mediaResult.success || !mediaResult.data) return null;

  return mediaResult.data.id;
}

/**
 * Build product description from AliExpress data
 */
function buildDescription(product: AliExpressProduct): string {
  const parts: string[] = [];

  // Features
  if (product.features.length > 0) {
    parts.push("<h3>Features</h3>");
    parts.push("<ul>");
    for (const feat of product.features) {
      parts.push(`<li>${escapeHtml(feat)}</li>`);
    }
    parts.push("</ul>");
  }

  // Original description
  if (product.description) {
    parts.push("<h3>Description</h3>");
    parts.push(product.description);
  }

  // Specifications
  const specEntries = Object.entries(product.specifications);
  if (specEntries.length > 0) {
    parts.push("<h3>Specifications</h3>");
    parts.push("<table>");
    for (const [key, value] of specEntries) {
      parts.push(
        `<tr><td><strong>${escapeHtml(key)}</strong></td><td>${escapeHtml(value)}</td></tr>`
      );
    }
    parts.push("</table>");
  }

  // Store info
  if (product.storeName) {
    parts.push(
      `<p><strong>Seller:</strong> ${escapeHtml(product.storeName)}</p>`
    );
  }

  return parts.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Import an AliExpress product into the Kaka Malem system.
 *
 * This handles:
 * 1. Downloading and uploading all product images
 * 2. Creating the product record
 * 3. Creating variants (if any)
 * 4. Linking images to variants
 */
export async function importAliExpressProduct(
  aliProduct: AliExpressProduct,
  options: ImportOptions
): Promise<AliExpressImportResult> {
  const { tenantId, status = "draft" } = options;
  const warnings: string[] = [];

  try {
    // Check product limit
    const limitCheck = await canAddProduct(tenantId);
    if (!limitCheck.allowed) {
      return {
        success: false,
        warnings: [],
        error:
          limitCheck.reason ||
          "Product limit reached. Upgrade to add more products.",
      };
    }

    const productName = options.name || aliProduct.title;
    if (!productName) {
      return {
        success: false,
        warnings: [],
        error: "Product title is empty. Cannot create product.",
      };
    }

    // 1. Download and upload main product images
    const imageUrls = aliProduct.images.map((img) => img.url).filter(Boolean);

    const downloadedImages = await downloadImagesWithLimit(
      imageUrls,
      MAX_CONCURRENT_DOWNLOADS
    );

    const mediaIds: string[] = [];
    for (let i = 0; i < downloadedImages.length; i++) {
      const img = downloadedImages[i];
      if (!img) {
        warnings.push(`Failed to download image ${i + 1}`);
        continue;
      }

      const mediaId = await uploadAndCreateMedia(
        tenantId,
        img,
        `${productName} - Image ${i + 1}`
      );
      if (mediaId) {
        mediaIds.push(mediaId);
      } else {
        warnings.push(`Failed to upload image ${i + 1}`);
      }
    }

    if (mediaIds.length === 0 && imageUrls.length > 0) {
      warnings.push(
        "No images could be imported. The product was created without images."
      );
    }

    // 2. Build description
    const description = buildDescription(aliProduct);

    // 3. Determine price — convert from AliExpress currency to AFN if needed
    let rates: ExchangeRates | undefined;
    let price: string;

    if (options.price) {
      // User provided an explicit override (already in store currency)
      price = options.price;
    } else if (
      aliProduct.price !== null &&
      aliProduct.currency &&
      aliProduct.currency !== "AFN"
    ) {
      try {
        rates = await getExchangeRates();
        const convertedPrice = await convertToAFN(
          aliProduct.price,
          aliProduct.currency,
          rates
        );
        price = Math.round(convertedPrice).toString();
      } catch {
        warnings.push(
          `Currency conversion from ${aliProduct.currency} failed. Using original price.`
        );
        price = aliProduct.price.toString();
      }
    } else {
      price = aliProduct.price !== null ? aliProduct.price.toString() : "0";
    }

    // Convert originalPrice (compare-at price)
    let convertedCompareAtPrice: string | null = null;
    if (aliProduct.originalPrice !== null) {
      if (aliProduct.currency && aliProduct.currency !== "AFN") {
        try {
          if (!rates) rates = await getExchangeRates();
          const converted = await convertToAFN(
            aliProduct.originalPrice,
            aliProduct.currency,
            rates
          );
          convertedCompareAtPrice = Math.round(converted).toString();
        } catch {
          convertedCompareAtPrice = aliProduct.originalPrice.toString();
        }
      } else {
        convertedCompareAtPrice = aliProduct.originalPrice.toString();
      }
    }

    // 4. Generate slug and SKU
    const slug = await generateUniqueProductSlug(tenantId, productName);
    const sku = generateSku(productName);
    const maxDisplayOrder = await getMaxProductDisplayOrder(tenantId);

    // 5. Determine if product has variants
    const hasVariants =
      aliProduct.variantOptions.length > 0 && aliProduct.variants.length > 0;

    // 6. Create the product (with source tracking for AliExpress)
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: productName,
        slug,
        description,
        price,
        compareAtPrice: convertedCompareAtPrice,
        costPrice: aliProduct.price?.toString() || null,
        status,
        hasVariants,
        sku,
        stock: hasVariants ? 0 : 0,
        trackInventory: false,
        showOnStorefront: true,
        showOnPos: true,
        displayOrder: maxDisplayOrder + 1,

        // External Sourcing Tracking
        sourceType: "aliexpress",
        sourceId: aliProduct.productId,
        sourceUrl: aliProduct.url,
        sourcePrice: aliProduct.price?.toString() || null,
        sourceCurrency: aliProduct.currency || "USD",
        sourceLastSyncedAt: new Date().toISOString(),
        sourceSyncEnabled: true,
      })
      .returning({ id: products.id, slug: products.slug });

    // 7. Link product images
    if (mediaIds.length > 0) {
      const imageValues = mediaIds.map((mediaId, index) => ({
        productId: newProduct.id,
        mediaId,
        position: index,
      }));
      await db.insert(productImages).values(imageValues);
    }

    // 8. Link categories
    if (options.categoryIds && options.categoryIds.length > 0) {
      const categoryValues = options.categoryIds.map((categoryId) => ({
        productId: newProduct.id,
        categoryId,
      }));
      await db.insert(productCategories).values(categoryValues);
    }

    // 9. Create variants if product has them
    if (hasVariants) {
      try {
        if (!rates && aliProduct.currency && aliProduct.currency !== "AFN") {
          rates = await getExchangeRates();
        }
        await createVariantsFromAliExpressData(
          tenantId,
          newProduct.id,
          aliProduct,
          mediaIds,
          warnings,
          rates
        );
      } catch (error) {
        warnings.push(
          `Failed to create variants: ${error instanceof Error ? error.message : "Unknown error"}. Product was created as a simple product.`
        );
        // Update product to not have variants
        await db
          .update(products)
          .set({ hasVariants: false, updatedAt: new Date().toISOString() })
          .where(
            and(eq(products.tenantId, tenantId), eq(products.id, newProduct.id))
          );
      }
    }

    return {
      success: true,
      productId: newProduct.id,
      productSlug: newProduct.slug,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      warnings,
      error:
        error instanceof Error ? error.message : "Failed to import product",
    };
  }
}

/**
 * Create variants from AliExpress variant data.
 * Downloads per-variant images and assigns them.
 */
async function createVariantsFromAliExpressData(
  tenantId: string,
  productId: string,
  aliProduct: AliExpressProduct,
  mainMediaIds: string[],
  warnings: string[],
  rates?: ExchangeRates
): Promise<void> {
  // Build InlineOption format for bulk creation
  const inlineOptions = aliProduct.variantOptions.map((opt, optIndex) => ({
    tempId: `ali-opt-${optIndex}`,
    name: opt.name,
    isNew: true as const,
    values: opt.values.map((val) => ({
      value: val.value,
      isNew: true as const,
      swatchType: val.imageUrl ? ("image" as const) : ("text" as const),
    })),
    swatchSize: "md" as const,
    swatchShape: "square" as const,
  }));

  // Download per-variant images (option value images, e.g., color swatches)
  const variantImageUrls: {
    optIndex: number;
    valIndex: number;
    url: string;
  }[] = [];
  for (let optIdx = 0; optIdx < aliProduct.variantOptions.length; optIdx++) {
    const opt = aliProduct.variantOptions[optIdx];
    for (let valIdx = 0; valIdx < opt.values.length; valIdx++) {
      const val = opt.values[valIdx];
      if (val.imageUrl) {
        variantImageUrls.push({
          optIndex: optIdx,
          valIndex: valIdx,
          url: val.imageUrl,
        });
      }
    }
  }

  // Download variant swatch images
  const downloadedVariantImages = await downloadImagesWithLimit(
    variantImageUrls.map((v) => v.url),
    MAX_CONCURRENT_DOWNLOADS
  );

  const variantImageMediaMap = new Map<string, string>(); // "optIdx-valIdx" → mediaId
  for (let i = 0; i < variantImageUrls.length; i++) {
    const downloaded = downloadedVariantImages[i];
    if (!downloaded) continue;

    const { optIndex, valIndex } = variantImageUrls[i];
    const optName = aliProduct.variantOptions[optIndex]?.name || "variant";
    const valName =
      aliProduct.variantOptions[optIndex]?.values[valIndex]?.value || "";

    const mediaId = await uploadAndCreateMedia(
      tenantId,
      downloaded,
      `${aliProduct.title} - ${optName}: ${valName}`
    );
    if (mediaId) {
      variantImageMediaMap.set(`${optIndex}-${valIndex}`, mediaId);
    }
  }

  // Pre-compute currency conversion rate
  const afnRate =
    rates && aliProduct.currency && aliProduct.currency !== "AFN"
      ? rates[aliProduct.currency]
      : null;

  // Build GeneratedVariant format
  let generatedVariants;

  if (aliProduct.variants.length > 0) {
    generatedVariants = aliProduct.variants.map((variant, index) => {
      const optionValues = Object.entries(variant.options).map(
        ([optionName, value]) => {
          const optIndex = aliProduct.variantOptions.findIndex(
            (o) => o.name === optionName
          );
          return {
            optionId: `ali-opt-${optIndex >= 0 ? optIndex : 0}`,
            optionName,
            valueId: value,
            value,
          };
        }
      );

      // Find image for this variant's first option value
      let variantImageId = "";
      for (const [optionName, value] of Object.entries(variant.options)) {
        const optIdx = aliProduct.variantOptions.findIndex(
          (o) => o.name === optionName
        );
        if (optIdx >= 0) {
          const valIdx = aliProduct.variantOptions[optIdx].values.findIndex(
            (v) => v.value === value
          );
          if (valIdx >= 0) {
            const mediaId = variantImageMediaMap.get(`${optIdx}-${valIdx}`);
            if (mediaId) {
              variantImageId = mediaId;
              break;
            }
          }
        }
      }

      // Convert variant price
      let variantPrice = "";
      if (variant.price !== null) {
        if (afnRate && afnRate > 0) {
          variantPrice = Math.round(variant.price / afnRate).toString();
        } else {
          variantPrice = variant.price.toString();
        }
      }

      return {
        tempId: `ali-var-${index}`,
        optionValues,
        displayName: Object.values(variant.options).join(" / "),
        price: variantPrice,
        stock: variant.stock.toString(),
        weight: "",
        length: "",
        width: "",
        height: "",
        barcode: "",
        description: "",
        isActive: variant.available,
        isExcluded: false,
        imageId: variantImageId || mainMediaIds[0] || "",
        imageIds: variantImageId ? [variantImageId] : [],
      };
    });
  } else {
    // Generate Cartesian product from options
    generatedVariants = generateCartesianVariants(aliProduct.variantOptions);
  }

  if (generatedVariants.length === 0) {
    warnings.push("No variant combinations could be generated.");
    return;
  }

  if (generatedVariants.length > 100) {
    warnings.push(
      `AliExpress product has ${generatedVariants.length} variant combinations. Only the first 100 will be imported.`
    );
    generatedVariants = generatedVariants.slice(0, 100);
  }

  const bulkInput: BulkVariantCreationInput = {
    options: inlineOptions,
    variants: generatedVariants,
  };

  const result = await createProductVariantsInBulk(
    tenantId,
    productId,
    bulkInput
  );

  if (!result.success) {
    warnings.push(
      `Variant creation warning: ${result.error?.message || "Unknown issue"}`
    );
  } else {
    // Sync product stock
    await syncProductStockFromVariants(tenantId, productId);
  }
}

/**
 * Generate Cartesian product of variant options when AliExpress doesn't provide SKU combinations
 */
function generateCartesianVariants(
  variantOptions: AliExpressProduct["variantOptions"]
) {
  if (variantOptions.length === 0) return [];

  const valueArrays = variantOptions.map((opt) =>
    opt.values.map((v) => ({ optionName: opt.name, value: v.value }))
  );

  const combinations = cartesian(...valueArrays);

  return combinations.map((combo, index) => {
    const optionValues = combo.map((item) => {
      const optIndex = variantOptions.findIndex(
        (o) => o.name === item.optionName
      );
      return {
        optionId: `ali-opt-${optIndex}`,
        optionName: item.optionName,
        valueId: item.value,
        value: item.value,
      };
    });

    return {
      tempId: `ali-var-${index}`,
      optionValues,
      displayName: combo.map((c) => c.value).join(" / "),
      price: "",
      stock: "0",
      weight: "",
      length: "",
      width: "",
      height: "",
      barcode: "",
      description: "",
      isActive: true,
      isExcluded: false,
      imageIds: [] as string[],
    };
  });
}

/**
 * Cartesian product helper
 */
function cartesian<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]]
  );
}
