"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import {
  products,
  categories,
  productCategories,
  variantOptions,
  variantOptionValues,
  productVariants,
  productVariantOptions,
} from "@/lib/db/schema";
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

// Maximum rows allowed per upload
const MAX_ROWS = 500;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Parse CSV/Excel file content and validate each row
 * Returns validated rows with errors for preview
 */
export async function parseFileForPreview(
  tenantId: string,
  fileContent: ArrayBuffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fileName: string
): Promise<ParsePreviewResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check file size
    if (fileContent.byteLength > MAX_FILE_SIZE) {
      return {
        success: false,
        error: "File is too large. Maximum size is 2MB.",
      };
    }

    // Parse file using xlsx (works for both CSV and Excel)
    const workbook = XLSX.read(fileContent, { type: "array" });
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

    // Get subscription info for product limit checking
    const overview = await getSubscriptionOverview(tenantId);
    const currentProductCount = overview?.productCount ?? 0;
    const productLimit = overview?.productLimit ?? null;
    const canImportCount =
      productLimit !== null
        ? Math.max(0, productLimit - currentProductCount)
        : Infinity;

    // Parse and validate each row
    const validatedRows: ValidatedRow[] = [];

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
      const categoryIds: string[] = [];
      const categoryField = rowData.category?.trim();
      if (categoryField) {
        // Split by semicolon and process each category
        const categoryNames = categoryField
          .split(/[;,]/)
          .map((c) => c.trim())
          .filter(Boolean);
        const notFoundCategories: string[] = [];

        for (const catName of categoryNames) {
          const catId = categoryMap[catName.toLowerCase()];
          if (catId) {
            categoryIds.push(catId);
          } else {
            notFoundCategories.push(catName);
          }
        }

        if (notFoundCategories.length > 0) {
          warnings.push(
            `Categories not found: ${notFoundCategories.join(", ")}. Product will be created without these categories.`
          );
        }
      }

      // Check product limit (only for main products, not variants)
      const isVariant = !!rowData.parent_product?.trim();
      if (!isVariant && productLimit !== null && i >= canImportCount) {
        errors.push(
          `Product limit exceeded. Upgrade to Pro for unlimited products.`
        );
      }

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
      });
    }

    return {
      success: true,
      rows: validatedRows,
      categoryMap,
      productLimitInfo: {
        currentCount: currentProductCount,
        limit: productLimit,
        canImport: Math.min(
          dataRows.length,
          canImportCount === Infinity ? dataRows.length : canImportCount
        ),
      },
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
 * Import validated products in batches with transactions
 * Two-pass approach:
 * 1. First pass: Create main products (rows without parent_product)
 * 2. Second pass: Create variants (rows with parent_product)
 */
export async function importProducts(
  tenantId: string,
  rows: ValidatedRow[]
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
                  displayOrder,
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
                    displayOrder: variantDisplayOrder,
                  })
                  .returning({ id: productVariants.id });

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
