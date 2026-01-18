import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getDeliveryZones } from "@/lib/actions/delivery-zones";
import { getShippingZonesAction } from "@/lib/actions/shipping";
import { DeliverySettingsClient } from "@/components/dashboard/delivery-shipping/delivery-settings-client";

interface DeliverySettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DeliverySettingsPage({
  params,
}: DeliverySettingsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Fetch both delivery zones and shipping zones
  const [deliveryZones, shippingZonesResult] = await Promise.all([
    getDeliveryZones(store.id),
    getShippingZonesAction(store.id),
  ]);

  const shippingZones = shippingZonesResult.success
    ? shippingZonesResult.data || []
    : [];

  return (
    <div className="space-y-6">
      <DeliverySettingsClient
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        enableDeliveryZones={store.enableDeliveryZones}
        deliveryZones={deliveryZones}
        shippingZones={shippingZones}
      />
    </div>
  );
}
