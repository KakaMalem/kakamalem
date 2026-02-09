import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { platformAffiliates, platformAffiliateClicks } from "@/lib/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { AFFILIATE_CONFIG } from "@/lib/affiliate/constants";
import {
  AFFILIATE_COOKIE_NAME,
  VISITOR_ID_COOKIE_NAME,
  generateVisitorId,
} from "@/lib/affiliate/tracking";
import {
  extractRequestMetadata,
  DEDUP_WINDOW_MS,
  type RequestMetadata,
} from "@/lib/affiliate/click-analytics";

// Note: Edge Runtime would be faster but requires serverless DB driver (Neon/Vercel Postgres)
// Current setup uses postgres-js which needs Node.js runtime

/**
 * Affiliate redirect route handler (Production-Grade)
 *
 * Features:
 * - Full metadata capture (IP, UA, geo, device)
 * - Bot detection (records but marks as bot)
 * - Click deduplication (1 hour window per visitor)
 * - Non-blocking database writes (fire-and-forget pattern)
 * - Vercel geo headers for location data (free)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const headers = request.headers;

  // Extract UTM params from URL
  const utm_source = searchParams.get("utm_source");
  const utm_medium = searchParams.get("utm_medium");
  const utm_campaign = searchParams.get("utm_campaign");
  const utm_content = searchParams.get("utm_content");

  // Extract request metadata (IP, UA, geo, device, bot detection)
  const metadata = extractRequestMetadata(headers);

  // Verify the affiliate exists and is approved
  const affiliate = await db.query.platformAffiliates.findFirst({
    where: and(
      eq(platformAffiliates.slug, slug.toLowerCase()),
      eq(platformAffiliates.status, "approved")
    ),
    columns: {
      id: true,
      slug: true,
      cookieDurationDays: true,
    },
  });

  // If not a valid affiliate, return 404 response
  if (!affiliate) {
    return new NextResponse("Affiliate not found", { status: 404 });
  }

  // Get or generate visitor ID from cookie or URL param
  const existingVisitorId = request.cookies.get(VISITOR_ID_COOKIE_NAME)?.value;
  const vidParam = searchParams.get("vid");
  const visitorId = existingVisitorId || vidParam || generateVisitorId();

  // Calculate cookie expiry
  const cookieDuration =
    affiliate.cookieDurationDays || AFFILIATE_CONFIG.cookieDurationDays;
  const cookieExpiresAt = new Date(
    Date.now() + cookieDuration * 24 * 60 * 60 * 1000
  );

  // Build redirect URL with ref param
  const redirectUrl = new URL(
    "/",
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  );
  redirectUrl.searchParams.set("ref", affiliate.slug);

  // Preserve UTM params in redirect
  if (utm_source) redirectUrl.searchParams.set("utm_source", utm_source);
  if (utm_medium) redirectUrl.searchParams.set("utm_medium", utm_medium);
  if (utm_campaign) redirectUrl.searchParams.set("utm_campaign", utm_campaign);
  if (utm_content) redirectUrl.searchParams.set("utm_content", utm_content);

  // Create response with redirect
  const response = NextResponse.redirect(redirectUrl);

  // Set tracking cookies on the response
  response.cookies.set(AFFILIATE_COOKIE_NAME, affiliate.slug, {
    expires: cookieExpiresAt,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  response.cookies.set(VISITOR_ID_COOKIE_NAME, visitorId, {
    expires: cookieExpiresAt,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Record the click in the database (don't await - fire and forget)
  // This ensures the redirect is fast while still tracking
  recordClickWithDedup(affiliate.id, visitorId, cookieExpiresAt, metadata, {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
  }).catch((error) => {
    console.error("Failed to track affiliate click:", error);
  });

  return response;
}

/**
 * Record click with deduplication
 * - Checks if same visitor clicked within DEDUP_WINDOW_MS
 * - Records all clicks but only increments counter for unique non-bot clicks
 */
async function recordClickWithDedup(
  affiliateId: string,
  visitorId: string,
  cookieExpiresAt: Date,
  metadata: RequestMetadata,
  utmParams: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
  }
) {
  const now = new Date();
  const dedupWindowStart = new Date(now.getTime() - DEDUP_WINDOW_MS);

  // Check for duplicate click (same affiliate + visitor within window)
  const recentClick = await db.query.platformAffiliateClicks.findFirst({
    where: and(
      eq(platformAffiliateClicks.affiliateId, affiliateId),
      eq(platformAffiliateClicks.visitorId, visitorId),
      gte(platformAffiliateClicks.clickedAt, dedupWindowStart.toISOString())
    ),
    columns: { id: true },
  });

  const isDuplicate = !!recentClick;

  // Always record the click (for audit trail) but mark duplicates
  await db.insert(platformAffiliateClicks).values({
    affiliateId,
    visitorId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    referrer: metadata.referrer,

    // Geo-location
    country: metadata.geo.country,
    city: metadata.geo.city,
    region: metadata.geo.region,

    // Device info
    deviceType: metadata.device.deviceType,
    browser: metadata.device.browser,
    os: metadata.device.os,

    // Bot detection
    isBot: metadata.isBot,

    // UTM params
    utmSource: utmParams.utm_source,
    utmMedium: utmParams.utm_medium,
    utmCampaign: utmParams.utm_campaign,
    utmContent: utmParams.utm_content,

    cookieExpiresAt: cookieExpiresAt.toISOString(),
  });

  // Only increment total clicks for unique, non-bot clicks
  if (!isDuplicate && !metadata.isBot) {
    await db
      .update(platformAffiliates)
      .set({
        totalClicks: sql`${platformAffiliates.totalClicks} + 1`,
      })
      .where(eq(platformAffiliates.id, affiliateId));
  }
}
