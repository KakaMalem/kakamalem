import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getStoreLinkById, getLinkStats } from "@/lib/db/queries/links";
import { Button } from "@/components/ui/button";
import { LinkStatsView } from "@/components/dashboard/links/link-stats";
import type { LinkRow } from "@/components/dashboard/links/types";

interface LinkStatsPageProps {
  params: Promise<{ slug: string; linkId: string }>;
}

const STATS_DAYS = 30;

export default async function LinkStatsPage({ params }: LinkStatsPageProps) {
  const { slug, linkId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) notFound();

  const link = await getStoreLinkById(store.id, linkId);
  if (!link) notFound();

  const stats = await getLinkStats(link.id, STATS_DAYS);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const shortUrl = `${appUrl.replace(/\/$/, "")}/s/${link.code}`;

  const row: LinkRow = {
    id: link.id,
    code: link.code,
    name: link.name,
    targetType: link.targetType,
    productId: link.productId,
    categoryId: link.categoryId,
    targetUrl: link.targetUrl,
    productName: link.product?.name ?? null,
    categoryName: link.category?.name ?? null,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmContent: link.utmContent,
    utmTerm: link.utmTerm,
    totalClicks: link.totalClicks,
    uniqueClicks: link.uniqueClicks,
    totalConversions: link.totalConversions,
    totalRevenue: link.totalRevenue,
    isActive: link.isActive,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/dashboard/${slug}/links`}>
            <ArrowLeft className="mr-1.5 size-4" />
            All links
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {link.name || link.code}
        </h1>
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {shortUrl.replace(/^https?:\/\//, "")}
        </a>
      </div>

      <LinkStatsView
        link={row}
        stats={stats}
        currency={store.currency}
        days={STATS_DAYS}
      />
    </div>
  );
}
