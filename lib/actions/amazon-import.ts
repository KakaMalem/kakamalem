"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { validateAmazonUrl, scrapeAmazonPage } from "@/lib/amazon/scraper";
import { parseAmazonPage } from "@/lib/amazon/parser";
import { importAmazonProduct } from "@/lib/amazon/importer";
import { convertToAFN, getExchangeRates } from "@/lib/currency";
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

    // Scrape the page (with one retry)
    let scrapeResult = await scrapeAmazonPage(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      // Retry once after a short delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      scrapeResult = await scrapeAmazonPage(url);
      if (!scrapeResult.success || !scrapeResult.data) {
        return {
          success: false,
          error: scrapeResult.error || "Failed to fetch Amazon page",
        };
      }
    }

    // Parse into structured data
    let product = parseAmazonPage(scrapeResult.data, url);

    // If title extraction failed, retry once
    if (!product.title) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryResult = await scrapeAmazonPage(url);
      if (retryResult.success && retryResult.data) {
        const retryProduct = parseAmazonPage(retryResult.data, url);
        if (retryProduct.title) {
          product = retryProduct;
        }
      }
    }

    // Validate we got meaningful data
    if (!product.title) {
      // Log diagnostic info for debugging
      const html = scrapeResult.data.html;
      const hasProductTitle = html.includes("productTitle");
      const hasDpId = html.includes("/dp/");
      const pageLen = html.length;
      console.error(
        `[Amazon Scrape] Title extraction failed. ` +
          `Page length: ${pageLen}, ` +
          `Has #productTitle: ${hasProductTitle}, ` +
          `Has /dp/: ${hasDpId}, ` +
          `Has og:title: ${html.includes("og:title")}, ` +
          `Has <title>: ${html.includes("<title")}`
      );

      return {
        success: false,
        error:
          "Could not extract product title. Amazon may be blocking the request or the page structure is different. Please try again in a moment.",
      };
    }

    // Convert price from Amazon currency to AFN
    let convertedPrice: number | undefined;
    let convertedCompareAtPrice: number | undefined;

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
        if (product.compareAtPrice !== null) {
          convertedCompareAtPrice = Math.round(
            await convertToAFN(product.compareAtPrice, product.currency, rates)
          );
        }
      } catch (err) {
        console.error("[Amazon Scrape] Currency conversion failed:", err);
        // Fall back to original price
        convertedPrice = product.price;
        convertedCompareAtPrice = product.compareAtPrice ?? undefined;
      }
    } else {
      convertedPrice = product.price ?? undefined;
      convertedCompareAtPrice = product.compareAtPrice ?? undefined;
    }

    return {
      success: true,
      product,
      convertedPrice,
      convertedCompareAtPrice,
    };
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
