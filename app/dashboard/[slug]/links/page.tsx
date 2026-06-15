import { notFound } from "next/navigation";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getStoreLinks, getLinkPickerData } from "@/lib/db/queries/links";
import { LinksClient } from "@/components/dashboard/links/links-client";

interface LinksPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LinksPage({ params }: LinksPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [links, picker] = await Promise.all([
    getStoreLinks(store.id),
    getLinkPickerData(store.id),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Links</h1>
        <p className="text-muted-foreground">
          Create short, trackable links to your store, products, or categories —
          then see clicks and sales they drive.
        </p>
      </div>

      <LinksClient
        tenantId={store.id}
        storeSlug={store.slug}
        currency={store.currency}
        appUrl={appUrl}
        initialLinks={links.map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          targetType: l.targetType,
          productId: l.productId,
          categoryId: l.categoryId,
          targetUrl: l.targetUrl,
          productName: l.product?.name ?? null,
          categoryName: l.category?.name ?? null,
          utmSource: l.utmSource,
          utmMedium: l.utmMedium,
          utmCampaign: l.utmCampaign,
          utmContent: l.utmContent,
          utmTerm: l.utmTerm,
          totalClicks: l.totalClicks,
          uniqueClicks: l.uniqueClicks,
          totalConversions: l.totalConversions,
          totalRevenue: l.totalRevenue,
          isActive: l.isActive,
          expiresAt: l.expiresAt,
          createdAt: l.createdAt,
        }))}
        products={picker.products}
        categories={picker.categories}
      />
    </div>
  );
}
