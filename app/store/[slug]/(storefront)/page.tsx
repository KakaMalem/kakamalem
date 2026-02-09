import Link from "next/link";
import { Package } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";
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

  // Fetch products and active campaigns in parallel
  const [productsResult, activeCampaigns] = await Promise.all([
    getProducts(store.id, {
      page: 1,
      limit: 20,
      filters: { isActive: true, showOnStorefront: true, search: searchQuery },
      sort: { field: "displayOrder", direction: "asc" },
    }),
    getActiveCampaigns(store.id),
  ]);

  const hasProducts = productsResult.products.length > 0;

  // Check if online cart should be disabled
  // - catalog: Display only, no checkout anywhere
  // - offline_only: POS only, no online checkout
  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  return (
    <div className="flex flex-col min-h-[50vh]">
      {/* Search Results Info */}
      {searchQuery && (
        <div className="border-b bg-muted/20 py-3 sm:py-4">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {productsResult.pagination.total}
                </span>{" "}
                result{productsResult.pagination.total !== 1 && "s"} for{" "}
                <span className="font-medium text-foreground">
                  &quot;{searchQuery}&quot;
                </span>
              </p>
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <Link href={`/store/${slug}`}>Clear</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <section className="py-6 sm:py-8 flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {hasProducts ? (
            <InfiniteScrollProducts
              initialProducts={productsResult.products}
              initialPagination={productsResult.pagination}
              tenantId={store.id}
              storeSlug={slug}
              currency={store.currency}
              filters={{
                isActive: true,
                showOnStorefront: true,
                search: searchQuery,
              }}
              sort={{ field: "displayOrder", direction: "asc" }}
              catalogMode={isCartDisabled}
              activeCampaigns={activeCampaigns}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
              <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
                <Package className="size-10 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-semibold">
                {searchQuery ? "No products found" : "No products yet"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                {searchQuery
                  ? "Try adjusting your search terms or browse our categories"
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
