import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getUserStores, getTenantBySlug } from "@/lib/db/queries/tenants";
import { TenantSettingsHydration } from "@/components/dashboard/tenant-settings-hydration";
import { transformTenantToSettings } from "@/lib/utils/tenant-settings";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

// This layout validates store access and hydrates tenant settings
// The parent /dashboard/layout.tsx handles the sidebar
export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    notFound();
  }

  // Fetch the requested store
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Fetch all user's stores to check access
  const userStores = await getUserStores(user.id);

  // Check if user has access to this store
  const hasAccess = userStores.some((s) => s.id === store.id);
  if (!hasAccess) {
    notFound();
  }

  // Transform store data for client-side hydration
  const tenantSettings = transformTenantToSettings(store);

  return (
    <>
      {/* Hydrate tenant settings store with server data */}
      <TenantSettingsHydration settings={tenantSettings} />
      {children}
    </>
  );
}
