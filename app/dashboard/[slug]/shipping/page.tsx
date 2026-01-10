import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getShippingZonesAction } from "@/lib/actions/shipping";
import { ShippingManager } from "@/components/dashboard/shipping/shipping-manager";

interface ShippingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ShippingPage({ params }: ShippingPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const zonesResult = await getShippingZonesAction(store.id);
  const zones = zonesResult.success ? zonesResult.data || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shipping</h1>
        <p className="text-muted-foreground">
          Configure shipping zones and delivery methods for your store.
        </p>
      </div>

      {/* Shipping Manager */}
      <ShippingManager
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        initialZones={zones}
      />
    </div>
  );
}
