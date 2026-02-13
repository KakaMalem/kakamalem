import { db } from "@/lib/db";
import { products, productImages, productCategories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
import type { AmazonProduct, AmazonImage, ImportResult } from "./types";

// =============================================================================
// AMAZON → KAKA MALEM PRODUCT IMPORTER
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
    // Clean up the URL — ensure it's the highest resolution
    const cleanUrl = url.replace(/\._.*_\./, ".");

    const response = await fetch(cleanUrl, {
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
  // Determine filename extension from MIME type
  const extMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const ext = extMap[imageData.mimeType] || ".jpg";
  const filename = `amazon-import${ext}`;

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
 * Get the best URL from an AmazonImage
 */
function getBestImageUrl(img: AmazonImage): string | null {
  return img.hiRes || img.large || img.thumb || null;
}

/**
 * Build product description from Amazon data
 */
function buildDescription(amazonProduct: AmazonProduct): string {
  const parts: string[] = [];

  // Feature bullets
  if (amazonProduct.featureBullets.length > 0) {
    parts.push("<h3>Features</h3>");
    parts.push("<ul>");
    for (const bullet of amazonProduct.featureBullets) {
      parts.push(`<li>${escapeHtml(bullet)}</li>`);
    }
    parts.push("</ul>");
  }

  // Product description
  if (amazonProduct.description) {
    parts.push("<h3>Description</h3>");
    parts.push(amazonProduct.description);
  }

  // Specifications
  const specEntries = Object.entries(amazonProduct.specifications);
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

  // Brand
  if (amazonProduct.brand) {
    parts.push(
      `<p><strong>Brand:</strong> ${escapeHtml(amazonProduct.brand)}</p>`
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
 * Import an Amazon product into the Kaka Malem system.
 *
 * This handles:
 * 1. Downloading and uploading all product images
 * 2. Creating the product record
 * 3. Creating variants (if any)
 * 4. Linking images to variants
 */
export async function importAmazonProduct(
  amazonProduct: AmazonProduct,
  options: ImportOptions
): Promise<ImportResult> {
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

    const productName = options.name || amazonProduct.title;
    if (!productName) {
      return {
        success: false,
        warnings: [],
        error: "Product title is empty. Cannot create product.",
      };
    }

    // 1. Download and upload main product images
    const imageUrls = amazonProduct.images
      .map(getBestImageUrl)
      .filter((url): url is string => url !== null);

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
    const description = buildDescription(amazonProduct);

    // 3. Determine price — convert from Amazon currency to AFN if needed
    let rates: ExchangeRates | undefined;
    let price: string;

    if (options.price) {
      // User provided an explicit override (already in store currency)
      price = options.price;
    } else if (
      amazonProduct.price !== null &&
      amazonProduct.currency &&
      amazonProduct.currency !== "AFN"
    ) {
      try {
        rates = await getExchangeRates();
        const convertedPrice = await convertToAFN(
          amazonProduct.price,
          amazonProduct.currency,
          rates
        );
        price = Math.round(convertedPrice).toString();
      } catch {
        warnings.push(
          `Currency conversion from ${amazonProduct.currency} failed. Using original price.`
        );
        price = amazonProduct.price.toString();
      }
    } else {
      price =
        amazonProduct.price !== null ? amazonProduct.price.toString() : "0";
    }

    // Convert compareAtPrice too
    let convertedCompareAtPrice: string | null = null;
    if (amazonProduct.compareAtPrice !== null) {
      if (amazonProduct.currency && amazonProduct.currency !== "AFN") {
        try {
          if (!rates) rates = await getExchangeRates();
          const converted = await convertToAFN(
            amazonProduct.compareAtPrice,
            amazonProduct.currency,
            rates
          );
          convertedCompareAtPrice = Math.round(converted).toString();
        } catch {
          convertedCompareAtPrice = amazonProduct.compareAtPrice.toString();
        }
      } else {
        convertedCompareAtPrice = amazonProduct.compareAtPrice.toString();
      }
    }

    // 4. Generate slug and SKU
    const slug = await generateUniqueProductSlug(tenantId, productName);
    const sku = generateSku(productName);
    const maxDisplayOrder = await getMaxProductDisplayOrder(tenantId);

    // 5. Determine if product has variants
    const hasVariants =
      amazonProduct.variantOptions.length > 0 &&
      amazonProduct.variants.length > 0;

    // 6. Create the product
    const [newProduct] = await db
      .insert(products)
      .values({
        tenantId,
        name: productName,
        slug,
        description,
        price,
        compareAtPrice: convertedCompareAtPrice,
        status,
        hasVariants,
        sku,
        stock: hasVariants ? 0 : 0,
        trackInventory: false,
        showOnStorefront: true,
        showOnPos: true,
        displayOrder: maxDisplayOrder + 1,
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
        if (
          !rates &&
          amazonProduct.currency &&
          amazonProduct.currency !== "AFN"
        ) {
          rates = await getExchangeRates();
        }
        await createVariantsFromAmazonData(
          tenantId,
          newProduct.id,
          amazonProduct,
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
 * Create variants from Amazon variant data.
 * Downloads per-variant images and assigns them.
 */
async function createVariantsFromAmazonData(
  tenantId: string,
  productId: string,
  amazonProduct: AmazonProduct,
  mainMediaIds: string[],
  warnings: string[],
  rates?: ExchangeRates
): Promise<void> {
  // Build InlineOption format for bulk creation
  const inlineOptions = amazonProduct.variantOptions.map((opt, optIndex) => ({
    tempId: `amazon-opt-${optIndex}`,
    name: opt.name,
    isNew: true as const,
    values: opt.values.map((val) => ({
      value: val.value,
      isNew: true as const,
      swatchType: "text" as const,
    })),
    swatchSize: "md" as const,
    swatchShape: "square" as const,
  }));

  // Build GeneratedVariant format
  let generatedVariants;

  if (amazonProduct.variants.length > 0) {
    // Download per-variant images (first image of each variant's image set)
    // We batch download variant images for all variants that have them
    const variantsWithImages = amazonProduct.variants.filter(
      (v) => v.images.length > 0
    );

    // Download the first image of each variant as its primary image
    const variantImageUrls = variantsWithImages.map((v) => {
      const best = getBestImageUrl(v.images[0]);
      return best;
    });

    const downloadedVariantImages = await downloadImagesWithLimit(
      variantImageUrls.filter((u): u is string => u !== null),
      MAX_CONCURRENT_DOWNLOADS
    );

    // Map ASIN → mediaId for variant primary images
    const variantMediaMap = new Map<string, string>();
    let downloadIdx = 0;
    for (const variant of variantsWithImages) {
      const imgUrl = getBestImageUrl(variant.images[0]);
      if (!imgUrl) continue;

      const downloaded = downloadedVariantImages[downloadIdx];
      downloadIdx++;

      if (!downloaded) {
        warnings.push(
          `Failed to download image for variant "${variant.title}"`
        );
        continue;
      }

      const mediaId = await uploadAndCreateMedia(
        tenantId,
        downloaded,
        `${amazonProduct.title} - ${variant.title}`
      );
      if (mediaId) {
        variantMediaMap.set(variant.asin, mediaId);
      }
    }

    // Pre-compute currency conversion rate for variants
    // rates[CURRENCY] = how much 1 AFN is in that currency
    // So to convert from Amazon currency to AFN: amount / rates[currency]
    const afnRate =
      rates && amazonProduct.currency && amazonProduct.currency !== "AFN"
        ? rates[amazonProduct.currency]
        : null;

    // Use actual variant data from Amazon
    generatedVariants = amazonProduct.variants.map((variant, index) => {
      const optionValues = Object.entries(variant.options).map(
        ([optionName, value]) => {
          const optIndex = amazonProduct.variantOptions.findIndex(
            (o) => o.name === optionName
          );
          return {
            optionId: `amazon-opt-${optIndex >= 0 ? optIndex : 0}`,
            optionName,
            valueId: value,
            value,
          };
        }
      );

      // Get the uploaded media ID for this variant
      const variantMediaId = variantMediaMap.get(variant.asin);

      // Convert variant price from Amazon currency to AFN
      let variantPrice = "";
      if (variant.price !== null) {
        if (afnRate && afnRate > 0) {
          variantPrice = Math.round(variant.price / afnRate).toString();
        } else {
          variantPrice = variant.price.toString();
        }
      }

      return {
        tempId: `amazon-var-${index}`,
        optionValues,
        displayName: Object.values(variant.options).join(" / "),
        price: variantPrice,
        stock: "0",
        weight: "",
        length: "",
        width: "",
        height: "",
        barcode: "",
        description: "",
        isActive: variant.available,
        isExcluded: false,
        // Assign variant-specific image, or fall back to first main image
        imageId: variantMediaId || mainMediaIds[0] || "",
        imageIds: variantMediaId ? [variantMediaId] : [],
      };
    });
  } else {
    // Generate Cartesian product from options
    generatedVariants = generateCartesianVariants(amazonProduct.variantOptions);
  }

  if (generatedVariants.length === 0) {
    warnings.push("No variant combinations could be generated.");
    return;
  }

  if (generatedVariants.length > 100) {
    warnings.push(
      `Amazon product has ${generatedVariants.length} variant combinations. Only the first 100 will be imported.`
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
 * Generate Cartesian product of variant options when Amazon doesn't provide specific combinations
 */
function generateCartesianVariants(
  variantOptions: AmazonProduct["variantOptions"]
) {
  if (variantOptions.length === 0) return [];

  // Get all value arrays
  const valueArrays = variantOptions.map((opt) =>
    opt.values.map((v) => ({ optionName: opt.name, value: v.value }))
  );

  // Generate Cartesian product
  const combinations = cartesian(...valueArrays);

  return combinations.map((combo, index) => {
    const optionValues = combo.map((item) => {
      const optIndex = variantOptions.findIndex(
        (o) => o.name === item.optionName
      );
      return {
        optionId: `amazon-opt-${optIndex}`,
        optionName: item.optionName,
        valueId: item.value,
        value: item.value,
      };
    });

    return {
      tempId: `amazon-var-${index}`,
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
