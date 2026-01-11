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

  // Parse sorting
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt") || "createdAt";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "desc";

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

  return (
    <div className="container mx-auto px-4 py-8">
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
        currentSort={sort || "createdAt-desc"}
      />
    </div>
  );
}
