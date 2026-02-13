import * as cheerio from "cheerio";

// =============================================================================
// AMAZON PAGE SCRAPER
// =============================================================================
// Fetches Amazon product pages and extracts raw data from HTML + embedded JSON.
// Uses browser-like headers to avoid blocking.

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface RawAmazonData {
  html: string;
  $: cheerio.CheerioAPI;
  /** Embedded JSON data extracted from script tags */
  embeddedData: {
    colorImages?: Record<
      string,
      Array<{
        hiRes?: string | null;
        large?: string | null;
        thumb?: string | null;
        variant?: string;
      }>
    >;
    dimensionValuesDisplayData?: Record<string, string>;
    variationValues?: Record<string, string[]>;
    asinVariationValues?: Record<string, Record<string, string[]>>;
    parentAsin?: string;
    jsonLd?: Record<string, unknown>;
  };
}

/**
 * Validates that a URL is an Amazon product page
 */
export function validateAmazonUrl(url: string): {
  valid: boolean;
  error?: string;
  cleanUrl?: string;
} {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check if it's an Amazon domain
    if (
      !hostname.match(
        /^(www\.)?amazon\.(com|ae|co\.uk|de|fr|it|es|ca|com\.au|in|co\.jp|com\.br|sg|sa|eg|nl|se|pl|com\.be|com\.tr)/
      )
    ) {
      return {
        valid: false,
        error:
          "URL must be from an Amazon domain (e.g., amazon.ae, amazon.com)",
      };
    }

    // Check if it looks like a product page (contains /dp/ or /gp/product/)
    if (!parsed.pathname.match(/\/(dp|gp\/product)\/[A-Z0-9]{10}/i)) {
      return {
        valid: false,
        error:
          "URL does not appear to be an Amazon product page. It should contain /dp/ followed by a product ID.",
      };
    }

    // Extract ASIN and build clean URL
    const asinMatch = parsed.pathname.match(
      /\/(dp|gp\/product)\/([A-Z0-9]{10})/i
    );
    if (!asinMatch) {
      return { valid: false, error: "Could not extract product ID from URL" };
    }

    // Build clean URL with just the product path
    const cleanUrl = `${parsed.origin}/dp/${asinMatch[2]}`;
    return { valid: true, cleanUrl };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Fetches an Amazon product page with browser-like headers
 */
export async function fetchAmazonPage(
  url: string
): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
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
            "Amazon is temporarily blocking requests. Please try again in a few minutes.",
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
        error: `Failed to fetch Amazon page (HTTP ${response.status})`,
      };
    }

    const html = await response.text();

    // Check if we got a CAPTCHA page
    if (
      html.includes("Type the characters you see in this image") ||
      (html.includes("robot") && html.includes("captcha"))
    ) {
      return {
        success: false,
        error:
          "Amazon is showing a CAPTCHA. Please try again in a few minutes.",
      };
    }

    return { success: true, html };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Network error: ${error.message}`
          : "Failed to fetch Amazon page",
    };
  }
}

/**
 * Extracts embedded JSON data from Amazon's script tags.
 * Amazon embeds product data in JavaScript variables within the page.
 */
function extractEmbeddedData(
  $: cheerio.CheerioAPI
): RawAmazonData["embeddedData"] {
  const data: RawAmazonData["embeddedData"] = {};

  // Extract all script content for searching
  const scripts: string[] = [];
  $("script").each((_, el) => {
    const text = $(el).text();
    if (text.length > 100) {
      scripts.push(text);
    }
  });

  const allScripts = scripts.join("\n");

  // Extract colorImages (product gallery images)
  try {
    const colorImagesMatch = allScripts.match(
      /'colorImages'\s*:\s*({[\s\S]*?})\s*[,}]/
    );
    if (colorImagesMatch) {
      data.colorImages = JSON.parse(colorImagesMatch[1].replace(/'/g, '"'));
    }
  } catch {
    /* ignore parse errors */
  }

  // Try alternate image data format
  if (!data.colorImages) {
    try {
      const imageMatch = allScripts.match(
        /var\s+data\s*=\s*({[\s\S]*?"colorImages"[\s\S]*?});/
      );
      if (imageMatch) {
        const parsed = JSON.parse(imageMatch[1]);
        if (parsed.colorImages) {
          data.colorImages = parsed.colorImages;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Try ImageBlockATF data
  if (!data.colorImages) {
    try {
      const imgBlockMatch = allScripts.match(
        /'imageGalleryData'\s*:\s*(\[[\s\S]*?\])\s*[,}]/
      );
      if (imgBlockMatch) {
        const images = JSON.parse(imgBlockMatch[1].replace(/'/g, '"'));
        data.colorImages = { initial: images };
      }
    } catch {
      /* ignore */
    }
  }

  // Extract variation dimension display data
  try {
    const dimMatch = allScripts.match(
      /dimensionValuesDisplayData\s*[:=]\s*({[\s\S]*?})\s*[,;]/
    );
    if (dimMatch) {
      data.dimensionValuesDisplayData = JSON.parse(dimMatch[1]);
    }
  } catch {
    /* ignore */
  }

  // Extract variation values (e.g., {"size_name": ["S", "M", "L"]})
  try {
    const varValMatch = allScripts.match(
      /variationValues\s*[:=]\s*({[\s\S]*?})\s*[,;]/
    );
    if (varValMatch) {
      data.variationValues = JSON.parse(varValMatch[1]);
    }
  } catch {
    /* ignore */
  }

  // Extract ASIN to variation value mapping
  try {
    const asinVarMatch = allScripts.match(
      /asinVariationValues\s*[:=]\s*({[\s\S]*?})\s*[,;\n}]/
    );
    if (asinVarMatch) {
      data.asinVariationValues = JSON.parse(asinVarMatch[1]);
    }
  } catch {
    /* ignore */
  }

  // Extract parent ASIN
  try {
    const parentMatch = allScripts.match(
      /parentAsin\s*[:=]\s*["']([A-Z0-9]{10})["']/
    );
    if (parentMatch) {
      data.parentAsin = parentMatch[1];
    }
  } catch {
    /* ignore */
  }

  // Extract JSON-LD structured data
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
 * Fetches and preprocesses an Amazon product page.
 * Returns the raw HTML, cheerio instance, and extracted embedded data.
 */
export async function scrapeAmazonPage(
  url: string
): Promise<{ success: boolean; data?: RawAmazonData; error?: string }> {
  // Validate URL
  const validation = validateAmazonUrl(url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Fetch the page
  const fetchResult = await fetchAmazonPage(validation.cleanUrl!);
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
