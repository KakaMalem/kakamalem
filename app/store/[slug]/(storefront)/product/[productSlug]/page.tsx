import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductBySlugWithDetails } from "@/lib/db/queries/products";
import { stripHtml } from "@/lib/utils/html";
import { getProductReviewStats } from "@/lib/db/queries/reviews";
import { getProductPriceTiers } from "@/lib/db/queries/pricing";
import { isProductInWishlist } from "@/lib/db/queries/wishlists";
import { getUser } from "@/lib/auth/server";
import { ProductPageContent } from "@/components/store/product-page-content";
import { ProductReviews } from "@/components/store/product-reviews";

interface ProductPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
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

  return {
    title: `${product.name} | ${store.name}`,
    description: plainDescription,
    openGraph: {
      title: product.name,
      description: plainDescription,
      images: primaryImage ? [{ url: primaryImage }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug, productSlug } = await params;
  // Decode URL-encoded slugs (handles Persian/Unicode characters)
  const decodedProductSlug = decodeURIComponent(productSlug);

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  const product = await getProductBySlugWithDetails(
    store.id,
    decodedProductSlug
  );
  if (!product || product.status !== "active") {
    notFound();
  }

  // Fetch review statistics, price tiers, and wishlist status in parallel
  const user = await getUser();
  const [reviewStats, priceTiers, isInWishlist] = await Promise.all([
    getProductReviewStats(store.id, product.id),
    getProductPriceTiers(product.id),
    user ? isProductInWishlist(store.id, user.id, product.id) : false,
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
            initialIsInWishlist={isInWishlist}
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
            storeSlug={slug}
          />
        </section>
      </div>
    </section>
  );
}
