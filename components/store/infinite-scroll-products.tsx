"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";

import { ProductCard } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import { useCart } from "@/lib/hooks/use-cart";
import type { CartItemProduct } from "@/lib/types/cart";
import {
  fetchMoreProducts,
  type FetchProductsResult,
} from "@/lib/actions/store-products";
import type { ProductFilters, ProductSort } from "@/lib/db/queries/products";
import { type CampaignDiscount } from "@/lib/utils/pricing-display";

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

interface InfiniteScrollProductsProps {
  initialProducts: Product[];
  initialPagination: FetchProductsResult["pagination"];
  tenantId: string;
  storeSlug: string;
  currency: string;
  filters?: ProductFilters;
  sort?: ProductSort;
  /** When true, hides add-to-cart buttons (catalog/showcase mode) */
  catalogMode?: boolean;
  /** Active campaigns for discount calculation (sorted by priority) */
  activeCampaigns?: ActiveCampaign[];
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

export function InfiniteScrollProducts({
  initialProducts,
  initialPagination,
  tenantId,
  storeSlug,
  currency,
  filters,
  sort,
  catalogMode = false,
  activeCampaigns = [],
}: InfiniteScrollProductsProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(initialPagination.page);
  const [hasMore, setHasMore] = useState(
    initialPagination.page < initialPagination.totalPages
  );
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { addToCart, isAddingProduct } = useCart();

  // Reset when filters/sort change (props update from server)
  useEffect(() => {
    setProducts(initialProducts);
    setPage(initialPagination.page);
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
        rootMargin: "200px", // Start loading before reaching the bottom
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // If product has variants, navigate to product page to select variant
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
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
          <Package className="size-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold">No products found</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Try adjusting your search or filters to find what you&apos;re looking
          for
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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
      <div ref={sentinelRef} className="py-8">
        {!hasMore && products.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            You&apos;ve seen all {initialPagination.total} products
          </p>
        )}
      </div>
    </div>
  );
}
