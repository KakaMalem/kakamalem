"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductImageGallery } from "@/components/store/product-image-gallery";
import { ProductInfo } from "@/components/store/product-info";

import type { ProductWithDetails } from "@/lib/db/queries/products";

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
}

export function ProductPageContent({
  product,
  tenantId,
  storeSlug,
  currency,
  breadcrumbs,
  reviewStats,
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
      <div className="flex flex-col gap-6">
        <ProductImageGallery images={images} productName={product.name} />
      </div>

      {/* Product Info Column */}
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <nav aria-label="breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground wrap-break-words sm:gap-2.5">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <li className="inline-flex items-center gap-1.5">
                  {crumb.current ? (
                    <span className="text-foreground font-normal">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
                {index < breadcrumbs.length - 1 && (
                  <li role="presentation" aria-hidden="true">
                    <ChevronRight className="size-3.5" />
                  </li>
                )}
              </div>
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
          onVariantChange={setSelectedVariantId}
        />
      </div>
    </>
  );
}
