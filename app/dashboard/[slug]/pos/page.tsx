import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { POSTerminal } from "@/components/dashboard/pos/pos-terminal";

interface POSPageProps {
  params: Promise<{ slug: string }>;
}

export default async function POSPage({ params }: POSPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Check if store mode allows offline sales
  if (store.storeMode === "online_only" || store.storeMode === "catalog") {
    notFound();
  }

  const categories = await getCategoriesWithCounts(store.id);

  // Default to camera mode if not set
  const scannerMode = (store.posScannerMode as "camera" | "usb") || "camera";

  return (
    <POSTerminal
      tenantId={store.id}
      storeSlug={slug}
      currency={store.currency}
      categories={categories}
      scannerMode={scannerMode}
    />
  );
}
