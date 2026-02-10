import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import {
  getMarketplaceSettingsData,
  getMarketplacePlatformCategories,
  getProductsForFeaturedPicker,
} from "@/lib/db/queries/marketplace";
import { AccessDenied } from "@/components/access-denied";
import { MarketplaceSettingsForm } from "./marketplace-settings-form";

interface MarketplaceSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MarketplaceSettingsPage({
  params,
}: MarketplaceSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext.role, "marketplace")) {
    return (
      <AccessDenied
        message="Only the store owner can manage marketplace settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  const [profile, categories, storeProducts] = await Promise.all([
    getMarketplaceSettingsData(store.id),
    getMarketplacePlatformCategories(),
    getProductsForFeaturedPicker(store.id),
  ]);

  return (
    <div className="space-y-6">
      <MarketplaceSettingsForm
        storeId={store.id}
        storeSlug={slug}
        marketplaceEnabled={store.marketplaceEnabled}
        profile={profile}
        platformCategories={categories}
        storeProducts={storeProducts}
      />
    </div>
  );
}
