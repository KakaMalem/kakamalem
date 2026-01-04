import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductBySlugWithDetails } from "@/lib/db/queries/products";
import { getProductReviewStats } from "@/lib/db/queries/reviews";
import { ProductPageContent } from "@/components/store/product-page-content";
import { ProductReviews } from "@/components/store/product-reviews";

interface ProductPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const store = await getTenantBySlug(slug);
  if (!store) return { title: "Product Not Found" };

  const product = await getProductBySlugWithDetails(store.id, productSlug);
  if (!product) return { title: "Product Not Found" };

  const primaryImage = product.images?.[0]?.media?.url;

  return {
    title: `${product.name} | ${store.name}`,
    description: product.description || `Buy ${product.name} at ${store.name}`,
    openGraph: {
      title: product.name,
      description:
        product.description || `Buy ${product.name} at ${store.name}`,
      images: primaryImage ? [{ url: primaryImage }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug, productSlug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) return null;

  const product = await getProductBySlugWithDetails(store.id, productSlug);
  if (!product || !product.isActive) {
    notFound();
  }

  // Fetch review statistics
  const reviewStats = await getProductReviewStats(store.id, product.id);

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

  return (
    <section className="py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Product Content Grid */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8 xl:gap-24">
          <ProductPageContent
            product={product}
            tenantId={store.id}
            storeSlug={slug}
            currency={store.currency}
            breadcrumbs={breadcrumbs}
            reviewStats={reviewStats}
          />
        </div>

        {/* Reviews Section */}
        <section className="mt-20">
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
