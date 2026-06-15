import { NextResponse, type NextRequest } from "next/server";
import { eq, and, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeLinks, storeLinkClicks } from "@/lib/db/schema";
import { extractRequestMetadata } from "@/lib/affiliate/click-analytics";
import { generateVisitorId } from "@/lib/affiliate/tracking";
import { buildLinkTargetUrl } from "@/lib/links/resolve";
import { normalizeCode } from "@/lib/links/code";

export const dynamic = "force-dynamic";

// Cookie that identifies a visitor across link clicks (for unique counting).
const VISITOR_COOKIE = "km_link_vid";
// Cookie that attributes a later order back to the link that drove the visit.
const ATTRIBUTION_COOKIE = "km_link_ref";
const ATTRIBUTION_DAYS = 30;
const VISITOR_DAYS = 365;

const isProd = process.env.NODE_ENV === "production";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const unavailable = new URL("/link-unavailable", appUrl);

  const link = await db.query.storeLinks.findFirst({
    where: eq(storeLinks.code, normalizeCode(code)),
    with: {
      tenant: {
        columns: {
          id: true,
          slug: true,
          status: true,
          customDomain: true,
          customDomainStatus: true,
        },
      },
      product: { columns: { slug: true } },
      category: { columns: { slug: true } },
    },
  });

  // Not found / disabled / expired / store inactive → friendly page.
  const expired =
    link?.expiresAt != null && new Date(link.expiresAt) < new Date();
  if (
    !link ||
    !link.isActive ||
    expired ||
    !link.tenant ||
    link.tenant.status !== "active"
  ) {
    return NextResponse.redirect(unavailable, 302);
  }

  const target = buildLinkTargetUrl(link, link.tenant, {
    productSlug: link.product?.slug,
    categorySlug: link.category?.slug,
  });

  const res = NextResponse.redirect(target, 302);

  // Visitor cookie (create if absent)
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!visitorId) visitorId = generateVisitorId();

  res.cookies.set(VISITOR_COOKIE, visitorId, {
    expires: new Date(Date.now() + VISITOR_DAYS * 86_400_000),
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  // Attribution cookie — read at checkout to credit the link with the order.
  res.cookies.set(ATTRIBUTION_COOKIE, link.id, {
    expires: new Date(Date.now() + ATTRIBUTION_DAYS * 86_400_000),
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });

  // Record the click. Never let tracking failures block the redirect.
  try {
    const meta = extractRequestMetadata(request.headers);
    if (!meta.isBot) {
      const prior = await db.query.storeLinkClicks.findFirst({
        where: and(
          eq(storeLinkClicks.linkId, link.id),
          eq(storeLinkClicks.visitorId, visitorId)
        ),
        columns: { id: true },
      });
      const isUnique = !prior;

      await db.insert(storeLinkClicks).values({
        linkId: link.id,
        tenantId: link.tenant.id,
        visitorId,
        ipAddress: meta.ipAddress,
        referrer: meta.referrer,
        userAgent: meta.userAgent,
        deviceType: meta.device.deviceType,
        browser: meta.device.browser,
        os: meta.device.os,
        countryCode: meta.geo.country,
        city: meta.geo.city,
        isUnique,
        isBot: false,
      });

      await db
        .update(storeLinks)
        .set({
          totalClicks: sql`${storeLinks.totalClicks} + 1`,
          uniqueClicks: isUnique
            ? sql`${storeLinks.uniqueClicks} + 1`
            : sql`${storeLinks.uniqueClicks}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(storeLinks.id, link.id));
    }
  } catch (err) {
    console.error("[link] click tracking failed:", err);
  }

  return res;
}
