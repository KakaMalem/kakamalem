"use client";

import dynamic from "next/dynamic";
import type { ProductFilters } from "@/lib/db/queries/products";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "./product-card-skeleton";

// Dynamic import to prevent hydration mismatch with Radix Select
const InfiniteScrollProductsWithSort = dynamic(
  () =>
    import("@/components/store/infinite-scroll-products-with-sort").then(
      (mod) => mod.InfiniteScrollProductsWithSort
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col">
        {/* Sort Controls Skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-44" />
        </div>
        {/* Products Grid Skeleton */}
        <ProductGridSkeleton count={12} />
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
