"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

import { ProductCard } from "./product-card";
import { addToCartAction } from "@/lib/cart/actions";
import { cartActions } from "@/lib/stores/use-cart-store";
import {
  fetchMoreProducts,
  type FetchProductsResult,
} from "@/lib/actions/store-products";
import type { ProductFilters, ProductSort } from "@/lib/db/queries/products";

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

interface InfiniteScrollProductsProps {
  initialProducts: Product[];
  initialPagination: FetchProductsResult["pagination"];
  tenantId: string;
  storeSlug: string;
  currency: string;
  filters?: ProductFilters;
  sort?: ProductSort;
}

export function InfiniteScrollProducts({
  initialProducts,
  initialPagination,
  tenantId,
  storeSlug,
  currency,
  filters,
  sort,
}: InfiniteScrollProductsProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(initialPagination.page);
  const [hasMore, setHasMore] = useState(
    initialPagination.page < initialPagination.totalPages
  );
  const [isLoading, setIsLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const handleAddToCart = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // If product has variants, navigate to product page to select variant
    if (product.hasVariants) {
      router.push(`/store/${storeSlug}/product/${product.slug}`);
      return;
    }

    setAddingToCart(productId);
    try {
      const result = await addToCartAction(
        tenantId,
        storeSlug,
        productId,
        1,
        null
      );

      if (result.success) {
        cartActions.setCart(result.cart, storeSlug);
        toast.success("Added to cart", {
          description: product.name,
        });
        cartActions.setIsOpen(true);
      } else {
        toast.error("Failed to add to cart", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Failed to add to cart", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setAddingToCart(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
          <Package className="size-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          No products found
        </h2>
        <p className="mt-2 text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            currency={currency}
            onAddToCart={handleAddToCart}
            isAddingToCart={addingToCart === product.id}
          />
        ))}
      </div>

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading more products...</span>
          </div>
        )}
        {!hasMore && products.length > 0 && (
          <p className="text-sm text-muted-foreground">
            You&apos;ve seen all {initialPagination.total} products
          </p>
        )}
      </div>
    </div>
  );
}
