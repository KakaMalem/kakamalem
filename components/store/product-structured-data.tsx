import type { ProductReviewStats } from "@/lib/db/queries/reviews";

interface ProductStructuredDataProps {
  product: {
    name: string;
    description?: string | null;
    price: string;
    compareAtPrice?: string | null;
    sku?: string | null;
    images?: Array<{ media?: { url?: string | null } | null }>;
    category?: { name: string } | null;
  };
  storeName: string;
  storeSlug: string;
  productSlug: string;
  currency: string;
  reviewStats: ProductReviewStats;
}

/**
 * Generates Schema.org Product structured data with AggregateRating
 * This enables Google rich snippets with star ratings in search results
 */
export function ProductStructuredData({
  product,
  storeName,
  storeSlug,
  productSlug,
  currency,
  reviewStats,
}: ProductStructuredDataProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const productUrl = `${appUrl}/store/${storeSlug}/product/${encodeURIComponent(productSlug)}`;
  const primaryImage = product.images?.[0]?.media?.url;
  const imageUrl = primaryImage ? `${appUrl}${primaryImage}` : undefined;

  // Build the structured data object
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: storeName,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: currency,
      price: product.price,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: storeName,
      },
    },
  };

  // Add description if available
  if (product.description) {
    structuredData.description = product.description
      .replace(/<[^>]*>/g, "") // Strip HTML
      .slice(0, 5000); // Limit length
  }

  // Add image if available
  if (imageUrl) {
    structuredData.image = imageUrl;
  }

  // Add SKU if available
  if (product.sku) {
    structuredData.sku = product.sku;
  }

  // Add category if available
  if (product.category?.name) {
    structuredData.category = product.category.name;
  }

  // Add aggregate rating if there are reviews
  if (reviewStats.totalReviews > 0 && reviewStats.averageRating) {
    structuredData.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviewStats.averageRating.toFixed(1),
      reviewCount: reviewStats.totalReviews,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}
