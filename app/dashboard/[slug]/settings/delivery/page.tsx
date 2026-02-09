import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { getUnifiedZones } from "@/lib/actions/unified-delivery";
import { UnifiedDeliveryManager } from "@/components/dashboard/delivery/unified-delivery-manager";

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

  // Fetch unified delivery zones
  const zones = await getUnifiedZones(store.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery & Shipping</h1>
        <p className="text-muted-foreground mt-1">
          Configure delivery zones and shipping rates for your store
        </p>
      </div>

      <UnifiedDeliveryManager tenantId={store.id} zones={zones} />
    </div>
  );
}
