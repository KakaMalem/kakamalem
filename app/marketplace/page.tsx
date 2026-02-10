import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getMarketplaceStores,
  getMarketplacePlatformCategories,
  getMarketplaceCities,
} from "@/lib/db/queries/marketplace";
import { InfiniteScrollStores } from "@/components/marketplace/infinite-scroll-stores";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Marketplace - Discover Stores | Kaka Malem",
  description:
    "Browse and discover stores from merchants across Afghanistan on the Kaka Malem marketplace.",
  openGraph: {
    title: "Marketplace - Discover Stores | Kaka Malem",
    description:
      "Browse and discover stores from merchants across Afghanistan.",
    type: "website",
  },
};

interface MarketplacePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    sort?: string;
  }>;
}

export default async function MarketplacePage({
  searchParams,
}: MarketplacePageProps) {
  const { q, category, city, sort } = await searchParams;

  const sortValue =
    (sort as "recommended" | "newest" | "rating" | "popular" | "name") ??
    "recommended";

  const [storesResult, categories, cities] = await Promise.all([
    getMarketplaceStores({
      page: 1,
      limit: 12,
      search: q,
      category,
      city,
      sort: sortValue,
    }),
    getMarketplacePlatformCategories(),
    getMarketplaceCities(),
  ]);

  const { stores, pagination } = storesResult;
  const isFiltering = !!q || !!category || !!city;

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <section className="border-b bg-muted/20 py-3">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense>
            <MarketplaceFilters
              categories={categories}
              cities={cities}
              activeCategory={category}
              activeCity={city}
              activeSort={sort}
            />
          </Suspense>
        </div>
      </section>

      {/* Stores Grid */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Search info */}
          {q && (
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {pagination.total}
                </span>{" "}
                store{pagination.total !== 1 ? "s" : ""} found for{" "}
                <span className="font-medium text-foreground">
                  &quot;{q}&quot;
                </span>
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/marketplace">Clear</Link>
              </Button>
            </div>
          )}

          <InfiniteScrollStores
            initialStores={stores}
            initialPagination={pagination}
            search={q}
            category={category}
            city={city}
            sort={sortValue}
            isFiltering={isFiltering}
          />
        </div>
      </section>
    </div>
  );
}
