/**
 * Affiliate Click Analytics Utilities
 *
 * Production-grade click tracking without paid services:
 * - Bot detection using UA patterns
 * - User-Agent parsing for device/browser/OS
 * - Geo-location via Vercel headers (free on Vercel) or request headers
 * - IP extraction with proxy support
 */

// =============================================================================
// BOT DETECTION
// =============================================================================
// Common bot user-agent patterns - comprehensive list from various sources
// This catches ~95% of bots without any external service

const BOT_PATTERNS = [
  // Search engine crawlers
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /facebookexternalhit/i,

  // Social media crawlers
  /twitterbot/i,
  /linkedinbot/i,
  /pinterest/i,
  /slackbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,

  // SEO/Marketing tools
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /screaming frog/i,

  // Monitoring/Uptime services
  /uptimerobot/i,
  /pingdom/i,
  /statuscake/i,
  /site24x7/i,
  /newrelicpinger/i,
  /datadog/i,

  // Generic bot patterns
  /bot/i,
  /spider/i,
  /crawl/i,
  /scraper/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,

  // HTTP libraries (usually automated)
  /curl/i,
  /wget/i,
  /httpie/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /axios/i,
  /node-fetch/i,
  /got\//i,

  // Preview/Embed services
  /preview/i,
  /embed/i,
  /unfurl/i,
  /link preview/i,
];

/**
 * Detect if a user-agent is a bot
 * Uses pattern matching - no external service required
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // No UA = likely bot
  if (userAgent.length < 10) return true; // Suspiciously short UA

  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// =============================================================================
// USER-AGENT PARSING
// =============================================================================
// Simple regex-based parsing - no external library needed

export interface DeviceInfo {
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  browser: string;
  os: string;
}

/**
 * Parse user-agent to extract device, browser, and OS info
 * Lightweight alternative to ua-parser-js
 */
export function parseUserAgent(
  userAgent: string | null | undefined
): DeviceInfo {
  if (!userAgent) {
    return { deviceType: "unknown", browser: "Unknown", os: "Unknown" };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType: DeviceInfo["deviceType"] = "desktop";
  if (
    /mobile|android.*mobile|iphone|ipod|blackberry|iemobile|opera mini|opera mobi/i.test(
      ua
    )
  ) {
    deviceType = "mobile";
  } else if (/tablet|ipad|android(?!.*mobile)|kindle|silk/i.test(ua)) {
    deviceType = "tablet";
  }

  // Detect browser
  let browser = "Unknown";
  if (/edg\//i.test(userAgent)) {
    browser = "Edge";
  } else if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
    browser = "Chrome";
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = "Safari";
  } else if (/firefox/i.test(userAgent)) {
    browser = "Firefox";
  } else if (/msie|trident/i.test(userAgent)) {
    browser = "IE";
  } else if (/samsung/i.test(userAgent)) {
    browser = "Samsung Internet";
  }

  // Detect OS
  let os = "Unknown";
  if (/windows nt 10/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/windows nt/i.test(ua)) {
    os = "Windows";
  } else if (/mac os x/i.test(ua)) {
    os = "macOS";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  }

  return { deviceType, browser, os };
}

// =============================================================================
// GEO & IP EXTRACTION
// =============================================================================

export interface GeoInfo {
  country: string | null; // ISO 3166-1 alpha-2
  city: string | null;
  region: string | null;
}

export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  referrer: string | null;
  geo: GeoInfo;
  device: DeviceInfo;
  isBot: boolean;
}

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations (Vercel, Cloudflare, nginx, etc.)
 */
export function getClientIp(headers: Headers): string {
  // Vercel Edge
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  // Cloudflare
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard proxy headers
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Extract geo-location from edge/proxy headers. Falls back to null if not
 * available.
 *
 * This deployment sits behind Cloudflare (Dokploy/Traefik), so Cloudflare's
 * headers are checked first:
 * - cf-ipcountry: ISO country code (always present on CF)
 * - cf-ipcity / cf-region: city/region (Enterprise plans; usually absent)
 *
 * Vercel headers (x-vercel-ip-*) are kept as a fallback in case the app is
 * ever run on Vercel.
 */
export function getGeoFromHeaders(headers: Headers): GeoInfo {
  // Cloudflare (current production proxy)
  const cfCountry = headers.get("cf-ipcountry");
  if (cfCountry && cfCountry !== "XX") {
    const cfCity = headers.get("cf-ipcity");
    const cfRegion = headers.get("cf-region");
    return {
      country: cfCountry,
      city: cfCity ? decodeURIComponent(cfCity) : null,
      region: cfRegion ? decodeURIComponent(cfRegion) : null,
    };
  }

  // Vercel fallback
  const country = headers.get("x-vercel-ip-country");
  const city = headers.get("x-vercel-ip-city");
  const region = headers.get("x-vercel-ip-country-region");

  return {
    country: country || null,
    city: city ? decodeURIComponent(city) : null,
    region: region || null,
  };
}

/**
 * Extract all request metadata for click tracking
 * Combines IP, UA, geo, and device info
 */
export function extractRequestMetadata(headers: Headers): RequestMetadata {
  const userAgent = headers.get("user-agent") || "";
  const referrer = headers.get("referer") || headers.get("referrer") || null;

  return {
    ipAddress: getClientIp(headers),
    userAgent,
    referrer,
    geo: getGeoFromHeaders(headers),
    device: parseUserAgent(userAgent),
    isBot: isBot(userAgent),
  };
}

// =============================================================================
// CLICK DEDUPLICATION
// =============================================================================

/**
 * Generate a deduplication key for a click
 * Used to prevent counting the same visitor multiple times in a short window
 */
export function generateDedupKey(
  affiliateId: string,
  visitorId: string,
  ipAddress: string
): string {
  // Combine affiliate, visitor, and IP for robust dedup
  return `${affiliateId}:${visitorId}:${ipAddress}`;
}

// Deduplication window in milliseconds (1 hour)
export const DEDUP_WINDOW_MS = 60 * 60 * 1000;
