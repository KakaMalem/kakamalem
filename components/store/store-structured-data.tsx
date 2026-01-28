import type { SocialLinks } from "@/lib/db/schema";

interface StoreStructuredDataProps {
  store: {
    name: string;
    slug: string;
    tagline?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    socialLinks?: SocialLinks | null;
    currency: string;
  };
}

/**
 * Generates Schema.org Organization/Store structured data
 * This helps Google understand the business and enables rich snippets
 *
 * Features:
 * - Organization type with name, logo, contact
 * - Social media profiles (sameAs)
 * - Contact point for customer service
 *
 * @see https://schema.org/Organization
 * @see https://developers.google.com/search/docs/appearance/structured-data/organization
 */
export function StoreStructuredData({ store }: StoreStructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const storeUrl = `${baseUrl}/store/${store.slug}`;

  // Collect social media URLs for sameAs property
  const sameAs: string[] = [];
  if (store.socialLinks?.facebook) sameAs.push(store.socialLinks.facebook);
  if (store.socialLinks?.instagram) sameAs.push(store.socialLinks.instagram);
  if (store.socialLinks?.twitter) sameAs.push(store.socialLinks.twitter);
  if (store.socialLinks?.youtube) sameAs.push(store.socialLinks.youtube);
  if (store.socialLinks?.tiktok) sameAs.push(store.socialLinks.tiktok);
  if (store.socialLinks?.telegram) {
    // Telegram links should be https://t.me/username
    const telegram = store.socialLinks.telegram;
    if (telegram.startsWith("http")) {
      sameAs.push(telegram);
    } else {
      sameAs.push(`https://t.me/${telegram.replace("@", "")}`);
    }
  }

  // Make logo URL absolute
  const logoUrl = store.logoUrl
    ? store.logoUrl.startsWith("http")
      ? store.logoUrl
      : `${baseUrl}${store.logoUrl}`
    : undefined;

  // Build the structured data object
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${storeUrl}#organization`,
    name: store.name,
    url: storeUrl,
    ...(store.description && { description: store.description }),
    ...(store.tagline && { slogan: store.tagline }),
    ...(logoUrl && {
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
      },
      image: logoUrl,
    }),
    ...(sameAs.length > 0 && { sameAs }),
  };

  // Add contact point if phone or email is available
  if (store.contactPhone || store.contactEmail) {
    structuredData.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer service",
      ...(store.contactPhone && { telephone: store.contactPhone }),
      ...(store.contactEmail && { email: store.contactEmail }),
      availableLanguage: ["en", "fa", "ps"], // English, Dari, Pashto
    };
  }

  // Add potential action for search
  structuredData.potentialAction = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${storeUrl}/products?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * WebSite structured data for sitelinks searchbox
 * Enables the search box directly in Google search results
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export function WebsiteStructuredData({
  storeName,
  storeSlug,
}: {
  storeName: string;
  storeSlug: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const storeUrl = `${baseUrl}/store/${storeSlug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${storeUrl}#website`,
    name: storeName,
    url: storeUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${storeUrl}/products?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@id": `${storeUrl}#organization`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
