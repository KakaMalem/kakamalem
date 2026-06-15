import { cookies } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeLinks, storeLinkClicks } from "@/lib/db/schema";

// Must match the cookies set by the redirect route (app/s/[code]/route.ts).
const ATTRIBUTION_COOKIE = "km_link_ref";
const VISITOR_COOKIE = "km_link_vid";

/**
 * Credit a store marketing link with an order, if the buyer arrived via one.
 *
 * Reads the attribution cookie set by the /s/{code} redirect, validates the
 * link belongs to this tenant, marks the visitor's most recent click as
 * converted, and bumps the link's conversion + revenue counters. Best-effort:
 * any failure is swallowed so it can never break checkout.
 */
export async function attributeOrderToLink(params: {
  orderId: string;
  tenantId: string;
  orderTotal: number;
}): Promise<void> {
  try {
    const cookieStore = await cookies();
    const linkId = cookieStore.get(ATTRIBUTION_COOKIE)?.value;
    if (!linkId) return;
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;

    // Only attribute links that belong to the store being ordered from.
    const link = await db.query.storeLinks.findFirst({
      where: and(
        eq(storeLinks.id, linkId),
        eq(storeLinks.tenantId, params.tenantId)
      ),
      columns: { id: true },
    });
    if (!link) return;

    // Mark the matching click converted (prefer this visitor's click).
    const click = await db.query.storeLinkClicks.findFirst({
      where: visitorId
        ? and(
            eq(storeLinkClicks.linkId, linkId),
            eq(storeLinkClicks.visitorId, visitorId),
            eq(storeLinkClicks.isConverted, false)
          )
        : and(
            eq(storeLinkClicks.linkId, linkId),
            eq(storeLinkClicks.isConverted, false)
          ),
      orderBy: desc(storeLinkClicks.clickedAt),
      columns: { id: true },
    });

    if (click) {
      await db
        .update(storeLinkClicks)
        .set({
          isConverted: true,
          convertedAt: new Date().toISOString(),
          orderId: params.orderId,
        })
        .where(eq(storeLinkClicks.id, click.id));
    }

    await db
      .update(storeLinks)
      .set({
        totalConversions: sql`${storeLinks.totalConversions} + 1`,
        totalRevenue: sql`${storeLinks.totalRevenue} + ${params.orderTotal}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storeLinks.id, linkId));

    // Credit a click only once — clear the cookie after attributing.
    cookieStore.delete(ATTRIBUTION_COOKIE);
  } catch (err) {
    console.error("[link] order attribution failed:", err);
  }
}
