"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductImageGallery } from "@/components/store/product-image-gallery";
import { ProductInfo } from "@/components/store/product-info";
import { buildVariantUrlParams } from "@/lib/utils/variant-url";

import type { ProductWithDetails } from "@/lib/db/queries/products";
import type { PriceTier } from "@/lib/db/schema";
import type { CampaignDiscount } from "@/lib/utils/pricing-display";

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
  /** Initial variant ID from URL param (for shareable links) */
  initialVariantId?: string;
  /** Initial options from URL params (e.g., {Size: "Large", Color: "Black"}) */
  initialOptions?: Record<string, string>;
  /** Campaign discount for this product */
  campaignDiscount?: CampaignDiscount | null;
}

/**
 * Compute the default variant and options for a product.
 * This is extracted so both parent and child can use the same logic,
 * ensuring server-render matches client-render (no jitter).
 *
 * @param product - The product with variants
 * @param initialVariantId - Optional variant ID from URL (for shareable links)
 * @param initialOptions - Optional options from URL (e.g., {Size: "Large"})
 */
function computeDefaultVariantState(
  product: ProductWithDetails,
  initialVariantId?: string,
  initialOptions?: Record<string, string>
): {
  variantId: string | null;
  options: Record<string, string>;
} {
  if (!product.hasVariants || !product.variants?.length) {
    return { variantId: null, options: {} };
  }

  // If initialVariantId is provided and valid, use that variant
  let variantToUse = initialVariantId
    ? product.variants.find((v) => v.id === initialVariantId)
    : undefined;

  // If no initial variant or not found, find first available variant
  if (!variantToUse) {
    const firstAvailableVariant = product.variants.find((variant) => {
      if (!variant.isActive) return false;
      // Available if: not tracking inventory, allows backorder, or has stock
      return (
        !product.trackInventory || product.allowBackorder || variant.stock > 0
      );
    });

    // Fall back to first variant if none are available
    variantToUse = firstAvailableVariant || product.variants[0];
  }

  if (!variantToUse?.options) {
    return { variantId: variantToUse?.id || null, options: {} };
  }

  const options: Record<string, string> = {};
  for (const opt of variantToUse.options) {
    if (opt.optionValue?.option?.name && opt.optionValue?.value) {
      options[opt.optionValue.option.name] = opt.optionValue.value;
    }
  }

  // If initialOptions were provided, merge them (they take precedence)
  // This handles partial URL params where only some options are specified
  if (initialOptions && Object.keys(initialOptions).length > 0) {
    for (const [key, value] of Object.entries(initialOptions)) {
      if (value) {
        options[key] = value;
      }
    }
  }

  return { variantId: variantToUse.id, options };
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
  initialVariantId,
  initialOptions,
  campaignDiscount,
}: ProductPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track if this is the initial render to avoid URL update on mount
  const isInitialRender = useRef(true);
  // Track the last URL we set to prevent infinite loops
  const lastSetUrlRef = useRef<string | null>(null);

  // Compute default state once during initialization (same on server & client)
  // Uses URL options if provided, otherwise selects first available variant
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () =>
      computeDefaultVariantState(product, initialVariantId, initialOptions)
        .variantId
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(
    () =>
      computeDefaultVariantState(product, initialVariantId, initialOptions)
        .options
  );

  // Sync URL when options change (including initial render if variant was auto-selected)
  // Uses human-readable format: ?size=large&color=black
  useEffect(() => {
    // Build new URL with slugified option params
    const params = buildVariantUrlParams(selectedOptions, searchParams);

    // Use replace to avoid adding to history on every variant change
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    if (isInitialRender.current) {
      isInitialRender.current = false;
      // On initial render, only update URL if a default variant was auto-selected
      // but the URL doesn't already have variant params
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (newUrl === currentUrl) {
        return;
      }
    }

    // Prevent infinite loop: don't update if URL is the same as what we last set
    if (lastSetUrlRef.current === newUrl) {
      return;
    }

    lastSetUrlRef.current = newUrl;
    router.replace(newUrl, { scroll: false });
  }, [selectedOptions, pathname, searchParams, router]);

  // Handle variant and options change from ProductInfo
  // Only update state if values actually changed (avoids unnecessary re-renders)
  const handleVariantChange = useCallback(
    (variantId: string | null, options: Record<string, string>) => {
      setSelectedVariantId((prev) => (prev === variantId ? prev : variantId));
      setSelectedOptions((prev) => {
        // Quick shallow compare for options object
        const keys = Object.keys(options);
        const prevKeys = Object.keys(prev);
        if (keys.length !== prevKeys.length) return options;
        for (const key of keys) {
          if (prev[key] !== options[key]) return options;
        }
        return prev; // Same content, keep reference to avoid re-render
      });
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
      {/* Image Gallery Column - sticky on desktop so it stays visible while scrolling long descriptions */}
      <div className="flex flex-col md:sticky md:top-4 md:self-start">
        <ProductImageGallery
          images={images}
          productName={product.name}
          showThumbnails={!product.hasVariants}
        />
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
          initialVariantId={initialVariantId}
          initialOptions={initialOptions}
          campaignDiscount={campaignDiscount}
        />
      </div>
    </>
  );
}
