"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import {
  products,
  categories,
  productCategories,
  productImages,
  media,
  variantOptions,
  variantOptionValues,
  productVariants,
  productVariantOptions,
  productVariantImages,
  optionValueImages,
  priceTiers,
  customerGroups,
  customerGroupPrices,
  scheduledSales,
} from "@/lib/db/schema";
import { uploadFile, type StorageOptions } from "@/lib/storage";
import { eq, and } from "drizzle-orm";
import {
  bulkUploadRowSchema,
  REQUIRED_HEADERS,
  type BulkUploadRowInput,
  type ValidatedRow,
  type BulkUploadResult,
  type ParsePreviewResult,
} from "@/lib/validations/bulk-upload";
import { generateUniqueProductSlug } from "@/lib/db/queries/slugs";
import { generateSku } from "@/lib/utils/slug";
import { getMaxProductDisplayOrder } from "@/lib/db/queries/products";
import { getUser } from "@/lib/auth/server";
import { getSubscriptionOverview } from "@/lib/db/queries/billing";
import { completeOnboardingItem } from "@/lib/db/queries/onboarding";
import { createCategory } from "@/lib/actions/categories";
import { extractProductZip } from "@/lib/upload/zip-extractor";

// Maximum rows allowed per upload
const MAX_ROWS = 500;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB for CSV/Excel
const MAX_ZIP_FILE_SIZE = 50 * 1024 * 1024; // 50MB for ZIP with images

/**
 * Parse CSV/Excel/ZIP file content and validate each row
 * Returns validated rows with errors for preview
 * For ZIP files: extracts CSV/Excel and images, validates image references
 */
export async function parseFileForPreview(
  tenantId: string,
  fileContent: Uint8Array | ArrayBuffer,
  fileName: string
): Promise<ParsePreviewResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const isZipFile = fileName.toLowerCase().endsWith(".zip");

    // Check file size based on type
    const maxSize = isZipFile ? MAX_ZIP_FILE_SIZE : MAX_FILE_SIZE;
    if (fileContent.byteLength > maxSize) {
      return {
        success: false,
        error: isZipFile
          ? "ZIP file is too large. Maximum size is 50MB."
          : "File is too large. Maximum size is 2MB.",
      };
    }

    // Convert Uint8Array to ArrayBuffer if needed
    const contentBuffer =
      fileContent instanceof Uint8Array
        ? (fileContent.buffer.slice(
            fileContent.byteOffset,
            fileContent.byteOffset + fileContent.byteLength
          ) as ArrayBuffer)
        : fileContent;

    // Handle ZIP files - extract CSV and images
    let csvContent: ArrayBuffer;
    let zipImages: Map<string, ArrayBuffer> | undefined;
    let imageCount = 0;

    if (isZipFile) {
      const extracted = await extractProductZip(contentBuffer);

      if (extracted.errors.length > 0 && !extracted.csvFile) {
        return { success: false, error: extracted.errors.join(", ") };
      }

      if (!extracted.csvFile) {
        return {
          success: false,
          error:
            "No CSV or Excel file found in ZIP root. Please include a products.csv or products.xlsx file.",
        };
      }

      csvContent = extracted.csvFile.data;
      zipImages = extracted.images;
      imageCount = extracted.images.size;
    } else {
      csvContent = contentBuffer;
    }

    // Parse file using xlsx (works for both CSV and Excel)
    // codepage 65001 = UTF-8, ensures proper handling of non-Latin characters (Persian, Arabic, etc.)
    const workbook = XLSX.read(csvContent, {
      type: "array",
      codepage: 65001,
    });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { success: false, error: "File is empty or invalid." };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (rawData.length < 2) {
      return {
        success: false,
        error: "File must have a header row and at least one data row.",
      };
    }

    // Parse headers from first row
    const headerRow = rawData[0] as unknown[];
    const headers = headerRow.map((h) =>
      String(h || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
    );

    // Validate required headers
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return {
        success: false,
        error: `Missing required columns: ${missingHeaders.join(", ")}`,
      };
    }

    // Check row limit
    const dataRows = rawData.slice(1).filter((row) => {
      return row.some((cell) => cell !== "");
    });

    if (dataRows.length > MAX_ROWS) {
      return {
        success: false,
        error: `Too many rows. Maximum is ${MAX_ROWS} products per upload.`,
      };
    }

    if (dataRows.length === 0) {
      return {
        success: false,
        error: "No data rows found in the file.",
      };
    }

    // Fetch categories for this tenant (for name -> ID mapping)
    const tenantCategories = await db.query.categories.findMany({
      where: eq(categories.tenantId, tenantId),
      columns: { id: true, name: true },
    });

    // Create case-insensitive map
    const categoryMap: Record<string, string> = {};
    for (const cat of tenantCategories) {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    }

    // Identify option columns (headers starting with "option_")
    const optionColumnMap: Array<{ header: string; optionName: string }> = [];
    for (const header of headers) {
      if (header.startsWith("option_")) {
        // Convert option_size -> Size, option_color -> Color
        const optionName = header
          .replace(/^option_/, "")
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        optionColumnMap.push({ header, optionName });
      }
    }

    // Get current product count for informational display only (no limits enforced)
    const overview = await getSubscriptionOverview(tenantId);
    const currentProductCount = overview?.productCount ?? 0;
    const productLimit = null;
    const canImportCount = Infinity;

    // Parse and validate each row
    const validatedRows: ValidatedRow[] = [];

    // Track categories to create: Map<tempId, originalName>
    const categoriesToCreate: Map<string, string> = new Map();

    for (let i = 0; i < dataRows.length; i++) {
      const rowNumber = i + 2; // 1-indexed, accounting for header
      const rowArray = dataRows[i];

      // Map values to object using headers
      const rowData: Record<string, string> = {};
      headers.forEach((header, index) => {
        const value = rowArray[index];
        rowData[header] =
          value !== undefined && value !== null ? String(value).trim() : "";
      });

      // Validate with Zod
      const result = bulkUploadRowSchema.safeParse(rowData);
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push(`${issue.path.join(".")}: ${issue.message}`);
        });
      }

      // Resolve category names to IDs (supports multiple categories separated by semicolon)
      // Auto-creates new categories if they don't exist
      const categoryIds: string[] = [];
      const categoryField = rowData.category?.trim();
      if (categoryField) {
        // Split by semicolon and process each category
        const categoryNames = categoryField
          .split(/[;,]/)
          .map((c) => c.trim())
          .filter(Boolean);

        for (const catName of categoryNames) {
          const catId = categoryMap[catName.toLowerCase()];
          if (catId) {
            categoryIds.push(catId);
          } else {
            // Category doesn't exist - mark for creation with temp ID
            const tempId = `temp-cat-${catName.toLowerCase().replace(/\s+/g, "-")}`;
            categoriesToCreate.set(tempId, catName); // Store original name for creation
            categoryIds.push(tempId);
          }
        }
      }

      const isVariant = !!rowData.parent_product?.trim();

      // Extract option values for variants
      const optionValues: Record<string, string> = {};
      if (isVariant) {
        for (const { header, optionName } of optionColumnMap) {
          const value = rowData[header]?.trim();
          if (value) {
            optionValues[optionName] = value;
          }
        }
        // Variants should have at least one option value
        if (Object.keys(optionValues).length === 0) {
          warnings.push(
            "Variant row has no option values. Make sure option columns (e.g., option_size, option_color) are filled."
          );
        }
      }

      // Parse images column (semicolon-separated filenames)
      const imageFilenames: string[] = [];
      const imagesField = rowData.images?.trim();
      if (imagesField) {
        const filenames = imagesField
          .split(";")
          .map((f) => f.trim())
          .filter(Boolean);

        for (const filename of filenames) {
          // If ZIP images were provided, validate the image exists
          if (zipImages && !zipImages.has(filename.toLowerCase())) {
            warnings.push(`Image not found in ZIP: ${filename}`);
          } else {
            imageFilenames.push(filename);
          }
        }
      }

      // Parse price_tiers: "minQty-maxQty:price;..." or "minQty:price;..."
      const parsedPriceTiers: Array<{
        minQuantity: number;
        maxQuantity: number | null;
        price: string;
      }> = [];
      const priceTiersField = rowData.price_tiers?.trim();
      if (priceTiersField) {
        const tierParts = priceTiersField.split(";").filter(Boolean);
        for (const part of tierParts) {
          // Match "minQty-maxQty:price" or "minQty:price"
          const match = part.trim().match(/^(\d+)(?:-(\d+))?:(\d+(?:\.\d+)?)$/);
          if (match) {
            const minQty = parseInt(match[1]);
            const maxQty = match[2] ? parseInt(match[2]) : null;
            const tierPrice = match[3];
            if (minQty > 0 && parseFloat(tierPrice) >= 0) {
              parsedPriceTiers.push({
                minQuantity: minQty,
                maxQuantity: maxQty,
                price: tierPrice,
              });
            } else {
              warnings.push(
                `Invalid price tier "${part}": min quantity must be > 0`
              );
            }
          } else {
            warnings.push(
              `Invalid price tier format "${part}". Expected: minQty-maxQty:price or minQty:price`
            );
          }
        }
      }

      // Parse group_pricing: "groupName:price;..." or "groupName:price:compareAtPrice;..."
      const parsedGroupPricing: Array<{
        groupName: string;
        price: string;
        compareAtPrice: string | null;
      }> = [];
      const groupPricingField = rowData.group_pricing?.trim();
      if (groupPricingField) {
        const gpParts = groupPricingField.split(";").filter(Boolean);
        for (const part of gpParts) {
          const segments = part.trim().split(":");
          if (segments.length >= 2) {
            const groupName = segments[0].trim();
            const gpPrice = segments[1].trim();
            const gpCompare = segments.length >= 3 ? segments[2].trim() : null;
            if (groupName && !isNaN(parseFloat(gpPrice))) {
              parsedGroupPricing.push({
                groupName,
                price: gpPrice,
                compareAtPrice:
                  gpCompare && !isNaN(parseFloat(gpCompare)) ? gpCompare : null,
              });
            } else {
              warnings.push(
                `Invalid group pricing "${part}". Expected: groupName:price or groupName:price:compareAtPrice`
              );
            }
          } else {
            warnings.push(
              `Invalid group pricing format "${part}". Expected: groupName:price`
            );
          }
        }
      }

      // Parse scheduled sale columns
      let parsedScheduledSale: {
        name: string;
        salePrice: string;
        startsAt: string;
        endsAt: string;
      } | null = null;
      const salePriceField = rowData.scheduled_sale_price?.trim();
      const saleStartField = rowData.scheduled_sale_start?.trim();
      const saleEndField = rowData.scheduled_sale_end?.trim();
      if (salePriceField) {
        if (!saleStartField || !saleEndField) {
          warnings.push(
            "Scheduled sale requires both start and end dates (scheduled_sale_start, scheduled_sale_end)"
          );
        } else if (isNaN(parseFloat(salePriceField))) {
          warnings.push("Scheduled sale price must be a valid number");
        } else {
          const startDate = new Date(saleStartField);
          const endDate = new Date(saleEndField);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            warnings.push(
              "Scheduled sale dates must be valid (YYYY-MM-DD format)"
            );
          } else if (endDate <= startDate) {
            warnings.push("Scheduled sale end date must be after start date");
          } else {
            parsedScheduledSale = {
              name: rowData.scheduled_sale_name?.trim() || "",
              salePrice: salePriceField,
              startsAt: startDate.toISOString(),
              endsAt: endDate.toISOString(),
            };
          }
        }
      }

      // A row is valid if it has no errors (warnings are acceptable)
      const isValid = errors.length === 0;

      validatedRows.push({
        rowNumber,
        data: result.success ? result.data : (rowData as BulkUploadRowInput),
        categoryIds,
        errors,
        warnings,
        isValid,
        isVariant,
        parentProductName: isVariant
          ? rowData.parent_product.trim()
          : undefined,
        optionValues,
        imageFilenames,
        parsedPriceTiers,
        parsedGroupPricing,
        parsedScheduledSale,
      });
    }

    return {
      success: true,
      rows: validatedRows,
      categoryMap,
      categoriesToCreate: Object.fromEntries(categoriesToCreate), // { tempId: originalName }
      productLimitInfo: {
        currentCount: currentProductCount,
        limit: productLimit,
        canImport: Math.min(
          dataRows.length,
          canImportCount === Infinity ? dataRows.length : canImportCount
        ),
      },
      imageCount, // Number of images found in ZIP
    };
  } catch (error) {
    console.error("File parse error:", error);
    return {
      success: false,
      error:
        "Failed to parse file. Please ensure it's a valid CSV or Excel file.",
    };
  }
}

/**
 * Upload an image from buffer and create media record
 */
async function uploadImageFromBuffer(
  tenantId: string,
  imageData: ArrayBuffer,
  filename: string,
  uploadedById: string
): Promise<string | null> {
  try {
    // Detect MIME type from extension
    const ext = filename.toLowerCase().split(".").pop() || "";
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
    };
    const mimeType = mimeTypes[ext] || "image/jpeg";

    // Upload to storage
    const options: StorageOptions = {
      tenantId,
      folder: "products",
      generateUniqueName: true,
      processImage: true,
      generateThumbnails: true,
    };

    const result = await uploadFile(
      Buffer.from(imageData),
      filename,
      mimeType,
      options
    );

    if (!result.success) {
      console.error(`Failed to upload image ${filename}:`, result.error);
      return null;
    }

    // Create media record
    const [mediaRecord] = await db
      .insert(media)
      .values({
        tenantId,
        uploadedById,
        url: result.url,
        fileName: result.filename,
        fileSize: result.size,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
      })
      .returning({ id: media.id });

    return mediaRecord.id;
  } catch (error) {
    console.error(`Error uploading image ${filename}:`, error);
    return null;
  }
}

/**
 * Import validated products in batches with transactions
 * Three-pass approach:
 * 1. First pass: Upload images and build filename -> mediaId map
 * 2. Second pass: Create main products (rows without parent_product)
 * 3. Third pass: Create variants (rows with parent_product)
 */
export async function importProducts(
  tenantId: string,
  rows: ValidatedRow[],
  zipFileData?: Uint8Array | ArrayBuffer // Optional: raw ZIP file data for image extraction
): Promise<BulkUploadResult> {
  const validRows = rows.filter((r) => r.isValid);

  if (validRows.length === 0) {
    return {
      success: false,
      totalRows: rows.length,
      validRows: 0,
      invalidRows: rows.length,
      importedCount: 0,
      errors: rows
        .filter((r) => !r.isValid)
        .map((r) => ({ row: r.rowNumber, errors: r.errors })),
    };
  }

  try {
    const user = await getUser();
    if (!user) {
      return {
        success: false,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length,
        importedCount: 0,
        errors: [{ row: 0, errors: ["Not authenticated"] }],
      };
    }

    // Separate main products and variants
    const mainProductRows = validRows.filter((r) => !r.isVariant);
    const variantRows = validRows.filter((r) => r.isVariant);

    // Get starting display order
    let displayOrder = await getMaxProductDisplayOrder(tenantId);

    let importedCount = 0;
    const importErrors: Array<{ row: number; errors: string[] }> = [];

    // Track created products by name for variant linking
    const createdProducts: Map<string, string> = new Map();

    // Also fetch existing products by name for variant linking to existing products
    const existingProducts = await db.query.products.findMany({
      where: eq(products.tenantId, tenantId),
      columns: { id: true, name: true },
    });
    for (const p of existingProducts) {
      createdProducts.set(p.name.toLowerCase(), p.id);
    }

    // ==========================================
    // AUTO-CREATE MISSING CATEGORIES
    // ==========================================
    // Collect unique category temp IDs from all rows
    const tempCategoryIds = new Set<string>();
    for (const row of validRows) {
      for (const catId of row.categoryIds) {
        if (catId.startsWith("temp-cat-")) {
          tempCategoryIds.add(catId);
        }
      }
    }

    // Create missing categories and build mapping of tempId -> realId
    const createdCategoryMap = new Map<string, string>();
    for (const tempId of tempCategoryIds) {
      // Find the original category name from a row that uses this tempId
      const sampleRow = validRows.find((r) => r.categoryIds.includes(tempId));
      if (!sampleRow) continue;

      // Parse the original category name from the row data
      const categoryField = sampleRow.data.category || "";
      const categoryNames = categoryField
        .split(/[;,]/)
        .map((c) => c.trim())
        .filter(Boolean);

      // Find which category name maps to this tempId
      let originalName = "";
      for (const name of categoryNames) {
        const expectedTempId = `temp-cat-${name.toLowerCase().replace(/\s+/g, "-")}`;
        if (expectedTempId === tempId) {
          originalName = name;
          break;
        }
      }

      if (!originalName) continue;

      // Create the category
      const result = await createCategory(tenantId, {
        name: originalName,
        slug: "",
        description: "",
        imageId: "",
        displayOrder: 0,
      });

      if (result.success && result.data) {
        createdCategoryMap.set(tempId, result.data.id);
      }
    }

    // Replace temp IDs with real IDs in all rows
    for (const row of validRows) {
      row.categoryIds = row.categoryIds.map(
        (id) => createdCategoryMap.get(id) || id
      );
    }

    // ==========================================
    // UPLOAD IMAGES FROM ZIP (if provided)
    // ==========================================
    const uploadedImages = new Map<string, string>(); // filename (lowercase) -> mediaId

    if (zipFileData) {
      // Convert Uint8Array to ArrayBuffer if needed
      const zipBuffer =
        zipFileData instanceof Uint8Array
          ? (zipFileData.buffer.slice(
              zipFileData.byteOffset,
              zipFileData.byteOffset + zipFileData.byteLength
            ) as ArrayBuffer)
          : zipFileData;

      // Extract images from ZIP file
      const extracted = await extractProductZip(zipBuffer);
      const zipImages = extracted.images;

      if (zipImages.size > 0) {
        // Collect unique image filenames from all rows
        const neededImages = new Set<string>();
        for (const row of validRows) {
          for (const filename of row.imageFilenames) {
            neededImages.add(filename.toLowerCase());
          }
        }

        // Upload only the images that are actually referenced
        for (const filename of neededImages) {
          const imageData = zipImages.get(filename);
          if (imageData) {
            const mediaId = await uploadImageFromBuffer(
              tenantId,
              imageData,
              filename,
              user.id
            );
            if (mediaId) {
              uploadedImages.set(filename, mediaId);
            }
          }
        }
      }
    }

    // Fetch customer groups for group pricing resolution (name -> id)
    const tenantCustomerGroups = await db.query.customerGroups.findMany({
      where: eq(customerGroups.tenantId, tenantId),
      columns: { id: true, name: true },
    });
    const customerGroupNameToId = new Map<string, string>();
    for (const g of tenantCustomerGroups) {
      customerGroupNameToId.set(g.name.toLowerCase(), g.id);
    }

    // Process in batches of 50 for transaction efficiency
    const BATCH_SIZE = 50;

    // ==========================================
    // FIRST PASS: Create main products
    // ==========================================
    for (let i = 0; i < mainProductRows.length; i += BATCH_SIZE) {
      const batch = mainProductRows.slice(i, i + BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          for (const row of batch) {
            try {
              // Generate unique slug
              const slug = await generateUniqueProductSlug(
                tenantId,
                row.data.name
              );
              displayOrder++;

              // Check if this product will have variants
              const willHaveVariants = variantRows.some(
                (v) =>
                  v.parentProductName?.toLowerCase() ===
                  row.data.name.toLowerCase()
              );

              // Insert product
              const [newProduct] = await tx
                .insert(products)
                .values({
                  tenantId,
                  name: row.data.name,
                  slug,
                  description: row.data.description || null,
                  price: row.data.price,
                  compareAtPrice: row.data.compare_at_price || null,
                  costPrice: row.data.cost_price || null,
                  categoryId: row.categoryIds[0] || null,
                  stock: parseInt(row.data.stock || "0"),
                  status:
                    (row.data.status as "draft" | "active" | "archived") ||
                    "draft",
                  trackInventory: row.data.track_inventory !== "false",
                  allowBackorder: row.data.allow_backorder === "true",
                  lowStockThreshold: parseInt(
                    row.data.low_stock_threshold || "5"
                  ),
                  showStock: row.data.show_stock === "true",
                  weight: row.data.weight || null,
                  length: row.data.length || null,
                  width: row.data.width || null,
                  height: row.data.height || null,
                  showOnStorefront: row.data.show_on_storefront !== "false",
                  showOnPos: row.data.show_on_pos !== "false",
                  barcode: row.data.barcode || null,
                  sku: row.data.sku || generateSku(row.data.name),
                  displayOrder: row.data.display_order
                    ? parseInt(row.data.display_order)
                    : displayOrder,
                  minOrderQuantity: row.data.min_order_quantity
                    ? parseInt(row.data.min_order_quantity)
                    : 1,
                  maxOrderQuantity: row.data.max_order_quantity
                    ? parseInt(row.data.max_order_quantity)
                    : null,
                  sourceUrl: row.data.source_url || null,
                  sourceId: row.data.source_id || null,
                  hasVariants: willHaveVariants,
                })
                .returning({ id: products.id });

              // Track for variant linking
              createdProducts.set(row.data.name.toLowerCase(), newProduct.id);

              // Insert into product_categories junction table
              if (row.categoryIds.length > 0 && newProduct) {
                await tx.insert(productCategories).values(
                  row.categoryIds.map((categoryId) => ({
                    productId: newProduct.id,
                    categoryId,
                  }))
                );
              }

              // Link images to product (from ZIP upload)
              if (row.imageFilenames.length > 0 && uploadedImages.size > 0) {
                const imageRecords = row.imageFilenames
                  .map((filename, index) => {
                    const mediaId = uploadedImages.get(filename.toLowerCase());
                    return mediaId
                      ? { productId: newProduct.id, mediaId, position: index }
                      : null;
                  })
                  .filter(
                    (
                      rec
                    ): rec is {
                      productId: string;
                      mediaId: string;
                      position: number;
                    } => rec !== null
                  );

                if (imageRecords.length > 0) {
                  await tx.insert(productImages).values(imageRecords);
                }
              }

              // Insert price tiers
              if (row.parsedPriceTiers.length > 0) {
                await tx.insert(priceTiers).values(
                  row.parsedPriceTiers.map((tier) => ({
                    tenantId,
                    productId: newProduct.id,
                    minQuantity: tier.minQuantity,
                    maxQuantity: tier.maxQuantity,
                    price: tier.price,
                  }))
                );
              }

              // Insert customer group pricing
              if (row.parsedGroupPricing.length > 0) {
                const groupPriceValues = row.parsedGroupPricing
                  .map((gp) => {
                    const groupId = customerGroupNameToId.get(
                      gp.groupName.toLowerCase()
                    );
                    if (!groupId) return null;
                    return {
                      tenantId,
                      productId: newProduct.id,
                      customerGroupId: groupId,
                      price: gp.price,
                      compareAtPrice: gp.compareAtPrice,
                    };
                  })
                  .filter((v): v is NonNullable<typeof v> => v !== null);

                if (groupPriceValues.length > 0) {
                  await tx.insert(customerGroupPrices).values(groupPriceValues);
                }
              }

              // Insert scheduled sale
              if (row.parsedScheduledSale) {
                await tx.insert(scheduledSales).values({
                  tenantId,
                  productId: newProduct.id,
                  name: row.parsedScheduledSale.name || null,
                  salePrice: row.parsedScheduledSale.salePrice,
                  startsAt: row.parsedScheduledSale.startsAt,
                  endsAt: row.parsedScheduledSale.endsAt,
                });
              }

              importedCount++;
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Insert failed";
              importErrors.push({ row: row.rowNumber, errors: [message] });
            }
          }
        });
      } catch (batchError) {
        const message =
          batchError instanceof Error
            ? batchError.message
            : "Batch insert failed";
        for (const row of batch) {
          importErrors.push({ row: row.rowNumber, errors: [message] });
        }
      }
    }

    // ==========================================
    // SECOND PASS: Create variants
    // ==========================================
    if (variantRows.length > 0) {
      // Fetch existing variant options for this tenant
      const existingOptions = await db.query.variantOptions.findMany({
        where: eq(variantOptions.tenantId, tenantId),
        columns: { id: true, name: true },
      });
      const optionNameToId: Map<string, string> = new Map();
      for (const opt of existingOptions) {
        optionNameToId.set(opt.name.toLowerCase(), opt.id);
      }

      // Fetch existing option values
      const existingValues = await db.query.variantOptionValues.findMany({
        where: eq(variantOptionValues.tenantId, tenantId),
        columns: { id: true, optionId: true, value: true },
      });
      // Map: optionId -> { value -> valueId }
      const optionValueMap: Map<string, Map<string, string>> = new Map();
      for (const val of existingValues) {
        if (!optionValueMap.has(val.optionId)) {
          optionValueMap.set(val.optionId, new Map());
        }
        optionValueMap.get(val.optionId)!.set(val.value.toLowerCase(), val.id);
      }

      // Track max display order for variant options
      let maxOptionOrder = existingOptions.length;

      for (let i = 0; i < variantRows.length; i += BATCH_SIZE) {
        const batch = variantRows.slice(i, i + BATCH_SIZE);

        try {
          await db.transaction(async (tx) => {
            for (const row of batch) {
              try {
                // Resolve parent product
                const parentId = createdProducts.get(
                  row.parentProductName!.toLowerCase()
                );
                if (!parentId) {
                  importErrors.push({
                    row: row.rowNumber,
                    errors: [
                      `Parent product "${row.parentProductName}" not found`,
                    ],
                  });
                  continue;
                }

                // Ensure parent has hasVariants = true
                await tx
                  .update(products)
                  .set({ hasVariants: true })
                  .where(eq(products.id, parentId));

                // Resolve/create option values and collect optionValueIds
                const resolvedOptionValueIds: string[] = [];

                for (const [optionName, optionValue] of Object.entries(
                  row.optionValues
                )) {
                  // Find or create the variant option
                  let optionId = optionNameToId.get(optionName.toLowerCase());
                  if (!optionId) {
                    maxOptionOrder++;
                    const [newOption] = await tx
                      .insert(variantOptions)
                      .values({
                        tenantId,
                        name: optionName,
                        displayOrder: maxOptionOrder,
                      })
                      .returning({ id: variantOptions.id });
                    optionId = newOption.id;
                    optionNameToId.set(optionName.toLowerCase(), optionId);
                    optionValueMap.set(optionId, new Map());
                  }

                  // Find or create the option value
                  let valueId = optionValueMap
                    .get(optionId)
                    ?.get(optionValue.toLowerCase());
                  if (!valueId) {
                    const valueMap = optionValueMap.get(optionId)!;
                    const [newValue] = await tx
                      .insert(variantOptionValues)
                      .values({
                        tenantId,
                        optionId,
                        value: optionValue,
                        displayOrder: valueMap.size,
                      })
                      .returning({ id: variantOptionValues.id });
                    valueId = newValue.id;
                    valueMap.set(optionValue.toLowerCase(), valueId);
                  }

                  resolvedOptionValueIds.push(valueId);
                }

                // Create the product variant
                const variantDisplayOrder =
                  (
                    await db.query.productVariants.findMany({
                      where: and(
                        eq(productVariants.tenantId, tenantId),
                        eq(productVariants.productId, parentId)
                      ),
                      columns: { displayOrder: true },
                    })
                  ).length + 1;

                const [newVariant] = await tx
                  .insert(productVariants)
                  .values({
                    tenantId,
                    productId: parentId,
                    displayName: row.data.name,
                    description: row.data.description || null,
                    sku: row.data.sku || null,
                    barcode: row.data.barcode || null,
                    price: row.data.price || null,
                    compareAtPrice: row.data.compare_at_price || null,
                    costPrice: row.data.cost_price || null,
                    stock: parseInt(row.data.stock || "0"),
                    weight: row.data.weight || null,
                    length: row.data.length || null,
                    width: row.data.width || null,
                    height: row.data.height || null,
                    displayOrder: row.data.display_order
                      ? parseInt(row.data.display_order)
                      : variantDisplayOrder,
                  })
                  .returning({ id: productVariants.id });

                // Link variant images to junction table (frontend uses variant.images)
                // Also create optionValueImages for gallery filtering (maps option values to images)
                if (row.imageFilenames.length > 0 && uploadedImages.size > 0) {
                  const variantImageRecords = row.imageFilenames
                    .map((filename, index) => {
                      const mediaId = uploadedImages.get(
                        filename.toLowerCase()
                      );
                      return mediaId
                        ? {
                            tenantId,
                            variantId: newVariant.id,
                            mediaId,
                            position: index,
                          }
                        : null;
                    })
                    .filter(
                      (rec): rec is NonNullable<typeof rec> => rec !== null
                    );

                  if (variantImageRecords.length > 0) {
                    await tx
                      .insert(productVariantImages)
                      .values(variantImageRecords);

                    // Also create optionValueImages for each option value + image combination
                    // This enables the "Variant Image Mapping" feature in dashboard
                    if (resolvedOptionValueIds.length > 0) {
                      const optionValueImageRecords: {
                        tenantId: string;
                        productId: string;
                        optionValueId: string;
                        mediaId: string;
                        position: number;
                      }[] = [];

                      for (const optionValueId of resolvedOptionValueIds) {
                        for (const record of variantImageRecords) {
                          optionValueImageRecords.push({
                            tenantId,
                            productId: parentId,
                            optionValueId,
                            mediaId: record.mediaId,
                            position: record.position,
                          });
                        }
                      }

                      if (optionValueImageRecords.length > 0) {
                        await tx
                          .insert(optionValueImages)
                          .values(optionValueImageRecords);
                      }
                    }
                  }
                }

                // Link variant to option values
                if (resolvedOptionValueIds.length > 0) {
                  await tx.insert(productVariantOptions).values(
                    resolvedOptionValueIds.map((optionValueId) => ({
                      tenantId,
                      variantId: newVariant.id,
                      optionValueId,
                    }))
                  );
                }

                importedCount++;
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Variant insert failed";
                importErrors.push({ row: row.rowNumber, errors: [message] });
              }
            }
          });
        } catch (batchError) {
          const message =
            batchError instanceof Error
              ? batchError.message
              : "Batch variant insert failed";
          for (const row of batch) {
            importErrors.push({ row: row.rowNumber, errors: [message] });
          }
        }
      }
    }

    // Mark onboarding complete if products were imported
    if (importedCount > 0) {
      await completeOnboardingItem(tenantId, "add_product");
    }

    revalidatePath("/dashboard");

    return {
      success: importedCount > 0,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      importedCount,
      errors: [
        ...rows
          .filter((r) => !r.isValid)
          .map((r) => ({ row: r.rowNumber, errors: r.errors })),
        ...importErrors,
      ],
    };
  } catch (error) {
    console.error("Bulk import error:", error);
    return {
      success: false,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      importedCount: 0,
      errors: [{ row: 0, errors: ["Import failed. Please try again."] }],
    };
  }
}
