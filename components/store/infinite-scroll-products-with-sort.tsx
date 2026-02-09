"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { ProductCard } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/lib/hooks/use-cart";
import type { CartItemProduct } from "@/lib/types/cart";
import {
  fetchMoreProducts,
  type FetchProductsResult,
} from "@/lib/actions/store-products";
import type { ProductFilters, ProductSort } from "@/lib/db/queries/products";
import type { CampaignDiscount } from "@/lib/utils/pricing-display";

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
  minVariantPrice?: string;
  maxVariantPrice?: string;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  categoryId?: string | null;
}

/** Campaign data for calculating discounts */
export interface ActiveCampaign {
  id: string;
  name: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  scope: "store_wide" | "categories" | "products";
  eligibleCategories: string[] | null;
  eligibleProducts: string[] | null;
  excludedProducts: string[] | null;
  showBadge: boolean;
  badgeText: string | null;
}

interface InfiniteScrollProductsWithSortProps {
  initialProducts: Product[];
  initialPagination: FetchProductsResult["pagination"];
  tenantId: string;
  storeSlug: string;
  currency: string;
  basePath: string;
  filters?: ProductFilters;
  currentSort?: string;
  /** When true, hides add-to-cart buttons (catalog/showcase mode) */
  catalogMode?: boolean;
  /** Active campaigns for discount calculation (sorted by priority) */
  activeCampaigns?: ActiveCampaign[];
}

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest" },
  { value: "createdAt-asc", label: "Oldest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
];

function parseSortParam(sort: string | undefined): ProductSort {
  if (!sort) return { field: "createdAt", direction: "desc" };
  const [field, direction] = sort.split("-") as [
    "name" | "price" | "createdAt",
    "asc" | "desc",
  ];
  return {
    field: field || "createdAt",
    direction: direction || "desc",
  };
}

/**
 * Get the best applicable campaign discount for a product
 */
function getProductCampaignDiscount(
  product: Product,
  campaigns: ActiveCampaign[]
): CampaignDiscount | null {
  for (const campaign of campaigns) {
    // Check if product is excluded
    if (
      campaign.excludedProducts &&
      campaign.excludedProducts.includes(product.id)
    ) {
      continue;
    }

    let applies = false;

    // Check scope
    if (campaign.scope === "store_wide") {
      applies = true;
    } else if (
      campaign.scope === "categories" &&
      product.categoryId &&
      campaign.eligibleCategories?.includes(product.categoryId)
    ) {
      applies = true;
    } else if (
      campaign.scope === "products" &&
      campaign.eligibleProducts?.includes(product.id)
    ) {
      applies = true;
    }

    if (applies) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountValue: parseFloat(campaign.discountValue),
        badgeText: campaign.showBadge ? campaign.badgeText : null,
      };
    }
  }

  return null;
}

export function InfiniteScrollProductsWithSort({
  initialProducts,
  initialPagination,
  tenantId,
  storeSlug,
  currency,
  basePath,
  filters,
  currentSort = "createdAt-desc",
  catalogMode = false,
  activeCampaigns = [],
}: InfiniteScrollProductsWithSortProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(initialPagination.page);
  const [totalCount, setTotalCount] = useState(initialPagination.total);
  const [hasMore, setHasMore] = useState(
    initialPagination.page < initialPagination.totalPages
  );
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { addToCart, isAddingProduct } = useCart();

  const sort = parseSortParam(currentSort);

  // Reset when filters/sort change (props update from server)
  useEffect(() => {
    setProducts(initialProducts);
    setPage(initialPagination.page);
    setTotalCount(initialPagination.total);
    setHasMore(initialPagination.page < initialPagination.totalPages);
  }, [initialProducts, initialPagination]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const result = await fetchMoreProducts(tenantId, {
        page: nextPage,
        limit: initialPagination.limit,
        filters,
        sort,
      });

      setProducts((prev) => [...prev, ...result.products]);
      setPage(nextPage);
      setHasMore(nextPage < result.pagination.totalPages);
    } catch (error) {
      console.error("Error loading more products:", error);
      toast.error("Failed to load more products");
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    hasMore,
    page,
    tenantId,
    initialPagination.limit,
    filters,
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

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`${basePath}?${params.toString()}`);
  };

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (product.hasVariants) {
      router.push(`/store/${storeSlug}/product/${product.slug}`);
      return;
    }

    // Build optimistic product data for immediate UI update
    const optimisticProduct: CartItemProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      trackInventory: product.trackInventory,
      allowBackorder: false,
      status: product.status,
      hasVariants: product.hasVariants,
      image: product.image,
      priceTiers: [],
    };

    addToCart(productId, 1, null, optimisticProduct, null);
  };

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <PackageSearch className="mx-auto size-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-xl font-semibold text-muted-foreground">
          No products found
        </h2>
        <p className="mt-2 text-muted-foreground">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Sort Controls */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} product{totalCount !== 1 && "s"}
        </p>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            tenantId={tenantId}
            storeSlug={storeSlug}
            currency={currency}
            onAddToCart={catalogMode ? undefined : handleAddToCart}
            isAddingToCart={isAddingProduct(product.id)}
            catalogMode={catalogMode}
            campaignDiscount={getProductCampaignDiscount(
              product,
              activeCampaigns
            )}
          />
        ))}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mt-3 sm:mt-4">
          {Array.from({ length: initialPagination.limit }).map((_, i) => (
            <ProductCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="py-4">
        {!hasMore && products.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            You&apos;ve seen all {totalCount} products
          </p>
        )}
      </div>
    </div>
  );
}
