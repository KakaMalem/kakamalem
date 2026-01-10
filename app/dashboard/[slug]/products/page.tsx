import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { ProductsPageClient } from "@/components/dashboard/products/products-page-client";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Parse search params
  const page = parseInt(search.page || "1");
  const limit = Math.min(Math.max(parseInt(search.limit || "25"), 25), 500); // Clamp between 25 and 500
  const showArchived = search.status === "archived";
  const filters = {
    search: search.search,
    isActive: showArchived ? false : true,
  };
  const sort = search.sort
    ? {
        field: search.sort as
          | "name"
          | "price"
          | "stock"
          | "createdAt"
          | "displayOrder",
        direction: (search.order || "desc") as "asc" | "desc",
      }
    : undefined;

  // Fetch products
  const { products, pagination } = await getProducts(store.id, {
    page,
    limit,
    filters,
    sort,
  });

  return (
    <ProductsPageClient
      storeSlug={slug}
      tenantId={store.id}
      currency={store.currency}
      products={products}
      pagination={pagination}
      searchParams={search}
      currentLimit={limit}
      showArchived={showArchived}
    />
  );
}
