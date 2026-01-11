"use client";

import dynamic from "next/dynamic";
import type { ProductFilters } from "@/lib/db/queries/products";

// Dynamic import to prevent hydration mismatch with Radix Select
const InfiniteScrollProductsWithSort = dynamic(
  () =>
    import("@/components/store/infinite-scroll-products-with-sort").then(
      (mod) => mod.InfiniteScrollProductsWithSort
    ),
  {
    ssr: false,
    loading: () => (
      <div>
        {/* Sort Controls Skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded-md bg-muted" />
        </div>
        {/* Products Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-4/5 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    ),
  }
);

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice?: string | null;
  stock: number;
  hasVariants: boolean;
  trackInventory: boolean;
  showStock: boolean;
  status: "draft" | "active" | "archived";
  image: { url: string; altText: string | null } | null;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
}

interface InfiniteScrollWrapperProps {
  initialProducts: Product[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  tenantId: string;
  storeSlug: string;
  currency: string;
  basePath: string;
  filters?: ProductFilters;
  currentSort?: string;
}

export function InfiniteScrollWrapper(props: InfiniteScrollWrapperProps) {
  return <InfiniteScrollProductsWithSort {...props} />;
}
