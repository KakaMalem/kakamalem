import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { ProductGridWrapper } from "@/components/store/product-grid-wrapper";

interface ProductsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string; search?: string }>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { slug } = await params;
  const { page, sort, search } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  // Parse pagination and sorting
  const currentPage = parseInt(page || "1", 10);
  const sortField =
    (sort?.split("-")[0] as "name" | "price" | "createdAt") || "createdAt";
  const sortDirection = (sort?.split("-")[1] as "asc" | "desc") || "desc";

  const productsResult = await getProducts(store.id, {
    page: currentPage,
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

      {/* Products Grid with Sorting and Pagination */}
      <ProductGridWrapper
        products={productsResult.products}
        pagination={productsResult.pagination}
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        basePath={`/store/${slug}/products`}
        currentSort={sort}
      />
    </div>
  );
}
