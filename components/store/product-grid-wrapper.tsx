"use client";

import dynamic from "next/dynamic";

// Dynamic import to prevent hydration mismatch with Radix Select
const ProductGrid = dynamic(
  () =>
    import("@/components/store/product-grid").then((mod) => mod.ProductGrid),
  {
    ssr: false,
    loading: () => (
      <div>
        {/* Sort Controls Skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded-md bg-muted" />
        </div>
        {/* Products Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    ),
  }
);

interface ProductGridWrapperProps {
  products: {
    id: string;
    name: string;
    slug: string;
    price: string;
    stock: number;
    hasVariants: boolean;
    trackInventory: boolean;
    status: "draft" | "active" | "archived";
    image: { url: string; altText: string | null } | null;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  storeSlug: string;
  tenantId: string;
  currency: string;
  basePath: string;
  currentSort?: string;
}

export function ProductGridWrapper(props: ProductGridWrapperProps) {
  return <ProductGrid {...props} />;
}
