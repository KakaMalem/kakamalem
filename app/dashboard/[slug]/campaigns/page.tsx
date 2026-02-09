import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCampaigns } from "@/lib/db/queries/campaigns";
import { CampaignsList } from "@/components/dashboard/campaigns/campaigns-list";
import { Button } from "@/components/ui/button";

interface CampaignsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CampaignsPage({ params }: CampaignsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const campaigns = await getCampaigns(store.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sale Campaigns</h1>
          <p className="text-muted-foreground">
            Create event-based sales like Black Friday, Eid Sales, or Summer
            Discounts that apply automatically.
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${slug}/campaigns/new`}>
            <Plus className="size-4" />
            Create Campaign
          </Link>
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border bg-blue-50 p-4">
        <div className="flex gap-3">
          <CalendarDays className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">How Sale Campaigns Work</p>
            <p className="text-blue-700 mt-1">
              Unlike promo codes, sale campaigns apply{" "}
              <strong>automatically</strong> during the campaign period.
              Customers see discounted prices without entering any code. Perfect
              for store-wide events like Black Friday, seasonal sales, or
              holiday promotions.
            </p>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <CampaignsList
        campaigns={campaigns}
        storeSlug={slug}
        tenantId={store.id}
        currency={store.currency}
      />
    </div>
  );
}
