"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import {
  validateAliExpressUrl,
  scrapeAliExpressPage,
} from "@/lib/aliexpress/scraper";
import { parseAliExpressPage } from "@/lib/aliexpress/parser";
import { importAliExpressProduct } from "@/lib/aliexpress/importer";
import { convertToAFN, getExchangeRates } from "@/lib/currency";
import type {
  AliExpressProduct,
  AliExpressScrapeResult,
  AliExpressImportResult,
} from "@/lib/aliexpress/types";

/**
 * Scrape an AliExpress product page and return structured data for preview.
 * No images are downloaded at this stage — just extracts text data and image URLs.
 */
export async function scrapeAliExpressProductAction(
  url: string
): Promise<AliExpressScrapeResult> {
  try {
    await requireAuth();

    // Validate URL
    const validation = validateAliExpressUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Scrape the page (with one retry)
    let scrapeResult = await scrapeAliExpressPage(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      // Retry once after a short delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      scrapeResult = await scrapeAliExpressPage(url);
      if (!scrapeResult.success || !scrapeResult.data) {
        return {
          success: false,
          error: scrapeResult.error || "Failed to fetch AliExpress page",
        };
      }
    }

    // Parse into structured data
    let product = parseAliExpressPage(scrapeResult.data, url);

    // If title extraction failed, retry once
    if (!product.title) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryResult = await scrapeAliExpressPage(url);
      if (retryResult.success && retryResult.data) {
        const retryProduct = parseAliExpressPage(retryResult.data, url);
        if (retryProduct.title) {
          product = retryProduct;
        }
      }
    }

    // Validate we got meaningful data
    if (!product.title) {
      const html = scrapeResult.data.html;
      const pageLen = html.length;
      console.error(
        `[AliExpress Scrape] Title extraction failed. ` +
          `Page length: ${pageLen}, ` +
          `Has og:title: ${html.includes("og:title")}, ` +
          `Has <title>: ${html.includes("<title")}`
      );

      return {
        success: false,
        error:
          "Could not extract product title. AliExpress may be blocking the request or the page structure is different. Please try again in a moment.",
      };
    }

    // Convert price from source currency to AFN
    let convertedPrice: number | undefined;
    let convertedOriginalPrice: number | undefined;

    if (
      product.price !== null &&
      product.currency &&
      product.currency !== "AFN"
    ) {
      try {
        const rates = await getExchangeRates();
        convertedPrice = Math.round(
          await convertToAFN(product.price, product.currency, rates)
        );
        if (product.originalPrice !== null) {
          convertedOriginalPrice = Math.round(
            await convertToAFN(product.originalPrice, product.currency, rates)
          );
        }
      } catch (err) {
        console.error("[AliExpress Scrape] Currency conversion failed:", err);
        // Fall back to original price
        convertedPrice = product.price;
        convertedOriginalPrice = product.originalPrice ?? undefined;
      }
    } else {
      convertedPrice = product.price ?? undefined;
      convertedOriginalPrice = product.originalPrice ?? undefined;
    }

    return {
      success: true,
      product,
      convertedPrice,
      convertedOriginalPrice,
    };
  } catch (error) {
    console.error("AliExpress scrape error:", error);
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
 * Import a previously scraped AliExpress product into a store.
 * Downloads images, creates product record, and sets up variants.
 */
export async function importAliExpressProductAction(
  tenantId: string,
  aliProduct: AliExpressProduct,
  overrides?: {
    name?: string;
    price?: string;
    status?: "draft" | "active";
    categoryIds?: string[];
  }
): Promise<AliExpressImportResult> {
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
    const result = await importAliExpressProduct(aliProduct, {
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
    console.error("AliExpress import error:", error);
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
