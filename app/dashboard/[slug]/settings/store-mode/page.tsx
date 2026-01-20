import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { StoreModeSettings } from "./store-mode-settings";

interface StoreModePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoreModePage({ params }: StoreModePageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <StoreModeSettings
        storeId={store.id}
        storeSlug={slug}
        currentMode={store.storeMode}
        onlineCheckoutEnabled={store.onlineCheckoutEnabled}
        posEnabled={store.posEnabled}
        phoneOrdersEnabled={store.phoneOrdersEnabled}
        receiptPaperWidth={store.receiptPaperWidth}
        receiptShowLogo={store.receiptShowLogo}
        receiptShowContact={store.receiptShowContact}
        receiptFooterText={store.receiptFooterText}
      />
    </div>
  );
}
