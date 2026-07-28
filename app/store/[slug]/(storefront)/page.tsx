import Link from "next/link";
import { Package } from "lucide-react";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";
import {
  getCategoriesWithCounts,
  getCategoryCoverFallbacks,
} from "@/lib/db/queries/categories";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { InfiniteScrollProducts } from "@/components/store/infinite-scroll-products";
import { CategoryShowcase } from "@/components/store/category-showcase";
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
  const store = await resolveTenant(slug);

  // Store validation is handled in layout, but we need the store for queries
  if (!store) {
    return null;
  }

  const basePath = await getStoreBasePath(store.slug);

  // Categories lead the homepage only when the seller opted in — and never
  // over search results, which land on this same route (the header pushes
  // `${basePath}?q=...`) and must show matching products, not collections.
  const leadWithCategories =
    store.homepageLayout === "categories" && !searchQuery;

  // Fetch products, active campaigns, and (when leading with categories) the
  // category grid data in parallel
  const [productsResult, activeCampaigns, categories, categoryCovers] =
    await Promise.all([
      getProducts(store.id, {
        page: 1,
        limit: 20,
        filters: {
          isActive: true,
          showOnStorefront: true,
          search: searchQuery,
        },
        sort: { field: "displayOrder", direction: "asc" },
      }),
      getActiveCampaigns(store.id),
      leadWithCategories
        ? getCategoriesWithCounts(store.id, { storefrontOnly: true })
        : [],
      leadWithCategories
        ? getCategoryCoverFallbacks(store.id)
        : new Map<string, string>(),
    ]);

  const hasProducts = productsResult.products.length > 0;

  // Check if online cart should be disabled
  // - catalog: Display only, no checkout anywhere
  // - offline_only: POS only, no online checkout
  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  const showCategoryShowcase = leadWithCategories && categories.length > 0;

  return (
    <div className="flex min-h-[50vh] flex-col">
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
                <Link href={basePath || "/"}>Clear</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Categories first (opt-in via branding settings) */}
      {showCategoryShowcase && (
        <section className="pt-6 sm:pt-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <CategoryShowcase
              variant="home"
              basePath={basePath}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                imageUrl: c.imageUrl,
                productCount: c.productCount,
                coverImageUrl: categoryCovers.get(c.id) ?? null,
              }))}
            />
          </div>
        </section>
      )}

      {/* Products Grid */}
      <section className="flex-1 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {hasProducts ? (
            <>
              {showCategoryShowcase && (
                <h2 className="mb-4 text-xl font-bold tracking-tight sm:mb-6 sm:text-2xl">
                  All Products
                </h2>
              )}
              <InfiniteScrollProducts
                initialProducts={productsResult.products}
                initialPagination={productsResult.pagination}
                tenantId={store.id}
                storeSlug={store.slug}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
              <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
                <Package className="size-10 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-semibold">
                {searchQuery ? "No products found" : "No products yet"}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms or browse our categories"
                  : "Check back soon for new arrivals!"}
              </p>
              {searchQuery && (
                <Button variant="outline" className="mt-6" asChild>
                  <Link href={basePath || "/"}>Clear search</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
