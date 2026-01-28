"use client";

import { useState, useMemo, useCallback } from "react";
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
  /** When true, hides add-to-cart and quantity controls */
  catalogMode?: boolean;
  /** Store mode for appropriate messaging */
  storeMode?: "full" | "online_only" | "offline_only" | "catalog";
  /** Contact phone for catalog/offline mode */
  contactPhone?: string | null;
  /** Map of media ID to URL for image swatches */
  imageSwatchUrls?: Map<string, string>;
}

export function ProductPageContent({
  product,
  tenantId,
  storeSlug,
  currency,
  breadcrumbs,
  reviewStats,
  priceTiers = [],
  catalogMode = false,
  storeMode = "full",
  contactPhone,
  imageSwatchUrls,
}: ProductPageContentProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  // Handle variant and options change from ProductInfo
  const handleVariantChange = useCallback(
    (variantId: string | null, options: Record<string, string>) => {
      setSelectedVariantId(variantId);
      setSelectedOptions(options);
    },
    []
  );

  // Get images based on selected options and option value image mappings
  const images = useMemo(() => {
    // If a variant is selected and has specific images, prioritize those
    if (selectedVariantId && product.variants) {
      const variant = product.variants.find((v) => v.id === selectedVariantId);
      if (variant?.images && variant.images.length > 0) {
        return variant.images.map((img) => ({
          id: img.mediaId,
          url: img.media?.url || "",
          altText: img.media?.altText || product.name,
        }));
      }
    }

    // Check if we have option value image mappings and selected options
    const hasOptionMappings =
      product.optionValueImages && product.optionValueImages.length > 0;
    const hasSelectedOptions = Object.keys(selectedOptions).length > 0;

    if (hasOptionMappings && hasSelectedOptions) {
      // Get all media IDs mapped to any of the selected option values
      const mappedMediaIds = new Set<string>();

      for (const mapping of product.optionValueImages!) {
        const optionName = mapping.optionValue?.option?.name;
        const optionValue = mapping.optionValue?.value;

        // Check if this mapping matches any selected option
        if (
          optionName &&
          optionValue &&
          selectedOptions[optionName] === optionValue
        ) {
          mappedMediaIds.add(mapping.mediaId);
        }
      }

      // If we have mapped images, filter product images to show only those
      if (mappedMediaIds.size > 0) {
        const filteredImages =
          product.images?.filter((img) =>
            mappedMediaIds.has(img.media?.id || "")
          ) || [];

        if (filteredImages.length > 0) {
          return filteredImages.map((img) => ({
            id: img.id,
            url: img.media?.url || "",
            altText: img.media?.altText || product.name,
          }));
        }
      }
    }

    // Fall back to all product images
    return (
      product.images?.map((img) => ({
        id: img.id,
        url: img.media?.url || "",
        altText: img.media?.altText || product.name,
      })) || []
    );
  }, [selectedVariantId, selectedOptions, product]);

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
          onVariantChange={handleVariantChange}
          catalogMode={catalogMode}
          storeMode={storeMode}
          contactPhone={contactPhone}
          imageSwatchUrls={imageSwatchUrls}
        />
      </div>
    </>
  );
}
