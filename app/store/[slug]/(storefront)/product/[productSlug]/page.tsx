import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath, getStoreBaseUrl } from "@/lib/utils/store-path";
import {
  getProductBySlugWithDetails,
  getProductImageSwatchUrls,
} from "@/lib/db/queries/products";
import { stripHtml } from "@/lib/utils/html";
import { getProductReviewStats } from "@/lib/db/queries/reviews";
import { getProductPriceTiers } from "@/lib/db/queries/pricing";
import { getProductCampaignDiscount } from "@/lib/db/queries/campaigns";
import { ProductPageContent } from "@/components/store/product-page-content";
import { ProductReviews } from "@/components/store/product-reviews";
import { ProductStructuredData } from "@/components/store/product-structured-data";
import { BreadcrumbStructuredData } from "@/components/store/breadcrumb-structured-data";
import {
  reviewSortOptions,
  type ReviewSortOption,
} from "@/lib/validations/reviews";
import { parseVariantFromUrl } from "@/lib/utils/variant-url";

interface ProductPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
  // Accept any string keys for dynamic option params (size, color, etc.)
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedProductSlug = decodeURIComponent(productSlug);

  const store = await resolveTenant(slug);
  if (!store) return { title: "Product Not Found" };

  const product = await getProductBySlugWithDetails(
    store.id,
    decodedProductSlug
  );
  if (!product) return { title: "Product Not Found" };

  // Parse variant from URL params (e.g., ?size=large&color=black)
  const { variantId } = parseVariantFromUrl(resolvedSearchParams, product);

  // Determine the image to show:
  // 1. If variant is selected, use variant's image (single or first from gallery)
  // 2. Fall back to product's primary image
  let imageToShow: string | undefined;

  if (variantId && product.variants) {
    const selectedVariant = product.variants.find((v) => v.id === variantId);
    if (selectedVariant) {
      // Try variant's single image first, then variant's image gallery
      imageToShow =
        selectedVariant.image?.url ||
        selectedVariant.images?.[0]?.media?.url ||
        undefined;
    }
  }

  // Fall back to product's primary image
  if (!imageToShow) {
    imageToShow = product.images?.[0]?.media?.url;
  }

  const plainDescription = product.description
    ? stripHtml(product.description)
    : `Buy ${product.name} at ${store.name}`;

  const storeBaseUrl = await getStoreBaseUrl(store.slug);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  // Include variant params in canonical URL for unique preview per variant
  const variantParams = new URLSearchParams(
    Object.entries(resolvedSearchParams).filter(
      ([key, value]) =>
        value !== undefined &&
        // Only include variant-related params, exclude pagination/sort
        !["sort", "rating", "page"].includes(key)
    ) as [string, string][]
  ).toString();
  const productUrl = variantParams
    ? `${storeBaseUrl}/product/${productSlug}?${variantParams}`
    : `${storeBaseUrl}/product/${productSlug}`;
  const imageUrl = imageToShow ? `${appUrl}${imageToShow}` : undefined;

  // Build title with variant info if available
  let title = product.name;
  if (variantId && product.variants) {
    const selectedVariant = product.variants.find((v) => v.id === variantId);
    if (selectedVariant?.options?.length) {
      const variantLabel = selectedVariant.options
        .map((o) => o.optionValue?.value)
        .filter(Boolean)
        .join(" / ");
      if (variantLabel) {
        title = `${product.name} - ${variantLabel}`;
      }
    }
  }

  // Truncate description to recommended length
  const truncatedDescription =
    plainDescription.length > 160
      ? `${plainDescription.slice(0, 157)}...`
      : plainDescription;

  // Get variant price if applicable
  const variantPrice =
    variantId && product.variants
      ? product.variants.find((v) => v.id === variantId)?.price
      : null;
  const displayPrice = variantPrice ?? product.price;

  return {
    title: `${title} | ${store.name}`,
    description: truncatedDescription,
    // Canonical URL prevents duplicate content issues
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      type: "website",
      title,
      description: truncatedDescription,
      url: productUrl,
      siteName: store.name,
      locale: "en_US",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: truncatedDescription,
      images: imageUrl ? [imageUrl] : undefined,
    },
    // Product-specific meta tags for richer previews
    other: {
      "product:price:amount": displayPrice,
      "product:price:currency": store.currency,
      "product:availability": "in stock",
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedProductSlug = decodeURIComponent(productSlug);

  // Validate sort parameter
  const sortBy: ReviewSortOption = reviewSortOptions.includes(
    resolvedSearchParams.sort as ReviewSortOption
  )
    ? (resolvedSearchParams.sort as ReviewSortOption)
    : "newest";

  // Validate rating filter (1-5)
  const rating = resolvedSearchParams.rating;
  const ratingFilter = rating
    ? parseInt(rating, 10) >= 1 && parseInt(rating, 10) <= 5
      ? parseInt(rating, 10)
      : undefined
    : undefined;

  const store = await resolveTenant(slug);
  if (!store) return null;

  const basePath = await getStoreBasePath(store.slug);

  const product = await getProductBySlugWithDetails(
    store.id,
    decodedProductSlug
  );
  if (!product || product.status !== "active" || !product.showOnStorefront) {
    notFound();
  }

  // Fetch review statistics, price tiers, image swatch URLs, and campaign discount in parallel
  const [reviewStats, priceTiers, imageSwatchUrls, campaignDiscount] =
    await Promise.all([
      getProductReviewStats(store.id, product.id),
      getProductPriceTiers(product.id),
      getProductImageSwatchUrls(product),
      getProductCampaignDiscount(store.id, product.id, product.categoryId),
    ]);

  // Build breadcrumbs
  const breadcrumbs = [
    { label: "Home", href: basePath || "/" },
    ...(product.category
      ? [
          {
            label: product.category.name,
            href: `${basePath}/category/${product.category.slug}`,
          },
        ]
      : []),
    { label: product.name, href: "#", current: true },
  ];

  // Check if online cart should be disabled
  // - catalog: Display only, contact for orders
  // - offline_only: POS only, in-store purchases only
  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  // Parse variant options from URL (e.g., ?size=large&color=black)
  // This enables human-readable, SEO-friendly variant URLs
  const { variantId: initialVariantId, options: initialOptions } =
    parseVariantFromUrl(resolvedSearchParams, product);

  return (
    <>
      {/* Schema.org Product structured data for SEO */}
      <ProductStructuredData
        product={product}
        storeName={store.name}
        storeSlug={store.slug}
        productSlug={decodedProductSlug}
        currency={store.currency}
        reviewStats={reviewStats}
      />
      {/* Schema.org Breadcrumb structured data for SEO */}
      <BreadcrumbStructuredData breadcrumbs={breadcrumbs} />

      <section className="py-4 sm:py-8 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Product Content Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-12 xl:gap-16">
            <ProductPageContent
              product={product}
              tenantId={store.id}
              storeSlug={store.slug}
              currency={store.currency}
              breadcrumbs={breadcrumbs}
              reviewStats={reviewStats}
              priceTiers={priceTiers}
              catalogMode={isCartDisabled}
              storeMode={store.storeMode}
              contactPhone={store.contactPhone}
              imageSwatchUrls={imageSwatchUrls}
              initialVariantId={initialVariantId}
              initialOptions={initialOptions}
              campaignDiscount={campaignDiscount}
            />
          </div>

          {/* Reviews Section */}
          <section className="mt-12 sm:mt-16 lg:mt-20">
            <ProductReviews
              tenantId={store.id}
              productId={product.id}
              productSlug={decodedProductSlug}
              storeSlug={store.slug}
              productName={product.name}
              sortBy={sortBy}
              ratingFilter={ratingFilter}
            />
          </section>
        </div>
      </section>
    </>
  );
}
