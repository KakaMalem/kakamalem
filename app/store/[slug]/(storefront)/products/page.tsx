import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { InfiniteScrollWrapper } from "@/components/store/infinite-scroll-wrapper";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; search?: string }>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { slug } = await params;
  const { sort, search } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  // Parse sorting - default to displayOrder for manual ordering
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt" | "displayOrder") ||
    "displayOrder";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "asc";

  const productsResult = await getProducts(store.id, {
    page: 1,
    limit: 12,
    filters: {
      isActive: true,
      search: search || undefined,
    },
    sort: {
      field: sortField,
      direction: sortDirection,
    },
  });

  // Check if store is in catalog mode (no cart functionality)
  const isCatalogMode = store.storeMode === "catalog";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Products</h1>
        <p className="mt-2 text-muted-foreground">
          Browse our complete collection
        </p>
      </div>

      {/* Products Grid with Infinite Scroll */}
      <InfiniteScrollWrapper
        initialProducts={productsResult.products}
        initialPagination={productsResult.pagination}
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        basePath={`/store/${slug}/products`}
        filters={{
          isActive: true,
          search: search || undefined,
        }}
        currentSort={sort || "displayOrder-asc"}
        catalogMode={isCatalogMode}
      />
    </div>
  );
}
