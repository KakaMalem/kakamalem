import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
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
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Role-based access check (requires admin or owner)
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext.role, "delivery")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit delivery settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
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
