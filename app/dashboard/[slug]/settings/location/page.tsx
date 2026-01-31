import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getStoreLocations } from "@/lib/db/queries/store-locations";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { StoreLocationsManager } from "./store-locations-manager";

interface LocationSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LocationSettingsPage({
  params,
}: LocationSettingsPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext.role, "location")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit location settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  // Fetch all store locations
  const locations = await getStoreLocations(store.id);

  // Convert legacy single location to a location if no locations exist
  const legacyLocation =
    store.storeLocationLat && store.storeLocationLng
      ? {
          latitude: parseFloat(store.storeLocationLat),
          longitude: parseFloat(store.storeLocationLng),
          city: store.storeLocationCity || "",
          plusCode: store.storeLocationPlusCode || "",
          accuracy: store.storeLocationAccuracy || null,
          source: (store.storeLocationSource as "gps" | "manual") || null,
        }
      : null;

  return (
    <StoreLocationsManager
      tenantId={store.id}
      storeSlug={slug}
      locations={locations}
      legacyLocation={legacyLocation}
    />
  );
}
