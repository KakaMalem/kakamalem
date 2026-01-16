import Link from "next/link";
import { Package } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { InfiniteScrollProducts } from "@/components/store/infinite-scroll-products";
import { Button } from "@/components/ui/button";

interface StorePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const { slug } = await params;
  const { q: searchQuery } = await searchParams;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  // Store validation is handled in layout, but we need the store for queries
  if (!store) {
    return null;
  }

  // Fetch products - initial load for infinite scroll
  const productsResult = await getProducts(store.id, {
    page: 1,
    limit: 20,
    filters: { isActive: true, search: searchQuery },
    sort: { field: "displayOrder", direction: "asc" },
  });

  const hasProducts = productsResult.products.length > 0;

  return (
    <div className="flex flex-col">
      {/* Search Results Info */}
      {searchQuery && (
        <div className="border-b bg-muted/30 py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {productsResult.pagination.total} result
                {productsResult.pagination.total !== 1 && "s"} for &quot;
                {searchQuery}&quot;
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/store/${slug}`}>Clear search</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {hasProducts ? (
            <InfiniteScrollProducts
              initialProducts={productsResult.products}
              initialPagination={productsResult.pagination}
              tenantId={store.id}
              storeSlug={slug}
              currency={store.currency}
              filters={{ isActive: true, search: searchQuery }}
              sort={{ field: "displayOrder", direction: "asc" }}
            />
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
                <Package className="size-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {searchQuery ? "No products found" : "No products yet"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Check back soon for new arrivals!"}
              </p>
              {searchQuery && (
                <Button variant="outline" className="mt-6" asChild>
                  <Link href={`/store/${slug}`}>Clear search</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
