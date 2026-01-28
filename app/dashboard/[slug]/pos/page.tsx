import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { POSTerminal } from "@/components/dashboard/pos/pos-terminal";
import type { ReceiptPrintMode } from "@/lib/validations/stores";

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
  const receiptPrintMode =
    (store.receiptPrintMode as ReceiptPrintMode) || "prompt";
  const receiptPaperWidth =
    (store.receiptPaperWidth as "58mm" | "80mm") || "80mm";

  return (
    <POSTerminal
      tenantId={store.id}
      storeSlug={slug}
      currency={store.currency}
      categories={categories}
      scannerMode={scannerMode}
      receiptPrintMode={receiptPrintMode}
      storeName={store.name}
      storePhone={store.contactPhone}
      receiptFooterText={store.receiptFooterText}
      receiptPaperWidth={receiptPaperWidth}
    />
  );
}
