"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addToCartAction } from "@/lib/cart/actions";
import { cartActions } from "@/lib/stores/use-cart-store";

interface ProductGridProps {
  products: {
    id: string;
    name: string;
    slug: string;
    price: string;
    stock: number;
    hasVariants: boolean;
    trackInventory: boolean;
    showStock: boolean;
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
}: ProductGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

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
        // Update local cart state
        cartActions.setCart(result.cart, storeSlug);
        toast.success("Added to cart", {
          description: product.name,
        });
        // Open cart drawer
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
    <div>
      {/* Sort Controls */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.limit + 1}-
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} products
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
