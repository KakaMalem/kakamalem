"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { validateAmazonUrl, scrapeAmazonPage } from "@/lib/amazon/scraper";
import { parseAmazonPage } from "@/lib/amazon/parser";
import { importAmazonProduct } from "@/lib/amazon/importer";
import type {
  AmazonProduct,
  ScrapeResult,
  ImportResult,
} from "@/lib/amazon/types";

/**
 * Scrape an Amazon product page and return structured data for preview.
 * No images are downloaded at this stage — just extracts text data and image URLs.
 */
export async function scrapeAmazonProductAction(
  url: string
): Promise<ScrapeResult> {
  try {
    await requireAuth();

    // Validate URL
    const validation = validateAmazonUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Scrape the page
    const scrapeResult = await scrapeAmazonPage(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      return {
        success: false,
        error: scrapeResult.error || "Failed to fetch Amazon page",
      };
    }

    // Parse into structured data
    const product = parseAmazonPage(scrapeResult.data, url);

    // Validate we got meaningful data
    if (!product.title) {
      return {
        success: false,
        error:
          "Could not extract product title. Amazon may have changed their page structure, or the page did not load correctly. Try again.",
      };
    }

    return { success: true, product };
  } catch (error) {
    console.error("Amazon scrape error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while scraping",
    };
  }
}

/**
 * Import a previously scraped Amazon product into a store.
 * Downloads images, creates product record, and sets up variants.
 */
export async function importAmazonProductAction(
  tenantId: string,
  amazonProduct: AmazonProduct,
  overrides?: {
    name?: string;
    price?: string;
    status?: "draft" | "active";
    categoryIds?: string[];
  }
): Promise<ImportResult> {
  try {
    await requireAuth();

    // Check permissions
    const canManage = await canManageStore(tenantId);
    if (!canManage) {
      return {
        success: false,
        warnings: [],
        error: "You don't have permission to manage this store",
      };
    }

    // Import the product
    const result = await importAmazonProduct(amazonProduct, {
      tenantId,
      name: overrides?.name,
      price: overrides?.price,
      status: overrides?.status || "draft",
      categoryIds: overrides?.categoryIds,
    });

    if (result.success) {
      revalidatePath("/dashboard");
    }

    return result;
  } catch (error) {
    console.error("Amazon import error:", error);
    return {
      success: false,
      warnings: [],
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during import",
    };
  }
}
