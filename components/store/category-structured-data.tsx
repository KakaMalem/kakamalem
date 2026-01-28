interface CategoryProduct {
  slug: string;
  name: string;
}

interface CategoryStructuredDataProps {
  categoryName: string;
  categoryDescription?: string | null;
  storeSlug: string;
  products: CategoryProduct[];
}

/**
 * Generates Schema.org ItemList structured data for category/collection pages
 * This helps Google understand category pages and can enable rich carousel results
 *
 * @see https://schema.org/ItemList
 * @see https://developers.google.com/search/docs/appearance/structured-data/carousel
 */
export function CategoryStructuredData({
  categoryName,
  categoryDescription,
  storeSlug,
  products,
}: CategoryStructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const storeUrl = `${baseUrl}/store/${storeSlug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: categoryName,
    ...(categoryDescription && { description: categoryDescription }),
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${storeUrl}/product/${encodeURIComponent(product.slug)}`,
      name: product.name,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * Generates Schema.org CollectionPage structured data
 * Provides additional context about the category page
 *
 * @see https://schema.org/CollectionPage
 */
export function CollectionPageStructuredData({
  categoryName,
  categoryDescription,
  categoryUrl,
  storeName,
  imageUrl,
}: {
  categoryName: string;
  categoryDescription?: string | null;
  categoryUrl: string;
  storeName: string;
  imageUrl?: string | null;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categoryName,
    ...(categoryDescription && { description: categoryDescription }),
    url: categoryUrl.startsWith("http")
      ? categoryUrl
      : `${baseUrl}${categoryUrl}`,
    isPartOf: {
      "@type": "WebSite",
      name: storeName,
    },
    ...(imageUrl && {
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
