"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Store } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { MarketplaceStoreCard } from "./marketplace-store-card";
import { fetchMoreStores } from "@/lib/actions/marketplace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketplaceStore } from "@/lib/db/queries/marketplace";

interface InfiniteScrollStoresProps {
  initialStores: MarketplaceStore[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  search?: string;
  category?: string;
  city?: string;
  sort?: "recommended" | "newest" | "rating" | "popular" | "name";
  isFiltering: boolean;
}

function StoreCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-background">
      <Skeleton className="aspect-video w-full" />
      <div className="flex flex-col gap-2 px-3 pb-3 pt-7">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-2 flex gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

export function InfiniteScrollStores({
  initialStores,
  initialPagination,
  search,
  category,
  city,
  sort,
  isFiltering,
}: InfiniteScrollStoresProps) {
  const [stores, setStores] = useState<MarketplaceStore[]>(initialStores);
  const [page, setPage] = useState(initialPagination.page);
  const [hasMore, setHasMore] = useState(
    initialPagination.page < initialPagination.totalPages
  );
  const [total, setTotal] = useState(initialPagination.total);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when filters change (props update from server)
  useEffect(() => {
    setStores(initialStores);
    setPage(initialPagination.page);
    setHasMore(initialPagination.page < initialPagination.totalPages);
    setTotal(initialPagination.total);
  }, [initialStores, initialPagination]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const result = await fetchMoreStores({
        page: nextPage,
        limit: initialPagination.limit,
        search,
        category,
        city,
        sort,
      });

      setStores((prev) => [...prev, ...result.stores]);
      setPage(nextPage);
      setHasMore(nextPage < result.pagination.totalPages);
    } catch (error) {
      console.error("Error loading more stores:", error);
      toast.error("Failed to load more stores");
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    hasMore,
    page,
    initialPagination.limit,
    search,
    category,
    city,
    sort,
  ]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
          <Store className="size-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold">
          {isFiltering ? "No stores found" : "No stores yet"}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {isFiltering
            ? "Try adjusting your search or clearing the filters."
            : "Be the first to list your store on the marketplace!"}
        </p>
        {isFiltering ? (
          <Button variant="outline" className="mt-6" asChild>
            <Link href="/marketplace">Clear filters</Link>
          </Button>
        ) : (
          <Button className="mt-6" asChild>
            <Link href="/signup">Create Your Store</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Stores Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {stores.map((store) => (
          <MarketplaceStoreCard key={store.id} store={store} />
        ))}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: initialPagination.limit }).map((_, i) => (
            <StoreCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="py-8">
        {!hasMore && stores.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;ve seen all {total} stores
          </p>
        )}
      </div>
    </div>
  );
}
