import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { StoreModeSettings } from "./store-mode-settings";

interface StoreModePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoreModePage({ params }: StoreModePageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Role-based access check (owner only)
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext, "store-mode")) {
    return (
      <AccessDenied
        message="Only the store owner can change store mode settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <StoreModeSettings
        storeId={store.id}
        storeSlug={slug}
        currentMode={store.storeMode}
        posScannerMode={store.posScannerMode}
        receiptPaperWidth={store.receiptPaperWidth}
        receiptShowLogo={store.receiptShowLogo}
        receiptShowContact={store.receiptShowContact}
        receiptFooterText={store.receiptFooterText}
        receiptPrintMode={store.receiptPrintMode}
      />
    </div>
  );
}
