import type { RawAliExpressData } from "./scraper";
import type {
  AliExpressProduct,
  AliExpressImage,
  AliExpressVariant,
  AliExpressVariantOption,
} from "./types";

// =============================================================================
// ALIEXPRESS PAGE PARSER
// =============================================================================
// Parses raw AliExpress HTML/embedded data into structured product data.
// Handles multiple page formats (old runParams, new __INIT_DATA__).
// =============================================================================

/**
 * Parse raw AliExpress data into a structured AliExpressProduct
 */
export function parseAliExpressPage(
  rawData: RawAliExpressData,
  originalUrl: string
): AliExpressProduct {
  const { $, embeddedData } = rawData;
  const pd = embeddedData.productData as Record<string, unknown> | undefined;

  // Extract product ID from URL
  const productIdMatch = originalUrl.match(/\/(?:item|i)\/(\d+)/);
  const productId = productIdMatch ? productIdMatch[1] : "";

  // 1. Extract title
  const title = extractTitle($, pd, embeddedData.jsonLd);

  // 2. Extract description
  const description = extractDescription($, pd);

  // 3. Extract features
  const features = extractFeatures($, pd);

  // 4. Extract price
  const { price, originalPrice, currency } = extractPrice(
    $,
    pd,
    embeddedData.priceInfo,
    embeddedData.jsonLd
  );

  // 5. Extract images
  const images = extractImages($, embeddedData.imageList);

  // 6. Extract variants and options
  const { variants, variantOptions } = extractVariants(
    embeddedData.skuData,
    pd,
    currency
  );

  // 7. Extract specifications
  const specifications = extractSpecifications($, pd);

  // 8. Extract store info
  const storeName =
    embeddedData.storeInfo?.storeName || extractStoreName($) || null;
  const storeUrl = embeddedData.storeInfo?.storeUrl || null;

  // 9. Extract rating and reviews
  const { rating, reviewCount, orderCount } = extractRatingAndReviews($, pd);

  // 10. Extract shipping info
  const shippingInfo = extractShippingInfo($, pd);

  return {
    title,
    description,
    features,
    price,
    currency,
    originalPrice,
    images,
    variants,
    variantOptions,
    specifications,
    productId,
    url: originalUrl,
    storeName,
    storeUrl,
    rating,
    reviewCount,
    orderCount,
    shippingInfo,
  };
}

// =============================================================================
// Extraction Helpers
// =============================================================================

function extractTitle(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>,
  jsonLd?: Record<string, unknown>
): string {
  // Try embedded data first
  if (pd) {
    const titleData =
      getNestedValue(pd, "data.titleModule.subject") ||
      getNestedValue(pd, "titleModule.subject") ||
      getNestedValue(pd, "data.root.fields.titleModule.subject") ||
      getNestedValue(pd, "data.productInfoComponent.subject");
    if (typeof titleData === "string") return titleData.trim();
  }

  // Try JSON-LD
  if (jsonLd?.name && typeof jsonLd.name === "string") {
    return jsonLd.name.trim();
  }

  // Try HTML selectors
  const selectors = [
    "h1.product-title-text",
    "h1[data-pl='product-title']",
    ".product-title",
    'meta[property="og:title"]',
    "title",
  ];

  for (const selector of selectors) {
    if (selector.startsWith("meta")) {
      const content = $(selector).attr("content");
      if (content) {
        // Clean up meta title (remove " | AliExpress" suffix)
        return content.replace(/\s*[|\-–]\s*AliExpress.*$/i, "").trim();
      }
    } else {
      const text = $(selector).first().text().trim();
      if (text) return text;
    }
  }

  return "";
}

function extractDescription(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>
): string {
  // Try embedded data
  if (pd) {
    // Attempt to get description from product data paths
    // AliExpress often stores description as a separate URL — we can't fetch it here
    const _descriptionUrl =
      getNestedValue(pd, "data.descriptionModule.descriptionUrl") ||
      getNestedValue(pd, "descriptionModule.descriptionUrl") ||
      getNestedValue(pd, "data.root.fields.descriptionModule.descriptionUrl");

    // Instead try to get inline description
    const inlineDesc =
      getNestedValue(pd, "data.descriptionModule.description") ||
      getNestedValue(pd, "descriptionModule.description");
    if (typeof inlineDesc === "string" && inlineDesc.length > 10) {
      return inlineDesc;
    }
  }

  // Try HTML selectors
  const descSelectors = [
    ".product-description",
    "#product-description",
    ".detail-desc-decorate-richtext",
  ];

  for (const sel of descSelectors) {
    const html = $(sel).first().html();
    if (html && html.trim().length > 10) return html.trim();
  }

  // Try og:description
  const ogDesc = $('meta[property="og:description"]').attr("content");
  if (ogDesc) return `<p>${escapeHtml(ogDesc)}</p>`;

  return "";
}

function extractFeatures(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>
): string[] {
  const features: string[] = [];

  // Try embedded data — specifications often double as features
  if (pd) {
    const specsModule =
      getNestedValue(pd, "data.specsModule.props") ||
      getNestedValue(pd, "specsModule.props") ||
      getNestedValue(pd, "data.root.fields.specsModule.props");

    if (Array.isArray(specsModule)) {
      for (const spec of specsModule.slice(0, 10)) {
        if (
          spec &&
          typeof spec === "object" &&
          "attrName" in spec &&
          "attrValue" in spec
        ) {
          features.push(`${spec.attrName}: ${spec.attrValue}`);
        }
      }
    }
  }

  // Try HTML product highlights
  $(".product-highlight li, .sku-property-text").each((_, el) => {
    const text = $(el).text().trim();
    if (text && features.length < 15) {
      features.push(text);
    }
  });

  return features;
}

function extractPrice(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>,
  priceInfo?: RawAliExpressData["embeddedData"]["priceInfo"],
  jsonLd?: Record<string, unknown>
): { price: number | null; originalPrice: number | null; currency: string } {
  let price: number | null = null;
  let originalPrice: number | null = null;
  let currency = "USD";

  // Try priceInfo from embedded data
  if (priceInfo) {
    price = priceInfo.minActivityPrice || priceInfo.minPrice || null;
    if (
      priceInfo.minPrice &&
      priceInfo.minActivityPrice &&
      priceInfo.minPrice > priceInfo.minActivityPrice
    ) {
      originalPrice = priceInfo.minPrice;
    }
    currency = priceInfo.currencyCode || "USD";
  }

  // Try nested product data
  if (price === null && pd) {
    const priceModule =
      getNestedValue(pd, "data.priceModule") ||
      getNestedValue(pd, "priceModule") ||
      getNestedValue(pd, "data.root.fields.priceModule");

    if (priceModule && typeof priceModule === "object") {
      const pm = priceModule as Record<string, unknown>;
      const formattedPrice = pm.formatedActivityPrice || pm.formatedPrice;
      if (typeof formattedPrice === "string") {
        const cleaned = formattedPrice
          .replace(/[^0-9.,-]/g, "")
          .replace(",", ".");
        price = parseFloat(cleaned) || null;
      }
      if (typeof pm.minPrice === "number") price = pm.minPrice;
      if (typeof pm.minActivityPrice === "number") price = pm.minActivityPrice;

      const origFormatted = pm.formatedPrice;
      if (typeof origFormatted === "string" && pm.formatedActivityPrice) {
        const cleaned = origFormatted
          .replace(/[^0-9.,-]/g, "")
          .replace(",", ".");
        originalPrice = parseFloat(cleaned) || null;
      }
      if (typeof pm.maxPrice === "number" && pm.maxPrice > (price || 0)) {
        // Range pricing — use min as price
      }

      currency = (pm.currencyCode as string) || currency;
    }
  }

  // Try JSON-LD
  if (price === null && jsonLd) {
    const offers = jsonLd.offers as Record<string, unknown> | undefined;
    if (offers) {
      const ldPrice = offers.price || offers.lowPrice;
      if (typeof ldPrice === "number") price = ldPrice;
      else if (typeof ldPrice === "string") price = parseFloat(ldPrice) || null;
      currency = (offers.priceCurrency as string) || currency;
    }
  }

  // Try HTML selectors as fallback
  if (price === null) {
    const priceSelectors = [
      ".product-price-value",
      ".uniform-banner-box-price",
      '[class*="price--current"]',
    ];
    for (const sel of priceSelectors) {
      const text = $(sel).first().text().trim();
      if (text) {
        const cleaned = text.replace(/[^0-9.,-]/g, "").replace(",", ".");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
          // Try to determine currency from symbols
          if (text.includes("$")) currency = "USD";
          else if (text.includes("€")) currency = "EUR";
          else if (text.includes("£")) currency = "GBP";
          break;
        }
      }
    }
  }

  return { price, originalPrice, currency };
}

function extractImages(
  $: RawAliExpressData["$"],
  imageList?: string[]
): AliExpressImage[] {
  const images: AliExpressImage[] = [];
  const seen = new Set<string>();

  // From embedded data
  if (imageList && imageList.length > 0) {
    for (const url of imageList) {
      if (!url || seen.has(url)) continue;
      // Ensure HTTPS and get larger version
      const fullUrl = url.startsWith("//")
        ? `https:${url}`
        : url.startsWith("http")
          ? url
          : `https://${url}`;
      // Request larger image by appending size suffix
      const largeUrl = fullUrl.replace(/_\d+x\d+\.\w+$/, "");
      seen.add(largeUrl);
      images.push({ url: largeUrl });
    }
  }

  // Try og:image as fallback
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      const url = ogImage.startsWith("//") ? `https:${ogImage}` : ogImage;
      images.push({ url });
    }
  }

  // Try to find images from the gallery in HTML
  if (images.length === 0) {
    $(
      "img.magnifier-image, .images-view-item img, .sku-property-image img"
    ).each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && !seen.has(src)) {
        seen.add(src);
        const url = src.startsWith("//") ? `https:${src}` : src;
        images.push({ url });
      }
    });
  }

  return images;
}

function extractVariants(
  skuData: RawAliExpressData["embeddedData"]["skuData"],
  pd?: Record<string, unknown>,
  _defaultCurrency = "USD"
): {
  variants: AliExpressVariant[];
  variantOptions: AliExpressVariantOption[];
} {
  const variants: AliExpressVariant[] = [];
  const variantOptions: AliExpressVariantOption[] = [];

  // Use skuData from the scraper
  let propertyList = skuData?.skuPropertyList;
  let skuList = skuData?.skuList;

  // If skuData wasn't extracted directly, try from productData nested paths
  if (!propertyList && pd) {
    const skuModule =
      getNestedValue(pd, "data.skuModule") ||
      getNestedValue(pd, "skuModule") ||
      getNestedValue(pd, "data.root.fields.skuModule");

    if (skuModule && typeof skuModule === "object") {
      const sku = skuModule as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      propertyList = (sku.productSKUPropertyList || sku.skuPropertyList) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      skuList = (sku.skuPriceList || sku.skuList) as any;
    }
  }

  // Build option values map: propertyValueId → { name, imageUrl }
  const valueIdMap = new Map<
    string,
    { optionName: string; value: string; imageUrl?: string }
  >();

  if (propertyList && Array.isArray(propertyList)) {
    for (const prop of propertyList) {
      const optionName = prop.skuPropertyName;
      const values: AliExpressVariantOption["values"] = [];

      if (Array.isArray(prop.skuPropertyValues)) {
        for (const val of prop.skuPropertyValues) {
          const valueName =
            val.propertyValueDisplayName ||
            val.propertyValueName ||
            val.skuPropertyTips ||
            "";

          let imageUrl: string | undefined;
          if (val.skuPropertyImagePath) {
            imageUrl = val.skuPropertyImagePath.startsWith("//")
              ? `https:${val.skuPropertyImagePath}`
              : val.skuPropertyImagePath;
          }

          values.push({
            value: valueName,
            imageUrl,
          });

          // Map property value ID to info for variant matching
          valueIdMap.set(String(val.propertyValueId), {
            optionName,
            value: valueName,
            imageUrl,
          });
          // Also map the long ID
          if (val.propertyValueIdLong) {
            valueIdMap.set(String(val.propertyValueIdLong), {
              optionName,
              value: valueName,
              imageUrl,
            });
          }
        }
      }

      if (values.length > 0) {
        variantOptions.push({ name: optionName, values });
      }
    }
  }

  // Build variants from SKU list
  if (skuList && Array.isArray(skuList)) {
    for (const sku of skuList) {
      const skuId = String(sku.skuId || "");
      const options: Record<string, string> = {};

      // Parse skuPropIds or skuAttr to determine which options this SKU has
      const propIds = sku.skuPropIds || sku.skuAttr || "";

      if (propIds) {
        const ids = propIds
          .split(";")
          .flatMap((segment: string) => segment.split(","))
          .filter(Boolean);
        for (const id of ids) {
          const cleanId = id.split("#")[0].split(":").pop() || id;
          const valueInfo = valueIdMap.get(cleanId);
          if (valueInfo) {
            options[valueInfo.optionName] = valueInfo.value;
          }
        }
      }

      // Extract price
      let variantPrice: number | null = null;
      let variantOriginalPrice: number | null = null;

      if (sku.skuVal) {
        if (sku.skuVal.actSkuCalPrice) {
          variantPrice = parseFloat(sku.skuVal.actSkuCalPrice) || null;
        } else if (sku.skuVal.skuCalPrice) {
          variantPrice = parseFloat(sku.skuVal.skuCalPrice) || null;
        } else if (sku.skuVal.skuAmount?.value) {
          variantPrice = sku.skuVal.skuAmount.value;
        }

        if (sku.skuVal.skuCalPrice && sku.skuVal.actSkuCalPrice) {
          variantOriginalPrice = parseFloat(sku.skuVal.skuCalPrice) || null;
        }
      }

      // Extract stock
      const stock = sku.skuVal?.availQuantity || sku.skuVal?.inventory || 0;

      variants.push({
        skuId,
        options,
        price: variantPrice,
        originalPrice: variantOriginalPrice,
        stock: typeof stock === "number" ? stock : 0,
        available: stock > 0,
      });
    }
  }

  return { variants, variantOptions };
}

function extractSpecifications(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>
): Record<string, string> {
  const specs: Record<string, string> = {};

  // Try embedded data
  if (pd) {
    const specsModule =
      getNestedValue(pd, "data.specsModule.props") ||
      getNestedValue(pd, "specsModule.props") ||
      getNestedValue(pd, "data.root.fields.specsModule.props");

    if (Array.isArray(specsModule)) {
      for (const spec of specsModule) {
        if (
          spec &&
          typeof spec === "object" &&
          "attrName" in spec &&
          "attrValue" in spec
        ) {
          specs[spec.attrName as string] = spec.attrValue as string;
        }
      }
    }
  }

  // Try HTML table
  if (Object.keys(specs).length === 0) {
    $(
      ".product-prop-list li, .specification--list li, tr.specification-item"
    ).each((_, el) => {
      const key = $(el)
        .find(".property-title, td:first-child, .name")
        .text()
        .trim();
      const value = $(el)
        .find(".property-desc, td:last-child, .value")
        .text()
        .trim();
      if (key && value) {
        specs[key] = value;
      }
    });
  }

  return specs;
}

function extractStoreName($: RawAliExpressData["$"]): string | null {
  const selectors = [".shop-name a", ".store-name", "[class*='store'] a"];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) return text;
  }
  return null;
}

function extractRatingAndReviews(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>
): {
  rating: number | null;
  reviewCount: number | null;
  orderCount: number | null;
} {
  let rating: number | null = null;
  let reviewCount: number | null = null;
  let orderCount: number | null = null;

  // Try embedded data
  if (pd) {
    const feedbackModule =
      getNestedValue(pd, "data.feedbackModule") ||
      getNestedValue(pd, "feedbackModule") ||
      getNestedValue(pd, "data.root.fields.feedbackModule");

    if (feedbackModule && typeof feedbackModule === "object") {
      const fb = feedbackModule as Record<string, unknown>;
      if (typeof fb.averageStar === "number") rating = fb.averageStar;
      else if (typeof fb.averageStar === "string")
        rating = parseFloat(fb.averageStar) || null;
      if (typeof fb.totalValidNum === "number") reviewCount = fb.totalValidNum;
    }

    const tradeModule =
      getNestedValue(pd, "data.tradeModule") ||
      getNestedValue(pd, "tradeModule");

    if (tradeModule && typeof tradeModule === "object") {
      const trade = tradeModule as Record<string, unknown>;
      if (typeof trade.tradeCount === "number") orderCount = trade.tradeCount;
      else if (typeof trade.formatTradeCount === "string") {
        const cleaned = trade.formatTradeCount
          .toString()
          .replace(/[^0-9]/g, "");
        orderCount = parseInt(cleaned) || null;
      }
    }
  }

  // JSON-LD fallback
  if (rating === null) {
    const ratingText = $('[class*="rating"] .score, .overview-rating-average')
      .first()
      .text()
      .trim();
    if (ratingText) {
      rating = parseFloat(ratingText) || null;
    }
  }

  return { rating, reviewCount, orderCount };
}

function extractShippingInfo(
  $: RawAliExpressData["$"],
  pd?: Record<string, unknown>
): string | null {
  // Try embedded data
  if (pd) {
    const shippingModule =
      getNestedValue(pd, "data.shippingModule") ||
      getNestedValue(pd, "shippingModule");

    if (shippingModule && typeof shippingModule === "object") {
      const ship = shippingModule as Record<string, unknown>;
      if (
        typeof ship.freightAmount === "string" ||
        typeof ship.freightAmount === "number"
      ) {
        const amount = Number(ship.freightAmount);
        if (amount === 0) return "Free Shipping";
        return `Shipping: $${amount}`;
      }
    }
  }

  // Try HTML
  const shippingText = $(".product-shipping-info, [class*='shipping'] .bold")
    .first()
    .text()
    .trim();
  if (shippingText) return shippingText;

  return null;
}

// =============================================================================
// Utils
// =============================================================================

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
