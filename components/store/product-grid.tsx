"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";

import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/lib/hooks/use-cart";
import type { CartItemProduct } from "@/lib/types/cart";
import type { CampaignDiscount } from "@/lib/utils/pricing-display";
import { useStoreBasePath } from "@/components/store/store-path-provider";

interface ProductGridProps {
  products: {
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
  /** When true, hides add-to-cart buttons (catalog/showcase mode) */
  catalogMode?: boolean;
  /** Map of product ID to campaign discount */
  campaignDiscounts?: Map<string, CampaignDiscount>;
}

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest" },
  { value: "createdAt-asc", label: "Oldest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
];

export function ProductGrid({
  products,
  pagination,
  storeSlug,
  tenantId,
  currency,
  basePath,
  currentSort = "createdAt-desc",
  catalogMode = false,
  campaignDiscounts,
}: ProductGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeBasePath = useStoreBasePath();
  const { addToCart, isAddingProduct } = useCart();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page"); // Reset to page 1 when sorting changes
    router.push(`${basePath}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${basePath}?${params.toString()}`);
  };

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // If product has variants, navigate to product page to select variant
    if (product.hasVariants) {
      router.push(`${storeBasePath}/product/${product.slug}`);
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
          <PackageSearch className="size-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold">No products found</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Try adjusting your filters or check back later
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Sort Controls */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.limit + 1}-
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} products
        </p>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-45">
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
            campaignDiscount={campaignDiscounts?.get(product.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Show first, last, current, and adjacent pages
                return (
                  page === 1 ||
                  page === pagination.totalPages ||
                  Math.abs(page - pagination.page) <= 1
                );
              })
              .map((page, index, array) => {
                // Add ellipsis
                const prevPage = array[index - 1];
                const showEllipsis = prevPage && page - prevPage > 1;

                return (
                  <span key={page} className="flex items-center">
                    {showEllipsis && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={page === pagination.page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="h-9 w-9"
                    >
                      {page}
                    </Button>
                  </span>
                );
              })}
          </div>
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
