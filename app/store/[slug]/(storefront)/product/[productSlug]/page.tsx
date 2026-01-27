import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductBySlugWithDetails } from "@/lib/db/queries/products";
import { stripHtml } from "@/lib/utils/html";
import { getProductReviewStats } from "@/lib/db/queries/reviews";
import { getProductPriceTiers } from "@/lib/db/queries/pricing";
import { ProductPageContent } from "@/components/store/product-page-content";
import { ProductReviews } from "@/components/store/product-reviews";
import { ProductStructuredData } from "@/components/store/product-structured-data";
import {
  reviewSortOptions,
  type ReviewSortOption,
} from "@/lib/validations/reviews";

interface ProductPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ sort?: string; rating?: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedProductSlug = decodeURIComponent(productSlug);

  const store = await getTenantBySlug(slug);
  if (!store) return { title: "Product Not Found" };

  const product = await getProductBySlugWithDetails(
    store.id,
    decodedProductSlug
  );
  if (!product) return { title: "Product Not Found" };

  const primaryImage = product.images?.[0]?.media?.url;
  const plainDescription = product.description
    ? stripHtml(product.description)
    : `Buy ${product.name} at ${store.name}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const productUrl = `${appUrl}/store/${slug}/product/${productSlug}`;
  const imageUrl = primaryImage ? `${appUrl}${primaryImage}` : undefined;

  return {
    title: `${product.name} | ${store.name}`,
    description: plainDescription,
    openGraph: {
      type: "website",
      title: product.name,
      description: plainDescription,
      url: productUrl,
      siteName: store.name,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: product.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: plainDescription,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { slug, productSlug } = await params;
  const { sort, rating } = await searchParams;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedProductSlug = decodeURIComponent(productSlug);

  // Validate sort parameter
  const sortBy: ReviewSortOption = reviewSortOptions.includes(
    sort as ReviewSortOption
  )
    ? (sort as ReviewSortOption)
    : "newest";

  // Validate rating filter (1-5)
  const ratingFilter = rating
    ? parseInt(rating, 10) >= 1 && parseInt(rating, 10) <= 5
      ? parseInt(rating, 10)
      : undefined
    : undefined;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  const product = await getProductBySlugWithDetails(
    store.id,
    decodedProductSlug
  );
  if (!product || product.status !== "active" || !product.showOnStorefront) {
    notFound();
  }

  // Fetch review statistics and price tiers in parallel
  const [reviewStats, priceTiers] = await Promise.all([
    getProductReviewStats(store.id, product.id),
    getProductPriceTiers(product.id),
  ]);

  // Build breadcrumbs
  const breadcrumbs = [
    { label: "Home", href: `/store/${slug}` },
    ...(product.category
      ? [
          {
            label: product.category.name,
            href: `/store/${slug}/category/${product.category.slug}`,
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

  return (
    <>
      {/* Schema.org Product structured data for SEO */}
      <ProductStructuredData
        product={product}
        storeName={store.name}
        storeSlug={slug}
        productSlug={decodedProductSlug}
        currency={store.currency}
        reviewStats={reviewStats}
      />

      <section className="py-4 sm:py-8 lg:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Product Content Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-12 xl:gap-16">
            <ProductPageContent
              product={product}
              tenantId={store.id}
              storeSlug={slug}
              currency={store.currency}
              breadcrumbs={breadcrumbs}
              reviewStats={reviewStats}
              priceTiers={priceTiers}
              catalogMode={isCartDisabled}
              storeMode={store.storeMode}
              contactPhone={store.contactPhone}
            />
          </div>

          {/* Reviews Section */}
          <section className="mt-12 sm:mt-16 lg:mt-20">
            <ProductReviews
              tenantId={store.id}
              productId={product.id}
              productSlug={decodedProductSlug}
              storeSlug={slug}
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
