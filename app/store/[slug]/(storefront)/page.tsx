import Link from "next/link";
import { Package } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { ProductGridWithCart } from "@/components/store/product-grid-with-cart";
import { Button } from "@/components/ui/button";

interface StorePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const { slug } = await params;
  const { q: searchQuery, page } = await searchParams;
  const currentPage = page ? parseInt(page, 10) : 1;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  // Store validation is handled in layout, but we need the store for queries
  if (!store) {
    return null;
  }

  // Fetch products
  const productsResult = await getProducts(store.id, {
    page: currentPage,
    limit: 20,
    filters: { isActive: true, search: searchQuery },
    sort: { field: "createdAt", direction: "desc" },
  });

  const hasProducts = productsResult.products.length > 0;
  const totalPages = productsResult.pagination.totalPages;

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
            <>
              <ProductGridWithCart
                products={productsResult.products}
                storeSlug={slug}
                tenantId={store.id}
                currency={store.currency}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {currentPage > 1 && (
                    <Button variant="outline" asChild>
                      <Link
                        href={`/store/${slug}?${new URLSearchParams({
                          ...(searchQuery && { q: searchQuery }),
                          page: String(currentPage - 1),
                        })}`}
                      >
                        Previous
                      </Link>
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "ghost"
                          }
                          size="icon"
                          asChild
                        >
                          <Link
                            href={`/store/${slug}?${new URLSearchParams({
                              ...(searchQuery && { q: searchQuery }),
                              page: String(pageNum),
                            })}`}
                          >
                            {pageNum}
                          </Link>
                        </Button>
                      );
                    })}
                  </div>

                  {currentPage < totalPages && (
                    <Button variant="outline" asChild>
                      <Link
                        href={`/store/${slug}?${new URLSearchParams({
                          ...(searchQuery && { q: searchQuery }),
                          page: String(currentPage + 1),
                        })}`}
                      >
                        Next
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
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
