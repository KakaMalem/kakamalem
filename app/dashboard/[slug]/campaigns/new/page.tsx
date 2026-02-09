import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { getProducts } from "@/lib/db/queries/products";
import { CampaignForm } from "@/components/dashboard/campaigns/campaign-form";
import { Button } from "@/components/ui/button";

interface NewCampaignPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewCampaignPage({
  params,
}: NewCampaignPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Fetch categories and products for selectors
  const [categoriesData, productsData] = await Promise.all([
    getCategoriesWithCounts(store.id),
    getProducts(store.id, { limit: 1000 }),
  ]);

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
          <h1 className="text-2xl font-bold tracking-tight">
            Create Sale Campaign
          </h1>
          <p className="text-muted-foreground">
            Set up an automatic discount event for your store.
          </p>
        </div>
      </div>

      {/* Form */}
      <CampaignForm
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        categories={categoriesData.map((c) => ({ id: c.id, name: c.name }))}
        products={productsData.products.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    </div>
  );
}
