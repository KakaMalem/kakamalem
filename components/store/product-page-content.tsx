"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductImageGallery } from "@/components/store/product-image-gallery";
import { ProductInfo } from "@/components/store/product-info";

import type { ProductWithDetails } from "@/lib/db/queries/products";
import type { PriceTier } from "@/lib/db/schema";

interface Breadcrumb {
  label: string;
  href: string;
  current?: boolean;
}

interface ReviewStats {
  averageRating: number | null;
  totalReviews: number;
}

interface ProductPageContentProps {
  product: ProductWithDetails;
  tenantId: string;
  storeSlug: string;
  currency: string;
  breadcrumbs: Breadcrumb[];
  reviewStats: ReviewStats;
  priceTiers?: PriceTier[];
  initialIsInWishlist?: boolean;
  /** When true, hides add-to-cart and quantity controls */
  catalogMode?: boolean;
  /** Store mode for appropriate messaging */
  storeMode?: "full" | "online_only" | "offline_only" | "catalog";
  /** Contact phone for catalog/offline mode */
  contactPhone?: string | null;
}

export function ProductPageContent({
  product,
  tenantId,
  storeSlug,
  currency,
  breadcrumbs,
  reviewStats,
  priceTiers = [],
  initialIsInWishlist = false,
  catalogMode = false,
  storeMode = "full",
  contactPhone,
}: ProductPageContentProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );

  // Get images based on selected variant
  const images = useMemo(() => {
    // If a variant is selected and has images, show variant images
    if (selectedVariantId && product.variants) {
      const selectedVariant = product.variants.find(
        (v) => v.id === selectedVariantId
      );

      // Check if variant has specific images
      if (selectedVariant?.images && selectedVariant.images.length > 0) {
        // Variant has specific images, use them
        return selectedVariant.images.map((img) => ({
          id: img.mediaId,
          url: img.media?.url || "",
          altText: img.media?.altText || product.name,
        }));
      }
    }

    // Fall back to main product images
    return (
      product.images?.map((img) => ({
        id: img.id,
        url: img.media?.url || "",
        altText: img.media?.altText || product.name,
      })) || []
    );
  }, [selectedVariantId, product]);

  return (
    <>
      {/* Image Gallery Column */}
      <div className="flex flex-col">
        <ProductImageGallery images={images} productName={product.name} />
      </div>

      {/* Product Info Column */}
      <div className="flex flex-col">
        {/* Breadcrumbs */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1 shrink-0">
                {crumb.current ? (
                  <span className="text-foreground font-medium truncate max-w-50">
                    {crumb.label}
                  </span>
                ) : (
                  <>
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      {crumb.label}
                    </Link>
                    <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                  </>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Product Info */}
        <ProductInfo
          product={product}
          tenantId={tenantId}
          storeSlug={storeSlug}
          currency={currency}
          reviewStats={reviewStats}
          priceTiers={priceTiers}
          onVariantChange={setSelectedVariantId}
          initialIsInWishlist={initialIsInWishlist}
          catalogMode={catalogMode}
          storeMode={storeMode}
          contactPhone={contactPhone}
        />
      </div>
    </>
  );
}
