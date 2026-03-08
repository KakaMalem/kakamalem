import * as cheerio from "cheerio";

// =============================================================================
// ALIEXPRESS PAGE SCRAPER
// =============================================================================
// Fetches AliExpress product pages and extracts raw data from HTML + embedded JSON.
// Uses browser-like headers to avoid blocking.
// =============================================================================

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface RawAliExpressData {
  html: string;
  $: cheerio.CheerioAPI;
  /** Embedded JSON data extracted from script tags */
  embeddedData: {
    /** The main product data object from window.__INIT_DATA__ or similar */
    productData?: Record<string, unknown>;
    /** JSON-LD structured data */
    jsonLd?: Record<string, unknown>;
    /** SKU data (variants/options) */
    skuData?: {
      skuList?: Array<{
        skuId: string;
        skuVal?: {
          skuAmount?: { value?: number; currency?: string };
          skuCalPrice?: string;
          availQuantity?: number;
          inventory?: number;
          actSkuCalPrice?: string;
          actSkuMultiCurrencyCalPrice?: string;
        };
        skuPropIds?: string;
        skuAttr?: string;
      }>;
      skuPropertyList?: Array<{
        skuPropertyId: number;
        skuPropertyName: string;
        skuPropertyValues: Array<{
          propertyValueId: number;
          propertyValueIdLong: number;
          propertyValueName: string;
          propertyValueDisplayName?: string;
          skuPropertyImagePath?: string;
          skuPropertyTips?: string;
        }>;
      }>;
    };
    /** Image gallery data */
    imageList?: string[];
    /** Store info */
    storeInfo?: {
      storeName?: string;
      storeUrl?: string;
    };
    /** Price info */
    priceInfo?: {
      minPrice?: number;
      maxPrice?: number;
      minActivityPrice?: number;
      maxActivityPrice?: number;
      currencyCode?: string;
    };
  };
}

/**
 * Validates that a URL is an AliExpress product page
 */
export function validateAliExpressUrl(url: string): {
  valid: boolean;
  error?: string;
  cleanUrl?: string;
  productId?: string;
} {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check if it's an AliExpress domain
    if (!hostname.match(/^(www\.)?([\w-]+\.)?aliexpress\.(com|ru|us)/)) {
      return {
        valid: false,
        error: "URL must be from an AliExpress domain (e.g., aliexpress.com)",
      };
    }

    // Extract product ID from URL patterns:
    // /item/1005007123456789.html
    // /item/1005007123456789
    // /i/1005007123456789.html
    const pathMatch = parsed.pathname.match(/\/(?:item|i)\/(\d+)(?:\.html)?/);

    if (!pathMatch) {
      return {
        valid: false,
        error:
          "URL does not appear to be an AliExpress product page. It should contain /item/ followed by a product ID.",
      };
    }

    const productId = pathMatch[1];
    // Build clean URL
    const cleanUrl = `https://www.aliexpress.com/item/${productId}.html`;
    return { valid: true, cleanUrl, productId };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Fetches an AliExpress product page with browser-like headers
 */
export async function fetchAliExpressPage(
  url: string
): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Connection: "keep-alive",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      if (response.status === 503) {
        return {
          success: false,
          error:
            "AliExpress is temporarily blocking requests. Please try again in a few minutes.",
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "Product not found. Please check the URL and try again.",
        };
      }
      return {
        success: false,
        error: `Failed to fetch AliExpress page (HTTP ${response.status})`,
      };
    }

    const html = await response.text();

    // Check if we got a CAPTCHA or bot detection page
    if (
      html.includes("slider verification") ||
      html.includes("captcha") ||
      html.includes("robot check") ||
      html.includes("Please slide to verify")
    ) {
      return {
        success: false,
        error:
          "AliExpress is showing a CAPTCHA. Please try again in a few minutes.",
      };
    }

    // Check we got a real product page
    if (html.length < 5000 || !html.includes("<body")) {
      return {
        success: false,
        error:
          "AliExpress returned an incomplete page. Please try again in a moment.",
      };
    }

    return { success: true, html };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Network error: ${error.message}`
          : "Failed to fetch AliExpress page",
    };
  }
}

/**
 * Extracts embedded JSON data from AliExpress's script tags.
 * AliExpress embeds product data in window.__INIT_DATA__, runParams, etc.
 */
function extractEmbeddedData(
  $: cheerio.CheerioAPI
): RawAliExpressData["embeddedData"] {
  const data: RawAliExpressData["embeddedData"] = {};

  // Extract all script content for searching
  const scripts: string[] = [];
  $("script").each((_, el) => {
    const text = $(el).text();
    if (text.length > 100) {
      scripts.push(text);
    }
  });

  const allScripts = scripts.join("\n");

  // Try to extract __INIT_DATA__ (newer AliExpress pages)
  try {
    const initDataMatch = allScripts.match(
      /window\.__INIT_DATA__\s*=\s*({[\s\S]*?});\s*(?:window\.|<\/script>)/
    );
    if (initDataMatch) {
      const parsed = JSON.parse(initDataMatch[1]);
      data.productData = parsed;
    }
  } catch {
    /* ignore parse errors */
  }

  // Try to extract from runParams / data (older AliExpress format)
  if (!data.productData) {
    try {
      const runParamsMatch = allScripts.match(
        /var\s+runParams\s*=\s*({[\s\S]*?});\s*(?:var|<\/script>)/
      );
      if (runParamsMatch) {
        data.productData = JSON.parse(runParamsMatch[1]);
      }
    } catch {
      /* ignore */
    }
  }

  // Try window.runParams pattern
  if (!data.productData) {
    try {
      const windowRunParams = allScripts.match(
        /window\.runParams\s*=\s*({[\s\S]*?});\s*(?:window\.|<\/script>)/
      );
      if (windowRunParams) {
        data.productData = JSON.parse(windowRunParams[1]);
      }
    } catch {
      /* ignore */
    }
  }

  // Extract SKU data from nested paths in productData
  if (data.productData) {
    try {
      // Navigate common AliExpress data structures
      const pd = data.productData as Record<string, unknown>;

      // Try multiple data paths for SKU info
      const skuModule =
        getNestedValue(pd, "data.skuModule") ||
        getNestedValue(pd, "skuModule") ||
        getNestedValue(pd, "data.components.skuInfo") ||
        getNestedValue(pd, "data.root.fields.skuModule");

      if (skuModule && typeof skuModule === "object") {
        const sku = skuModule as Record<string, unknown>;
        data.skuData = {
          skuList: sku.skuList as NonNullable<
            RawAliExpressData["embeddedData"]["skuData"]
          >["skuList"],
          skuPropertyList: (sku.productSKUPropertyList ||
            sku.skuPropertyList) as NonNullable<
            RawAliExpressData["embeddedData"]["skuData"]
          >["skuPropertyList"],
        };
      }

      // Extract image data
      const imageModule =
        getNestedValue(pd, "data.imageModule") ||
        getNestedValue(pd, "imageModule") ||
        getNestedValue(pd, "data.root.fields.imageModule");

      if (imageModule && typeof imageModule === "object") {
        const imgMod = imageModule as Record<string, unknown>;
        data.imageList = (imgMod.imagePathList as string[]) || [];
      }

      // Extract store data
      const storeModule =
        getNestedValue(pd, "data.storeModule") ||
        getNestedValue(pd, "storeModule") ||
        getNestedValue(pd, "data.root.fields.storeModule");

      if (storeModule && typeof storeModule === "object") {
        const store = storeModule as Record<string, unknown>;
        data.storeInfo = {
          storeName: store.storeName as string,
          storeUrl: store.storeURL as string,
        };
      }

      // Extract price data
      const priceModule =
        getNestedValue(pd, "data.priceModule") ||
        getNestedValue(pd, "priceModule") ||
        getNestedValue(pd, "data.root.fields.priceModule");

      if (priceModule && typeof priceModule === "object") {
        const price = priceModule as Record<string, unknown>;
        const minPrice = price.minPrice || price.formatedActivityPrice;
        const maxPrice = price.maxPrice;
        data.priceInfo = {
          minPrice:
            typeof minPrice === "number"
              ? minPrice
              : parseFloat(String(minPrice)) || undefined,
          maxPrice:
            typeof maxPrice === "number"
              ? maxPrice
              : parseFloat(String(maxPrice)) || undefined,
          currencyCode: (price.currencyCode as string) || "USD",
        };
      }
    } catch {
      /* ignore extraction errors */
    }
  }

  // Extract JSON-LD structured data (reliable fallback)
  try {
    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed["@type"] === "Product" || parsed.name) {
          data.jsonLd = parsed;
        }
      }
    });
  } catch {
    /* ignore */
  }

  return data;
}

/**
 * Safely access nested object properties via dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Fetches and preprocesses an AliExpress product page.
 * Returns the raw HTML, cheerio instance, and extracted embedded data.
 */
export async function scrapeAliExpressPage(
  url: string
): Promise<{ success: boolean; data?: RawAliExpressData; error?: string }> {
  // Validate URL
  const validation = validateAliExpressUrl(url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Fetch the page
  const fetchResult = await fetchAliExpressPage(validation.cleanUrl!);
  if (!fetchResult.success || !fetchResult.html) {
    return { success: false, error: fetchResult.error };
  }

  // Parse HTML
  const $ = cheerio.load(fetchResult.html);

  // Extract embedded data
  const embeddedData = extractEmbeddedData($);

  return {
    success: true,
    data: {
      html: fetchResult.html,
      $,
      embeddedData,
    },
  };
}
