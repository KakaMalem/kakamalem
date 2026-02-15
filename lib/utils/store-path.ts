import { headers } from "next/headers";

/**
 * Get the base path for store URLs in server components.
 * On custom domains, returns "" (clean paths like /products).
 * On main domain, returns "/store/{slug}" (prefixed paths).
 */
export async function getStoreBasePath(storeSlug: string): Promise<string> {
  const headersList = await headers();
  const customDomain = headersList.get("x-custom-domain");
  return customDomain ? "" : `/store/${storeSlug}`;
}

/**
 * Get the full base URL for a store (for canonical/OG meta tags).
 * On custom domains, returns "https://customdomain.com".
 * On main domain, returns "https://kakamalem.com/store/{slug}".
 */
export async function getStoreBaseUrl(storeSlug: string): Promise<string> {
  const headersList = await headers();
  const customDomain = headersList.get("x-custom-domain");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  return customDomain
    ? `https://${customDomain}`
    : `${appUrl}/store/${storeSlug}`;
}
