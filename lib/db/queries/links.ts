import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  storeLinks,
  storeLinkClicks,
  products,
  categories,
} from "@/lib/db/schema";

/** All marketing links for a store, newest first. */
export async function getStoreLinks(tenantId: string) {
  return db.query.storeLinks.findMany({
    where: eq(storeLinks.tenantId, tenantId),
    with: {
      product: { columns: { name: true, slug: true } },
      category: { columns: { name: true, slug: true } },
    },
    orderBy: desc(storeLinks.createdAt),
  });
}

/** A single link scoped to its tenant (returns null if not owned). */
export async function getStoreLinkById(tenantId: string, id: string) {
  const link = await db.query.storeLinks.findFirst({
    where: and(eq(storeLinks.id, id), eq(storeLinks.tenantId, tenantId)),
    with: {
      product: { columns: { name: true, slug: true } },
      category: { columns: { name: true, slug: true } },
    },
  });
  return link ?? null;
}

/** True if no link anywhere uses this code (codes are globally unique). */
export async function isLinkCodeUnique(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await db.query.storeLinks.findFirst({
    where: eq(storeLinks.code, code),
    columns: { id: true },
  });
  if (!existing) return true;
  return excludeId ? existing.id === excludeId : false;
}

/** Products + categories for the link target picker. */
export async function getLinkPickerData(tenantId: string) {
  const [productRows, categoryRows] = await Promise.all([
    db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active")
      ),
      columns: { id: true, name: true, slug: true },
      orderBy: desc(products.createdAt),
      limit: 500,
    }),
    db.query.categories.findMany({
      where: eq(categories.tenantId, tenantId),
      columns: { id: true, name: true, slug: true },
      orderBy: desc(categories.createdAt),
      limit: 500,
    }),
  ]);
  return { products: productRows, categories: categoryRows };
}

export interface LinkStats {
  clicksByDay: { date: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
  devices: { deviceType: string; clicks: number }[];
  countries: { countryCode: string; clicks: number }[];
  recentClicks: {
    clickedAt: string;
    countryCode: string | null;
    city: string | null;
    deviceType: string | null;
    referrer: string | null;
    isConverted: boolean;
  }[];
}

/**
 * Aggregated stats for a single link over the last `days` days.
 * Bot clicks are excluded from every breakdown.
 */
export async function getLinkStats(
  linkId: string,
  days: number = 30
): Promise<LinkStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const notBot = and(
    eq(storeLinkClicks.linkId, linkId),
    eq(storeLinkClicks.isBot, false),
    gte(storeLinkClicks.clickedAt, since)
  );

  const [clicksByDay, topReferrers, devices, countries, recentClicks] =
    await Promise.all([
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${storeLinkClicks.clickedAt}), 'YYYY-MM-DD')`,
          clicks: sql<number>`count(*)::int`,
        })
        .from(storeLinkClicks)
        .where(notBot)
        .groupBy(sql`date_trunc('day', ${storeLinkClicks.clickedAt})`)
        .orderBy(sql`date_trunc('day', ${storeLinkClicks.clickedAt})`),

      db
        .select({
          referrer: sql<string>`coalesce(nullif(${storeLinkClicks.referrer}, ''), 'Direct')`,
          clicks: sql<number>`count(*)::int`,
        })
        .from(storeLinkClicks)
        .where(notBot)
        .groupBy(
          sql`coalesce(nullif(${storeLinkClicks.referrer}, ''), 'Direct')`
        )
        .orderBy(sql`count(*) desc`)
        .limit(8),

      db
        .select({
          deviceType: sql<string>`coalesce(${storeLinkClicks.deviceType}, 'unknown')`,
          clicks: sql<number>`count(*)::int`,
        })
        .from(storeLinkClicks)
        .where(notBot)
        .groupBy(sql`coalesce(${storeLinkClicks.deviceType}, 'unknown')`)
        .orderBy(sql`count(*) desc`),

      db
        .select({
          countryCode: sql<string>`coalesce(${storeLinkClicks.countryCode}, '??')`,
          clicks: sql<number>`count(*)::int`,
        })
        .from(storeLinkClicks)
        .where(notBot)
        .groupBy(sql`coalesce(${storeLinkClicks.countryCode}, '??')`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      db
        .select({
          clickedAt: storeLinkClicks.clickedAt,
          countryCode: storeLinkClicks.countryCode,
          city: storeLinkClicks.city,
          deviceType: storeLinkClicks.deviceType,
          referrer: storeLinkClicks.referrer,
          isConverted: storeLinkClicks.isConverted,
        })
        .from(storeLinkClicks)
        .where(
          and(
            eq(storeLinkClicks.linkId, linkId),
            eq(storeLinkClicks.isBot, false)
          )
        )
        .orderBy(desc(storeLinkClicks.clickedAt))
        .limit(20),
    ]);

  return { clicksByDay, topReferrers, devices, countries, recentClicks };
}
