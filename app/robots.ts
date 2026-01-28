import type { MetadataRoute } from "next";

/**
 * Dynamic robots.txt generation for SEO
 * Tells search engines what to crawl and what to skip
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/", // Landing page
          "/store/", // All storefronts
          "/privacy", // Privacy policy
          "/terms", // Terms of service
        ],
        disallow: [
          "/dashboard/", // Store management (private)
          "/admin/", // Platform admin (private)
          "/api/", // API routes (no content)
          "/_next/", // Next.js internals
          "/checkout/", // Checkout flow (dynamic, no SEO value)
          "/cart/", // Cart pages (dynamic, no SEO value)
          "/account/", // User accounts (private)
          "/*?*", // URL parameters (prevent duplicate content)
        ],
      },
      {
        // Specific rules for Googlebot
        userAgent: "Googlebot",
        allow: [
          "/store/",
          "/api/og/", // OG image generation
        ],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/checkout/",
          "/cart/",
          "/account/",
        ],
      },
      {
        // Block aggressive bots
        userAgent: "AhrefsBot",
        disallow: ["/"],
      },
      {
        userAgent: "SemrushBot",
        disallow: ["/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
