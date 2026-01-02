import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductsForAdjustment } from "@/lib/db/queries/inventory";
import { StockAdjustmentForm } from "@/components/dashboard/inventory/stock-adjustment-form";

interface AdjustStockPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ productId?: string }>;
}

export default async function AdjustStockPage({
  params,
  searchParams,
}: AdjustStockPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const products = await getProductsForAdjustment(store.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Adjust Stock</h1>
        <p className="text-muted-foreground">
          Add, remove, or set stock quantities for your products.
        </p>
      </div>

      {/* Adjustment Form */}
      <StockAdjustmentForm
        tenantId={store.id}
        storeSlug={slug}
        products={products}
        preselectedProductId={search.productId}
      />
    </div>
  );
}
