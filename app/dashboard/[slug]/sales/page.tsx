import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantScheduledSalesWithProducts } from "@/lib/db/queries/pricing";
import { getProducts } from "@/lib/db/queries/products";
import { SalesClient } from "./client";

interface SalesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SalesPage({ params }: SalesPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [salesData, productsData] = await Promise.all([
    getTenantScheduledSalesWithProducts(store.id),
    getProducts(store.id, { limit: 1000 }), // Get all products for the selector
  ]);

  // Transform sales to include product info in a flat structure
  const sales = salesData.map((sale) => ({
    ...sale,
    product: sale.product
      ? {
          name: sale.product.name,
          price: sale.product.price,
        }
      : undefined,
  }));

  // Get just the basic product info needed for the form
  const products = productsData.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Sales & Promotions
        </h1>
        <p className="text-muted-foreground">
          Schedule time-limited discounts for your products.
        </p>
      </div>

      <SalesClient
        tenantId={store.id}
        currency={store.currency}
        initialSales={sales}
        products={products}
      />
    </div>
  );
}
