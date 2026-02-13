import type { CheerioAPI } from "cheerio";
import type {
  AmazonProduct,
  AmazonImage,
  AmazonVariant,
  AmazonVariantOption,
} from "./types";
import type { RawAmazonData } from "./scraper";

// =============================================================================
// AMAZON PAGE PARSER
// =============================================================================
// Transforms raw scraped HTML/JSON into a structured AmazonProduct object.

/**
 * Extract the ASIN from the page
 */
function extractAsin($: CheerioAPI, url: string): string {
  // Try from URL first
  const urlMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1];

  // Try from page data
  const asinInput = $('input[name="ASIN"]').val();
  if (typeof asinInput === "string" && asinInput) return asinInput;

  // Try data attribute
  const detailAsin = $("#detailBullets_feature_div").attr("data-csa-c-asin");
  if (detailAsin) return detailAsin;

  return "";
}

/**
 * Extract product title
 */
function extractTitle($: CheerioAPI): string {
  // Primary selector
  const title = $("#productTitle").text().trim();
  if (title) return title;

  // Fallback selectors
  const altTitle = $("h1.a-size-large span").first().text().trim();
  if (altTitle) return altTitle;

  const metaTitle = $('meta[name="title"]').attr("content");
  if (metaTitle) return metaTitle.trim();

  return "";
}

/**
 * Extract brand name
 */
function extractBrand($: CheerioAPI): string | null {
  // By brand link
  const byline = $("#bylineInfo").text().trim();
  if (byline) {
    // Remove "Visit the X Store" or "Brand: X"
    const brandMatch = byline.match(
      /(?:Visit the\s+(.+?)\s+Store|Brand:\s*(.+))/i
    );
    if (brandMatch) return (brandMatch[1] || brandMatch[2]).trim();
    return (
      byline
        .replace(/^(Visit the|Brand:)\s*/i, "")
        .replace(/\s*Store$/i, "")
        .trim() || null
    );
  }

  // From detail bullets
  let brand: string | null = null;
  $(
    "#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr"
  ).each((_, el) => {
    const text = $(el).text();
    if (text.match(/brand/i)) {
      const value = $(el).find("span span, td").last().text().trim();
      if (value) brand = value;
    }
  });

  return brand;
}

/**
 * Extract price from the page
 */
function extractPrice($: CheerioAPI): {
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
} {
  let price: number | null = null;
  let compareAtPrice: number | null = null;
  let currency = "USD";

  // Try the main price display
  const priceWhole = $(".a-price .a-price-whole")
    .first()
    .text()
    .replace(/[,.\s]/g, "");
  const priceFraction = $(".a-price .a-price-fraction").first().text().trim();

  if (priceWhole) {
    price = parseFloat(`${priceWhole}.${priceFraction || "00"}`);
  }

  // Try #priceblock_ourprice or #priceblock_dealprice
  if (price === null) {
    const priceText = (
      $("#priceblock_ourprice").text() ||
      $("#priceblock_dealprice").text() ||
      ""
    ).trim();
    const parsed = parsePriceString(priceText);
    if (parsed.amount !== null) {
      price = parsed.amount;
      if (parsed.currency) currency = parsed.currency;
    }
  }

  // Try apex price
  if (price === null) {
    const apexPrice = $(".a-price .a-offscreen").first().text().trim();
    const parsed = parsePriceString(apexPrice);
    if (parsed.amount !== null) {
      price = parsed.amount;
      if (parsed.currency) currency = parsed.currency;
    }
  }

  // Try to get compare-at price (original price / "was" price)
  const listPriceText = $(
    ".basisPrice .a-offscreen, .a-text-price .a-offscreen"
  )
    .first()
    .text()
    .trim();
  if (listPriceText) {
    const parsed = parsePriceString(listPriceText);
    if (parsed.amount !== null && parsed.amount !== price) {
      compareAtPrice = parsed.amount;
    }
  }

  // Detect currency from price symbol on page
  const priceSymbol = $(".a-price-symbol").first().text().trim();
  if (priceSymbol) {
    currency = currencyFromSymbol(priceSymbol);
  }

  // Detect from the full price display
  const fullPriceText = $(".a-price .a-offscreen").first().text().trim();
  if (fullPriceText) {
    const detected = detectCurrency(fullPriceText);
    if (detected) currency = detected;
  }

  return { price, compareAtPrice, currency };
}

/**
 * Parse a price string like "AED 1,299.00" or "$49.99" into a number
 */
function parsePriceString(text: string): {
  amount: number | null;
  currency?: string;
} {
  if (!text) return { amount: null };

  // Remove non-price characters but keep digits, dots, commas
  const cleaned = text.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return { amount: null };

  // Handle formats: "1,299.00" or "1.299,00" (European)
  let numStr = cleaned;

  // If there's both comma and dot, determine which is the decimal separator
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European format: 1.299,00
      numStr = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,299.00
      numStr = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Could be either "1,299" (thousand separator) or "12,99" (decimal)
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 2 && parts.length === 2) {
      // Likely decimal: "12,99"
      numStr = cleaned.replace(",", ".");
    } else {
      // Likely thousand separator: "1,299"
      numStr = cleaned.replace(/,/g, "");
    }
  }

  const amount = parseFloat(numStr);
  const currency = detectCurrency(text);

  return {
    amount: isNaN(amount) ? null : amount,
    currency: currency || undefined,
  };
}

/**
 * Detect currency from a price string
 */
function detectCurrency(text: string): string | null {
  if (text.includes("AED") || text.includes("د.إ")) return "AED";
  if (text.includes("$") && text.includes("US")) return "USD";
  if (text.includes("$")) return "USD";
  if (text.includes("£")) return "GBP";
  if (text.includes("€")) return "EUR";
  if (text.includes("¥")) return "JPY";
  if (text.includes("₹")) return "INR";
  if (text.includes("SAR") || text.includes("ر.س")) return "SAR";
  return null;
}

/**
 * Map currency symbol to currency code
 */
function currencyFromSymbol(symbol: string): string {
  const map: Record<string, string> = {
    $: "USD",
    "£": "GBP",
    "€": "EUR",
    "¥": "JPY",
    "₹": "INR",
    AED: "AED",
    SAR: "SAR",
    EGP: "EGP",
  };
  return map[symbol] || "USD";
}

/**
 * Extract ALL image sets from embedded data, keyed by ASIN or "initial".
 * Returns a map so we can assign images to specific variants later.
 */
function extractImageSets(
  embeddedData: RawAmazonData["embeddedData"]
): Record<string, AmazonImage[]> {
  const imageSets: Record<string, AmazonImage[]> = {};

  if (!embeddedData.colorImages) return imageSets;

  for (const [key, imageArray] of Object.entries(embeddedData.colorImages)) {
    if (!Array.isArray(imageArray) || imageArray.length === 0) continue;

    const images: AmazonImage[] = [];
    for (const img of imageArray) {
      const hiRes = img.hiRes || null;
      const large = img.large || null;
      const thumb = img.thumb || null;

      if (hiRes || large || thumb) {
        images.push({ hiRes, large, thumb, variant: img.variant });
      }
    }

    if (images.length > 0) {
      imageSets[key] = images;
    }
  }

  return imageSets;
}

/**
 * Extract product images from embedded data or HTML.
 * Returns the "main" images (initial/first set).
 */
function extractImages(
  $: CheerioAPI,
  embeddedData: RawAmazonData["embeddedData"]
): AmazonImage[] {
  // Try embedded colorImages data first (most reliable)
  const imageSets = extractImageSets(embeddedData);

  // Use "initial" key first, then fall back to the first available set
  const mainImages = imageSets["initial"] || Object.values(imageSets)[0] || [];

  if (mainImages.length > 0) {
    return deduplicateImages(mainImages);
  }

  // Fallback: extract from image elements
  const fallbackImages: AmazonImage[] = [];

  // Main image
  const mainImgSrc =
    $("#landingImage, #imgBlkFront").attr("data-old-hires") ||
    $("#landingImage, #imgBlkFront").attr("src");
  if (mainImgSrc) {
    fallbackImages.push({
      hiRes: mainImgSrc,
      large: mainImgSrc,
      thumb: null,
      variant: "MAIN",
    });
  }

  // Thumbnail strip
  $(".imageThumbnail img, #altImages img").each((_, el) => {
    let src = $(el).attr("src");
    if (src && !src.includes("play-icon") && !src.includes("360")) {
      // Convert thumbnail URL to high-res by replacing size parameters
      src = src.replace(/\._.*_\./, ".");
      fallbackImages.push({
        hiRes: src,
        large: src,
        thumb: $(el).attr("src") || null,
      });
    }
  });

  return deduplicateImages(fallbackImages);
}

/**
 * Deduplicate images by their best URL
 */
function deduplicateImages(images: AmazonImage[]): AmazonImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = img.hiRes || img.large || img.thumb || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract feature bullet points
 */
function extractFeatureBullets($: CheerioAPI): string[] {
  const bullets: string[] = [];

  $("#feature-bullets li .a-list-item, #feature-bullets ul li").each(
    (_, el) => {
      const text = $(el).text().trim();
      // Skip the "See more" link and empty entries
      if (text && !text.startsWith("›") && text.length > 3) {
        bullets.push(text);
      }
    }
  );

  return bullets;
}

/**
 * Extract product description HTML
 */
function extractDescription($: CheerioAPI): string {
  // Try product description div
  const descHtml = $("#productDescription").html();
  if (descHtml) {
    const cleaned = descHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/class="[^"]*"/g, "")
      .replace(/style="[^"]*"/g, "")
      .trim();
    if (cleaned.replace(/<[^>]*>/g, "").trim().length > 10) {
      return cleaned;
    }
  }

  // Try A+ content / aplus module
  const aplusHtml = $("#aplus .aplus-v2, #aplus_feature_div").html();
  if (aplusHtml) {
    return aplusHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/class="[^"]*"/g, "")
      .replace(/style="[^"]*"/g, "")
      .trim();
  }

  return "";
}

/**
 * Extract technical specifications
 */
function extractSpecifications($: CheerioAPI): Record<string, string> {
  const specs: Record<string, string> = {};

  // Try product details table
  $(
    "#productDetails_techSpec_section_1 tr, #technicalSpecifications_section_1 tr"
  ).each((_, el) => {
    const label = $(el).find("th").text().trim();
    const value = $(el).find("td").text().trim();
    if (label && value) {
      specs[label] = value;
    }
  });

  // Try detail bullets
  if (Object.keys(specs).length === 0) {
    $("#detailBullets_feature_div li, .detail-bullet-list li").each((_, el) => {
      const text = $(el).text().trim();
      const parts = text.split(/\s*[:\u200F\u200E]\s*/);
      if (parts.length >= 2) {
        const label = parts[0].replace(/[^\w\s]/g, "").trim();
        const value = parts.slice(1).join(":").trim();
        if (label && value && label.length < 100) {
          specs[label] = value;
        }
      }
    });
  }

  // Try additional info table
  $("#productDetails_detailBullets_sections1 tr").each((_, el) => {
    const label = $(el).find("th").text().trim();
    const value = $(el).find("td").text().trim();
    if (label && value) {
      specs[label] = value;
    }
  });

  return specs;
}

/**
 * Extract rating and review count
 */
function extractRating($: CheerioAPI): {
  rating: number | null;
  reviewCount: number | null;
} {
  let rating: number | null = null;
  let reviewCount: number | null = null;

  // Rating
  const ratingText = $(".a-icon-star .a-icon-alt, #acrPopover .a-icon-alt")
    .first()
    .text()
    .trim();
  if (ratingText) {
    const match = ratingText.match(/([\d.]+)/);
    if (match) rating = parseFloat(match[1]);
  }

  // Review count
  const reviewText = ($("#acrCustomerReviewText").text() || "").trim();
  if (reviewText) {
    const match = reviewText.match(/([\d,]+)/);
    if (match) reviewCount = parseInt(match[1].replace(/,/g, ""));
  }

  return { rating, reviewCount };
}

/**
 * Extract variant options and their values from embedded data
 */
function extractVariants(
  $: CheerioAPI,
  embeddedData: RawAmazonData["embeddedData"]
): { options: AmazonVariantOption[]; variants: AmazonVariant[] } {
  const options: AmazonVariantOption[] = [];
  const variants: AmazonVariant[] = [];

  // Try variationValues for option names and values
  if (embeddedData.variationValues) {
    for (const [rawKey, values] of Object.entries(
      embeddedData.variationValues
    )) {
      if (!Array.isArray(values) || values.length === 0) continue;

      // Clean up the key name (e.g., "size_name" → "Size", "color_name" → "Color")
      const name = formatOptionName(rawKey);

      options.push({
        name,
        values: values.map((v) => ({
          value: v,
        })),
      });
    }
  }

  // Get per-ASIN image sets for assigning to variants
  const imageSets = extractImageSets(embeddedData);

  // Try to extract variants from ASIN variation mapping
  if (embeddedData.asinVariationValues) {
    for (const [asin, valueMap] of Object.entries(
      embeddedData.asinVariationValues
    )) {
      const optionMap: Record<string, string> = {};
      for (const [rawKey, vals] of Object.entries(valueMap)) {
        const name = formatOptionName(rawKey);
        optionMap[name] = Array.isArray(vals) ? vals[0] : String(vals);
      }

      // Look up images for this ASIN from colorImages
      const variantImages = imageSets[asin] || [];

      variants.push({
        asin,
        title: Object.values(optionMap).join(" / "),
        options: optionMap,
        price: null,
        images: deduplicateImages(variantImages),
        available: true,
      });
    }
  }

  // If no embedded variant data, try the twister/dimension data from HTML
  if (options.length === 0) {
    // Check for twister-based variants
    const twisterDiv = $("#twister");
    if (twisterDiv.length > 0) {
      twisterDiv.find(".a-row").each((_, row) => {
        const label = $(row)
          .find(".a-form-label, label")
          .text()
          .replace(":", "")
          .trim();
        if (!label) return;

        const values: string[] = [];
        $(row)
          .find("li, option")
          .each((_, option) => {
            const val =
              $(option)
                .attr("title")
                ?.replace(/^Click to select\s+/i, "")
                .trim() || $(option).text().trim();
            if (val && val !== "Select" && val.length < 100) {
              values.push(val);
            }
          });

        if (values.length > 0) {
          options.push({
            name: label,
            values: values.map((v) => ({ value: v })),
          });
        }
      });
    }
  }

  // Add swatch images to color options
  if (options.length > 0) {
    const colorOption = options.find(
      (o) =>
        o.name.toLowerCase().includes("color") ||
        o.name.toLowerCase().includes("colour")
    );
    if (colorOption) {
      $(".imgSwatch, #variation_color_name li img").each((i, el) => {
        const src = $(el).attr("src");
        const alt = $(el).attr("alt") || "";
        if (src && i < colorOption.values.length) {
          // Try to match by alt text or index
          const matchingValue =
            colorOption.values.find(
              (v) => v.value.toLowerCase() === alt.toLowerCase()
            ) || colorOption.values[i];
          if (matchingValue) {
            matchingValue.imageUrl = src.replace(/\._.*_\./, "._SL250_.");
          }
        }
      });
    }
  }

  return { options, variants };
}

/**
 * Format Amazon's internal option key names to display names
 */
function formatOptionName(key: string): string {
  return key
    .replace(/_name$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Parse a raw Amazon page into a structured AmazonProduct
 */
export function parseAmazonPage(
  rawData: RawAmazonData,
  url: string
): AmazonProduct {
  const { $, embeddedData } = rawData;

  const title = extractTitle($);
  const brand = extractBrand($);
  const { price, compareAtPrice, currency } = extractPrice($);
  const images = extractImages($, embeddedData);
  const featureBullets = extractFeatureBullets($);
  const description = extractDescription($);
  const specifications = extractSpecifications($);
  const { rating, reviewCount } = extractRating($);
  const { options: variantOptions, variants } = extractVariants(
    $,
    embeddedData
  );
  const asin = extractAsin($, url);

  return {
    title,
    description,
    featureBullets,
    price,
    currency,
    compareAtPrice,
    images,
    variants,
    variantOptions,
    specifications,
    asin,
    url,
    brand,
    rating,
    reviewCount,
  };
}
