interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

interface BreadcrumbStructuredDataProps {
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Generates Schema.org BreadcrumbList structured data
 * Enables breadcrumb trail in Google search results
 *
 * Google shows breadcrumbs in search results like:
 * Store Name > Category > Product Name
 *
 * @see https://schema.org/BreadcrumbList
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export function BreadcrumbStructuredData({
  breadcrumbs,
}: BreadcrumbStructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  // Convert breadcrumbs to Schema.org format
  const itemListElement = breadcrumbs.map((crumb, index) => {
    // Make URL absolute if it's relative
    const absoluteUrl = crumb.href.startsWith("http")
      ? crumb.href
      : `${baseUrl}${crumb.href}`;

    const item: Record<string, unknown> = {
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
    };

    // Don't include 'item' for the current/last breadcrumb
    // Google prefers no URL for the current page
    if (!crumb.current && crumb.href !== "#") {
      item.item = absoluteUrl;
    }

    return item;
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
