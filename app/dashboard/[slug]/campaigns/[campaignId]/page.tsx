import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { getProducts } from "@/lib/db/queries/products";
import { CampaignForm } from "@/components/dashboard/campaigns/campaign-form";
import { Button } from "@/components/ui/button";

interface EditCampaignPageProps {
  params: Promise<{ slug: string; campaignId: string }>;
}

export default async function EditCampaignPage({
  params,
}: EditCampaignPageProps) {
  const { slug, campaignId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [campaign, categoriesData, productsData] = await Promise.all([
    getCampaignById(store.id, campaignId),
    getCategoriesWithCounts(store.id),
    getProducts(store.id, { limit: 1000 }),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/dashboard/${slug}/campaigns`}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back to campaigns</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Campaign</h1>
          <p className="text-muted-foreground">Update {campaign.name}</p>
        </div>
      </div>

      {/* Form */}
      <CampaignForm
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        campaign={campaign}
        categories={categoriesData.map((c) => ({ id: c.id, name: c.name }))}
        products={productsData.products.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    </div>
  );
}
