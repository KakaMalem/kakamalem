import { z } from "zod";

/**
 * Domain validation regex
 * Matches valid domain names like:
 * - example.com
 * - shop.example.com
 * - my-store.example.co.uk
 */
const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Reserved/blocked domains that cannot be used
 */
const blockedDomains = [
  "kakamalem.com",
  "www.kakamalem.com",
  "api.kakamalem.com",
  "proxy.kakamalem.com",
  "admin.kakamalem.com",
  "dashboard.kakamalem.com",
];

/**
 * Schema for connecting a custom domain
 */
export const customDomainSchema = z.object({
  domain: z
    .string()
    .min(4, "Domain must be at least 4 characters")
    .max(255, "Domain must be less than 255 characters")
    .regex(
      domainRegex,
      "Please enter a valid domain name (e.g., shop.example.com)"
    )
    .transform((d) => d.toLowerCase().trim())
    .refine(
      (d) => !d.endsWith("kakamalem.com"),
      "Cannot use kakamalem.com subdomains as custom domains"
    )
    .refine(
      (d) => !blockedDomains.includes(d),
      "This domain is reserved and cannot be used"
    )
    .refine(
      (d) => !d.startsWith("www.") || d.split(".").length > 2,
      "Please enter the domain without 'www.' prefix, or use the full subdomain"
    ),
});

export type CustomDomainInput = z.infer<typeof customDomainSchema>;

/**
 * Validate a domain string without throwing
 */
export function validateDomain(domain: string): {
  valid: boolean;
  error?: string;
  normalizedDomain?: string;
} {
  const result = customDomainSchema.safeParse({ domain });

  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message || "Invalid domain",
    };
  }

  return {
    valid: true,
    normalizedDomain: result.data.domain,
  };
}

/**
 * Check if a domain is an apex domain (no subdomain)
 */
export function isApexDomain(domain: string): boolean {
  const parts = domain.split(".");
  // Simple heuristic: apex domains have exactly 2 parts (e.g., "example.com")
  // This doesn't handle all TLDs (e.g., .co.uk) but works for most cases
  return parts.length === 2;
}

/**
 * Extract subdomain from a full domain
 * Returns null for apex domains
 */
export function extractSubdomain(domain: string): string | null {
  const parts = domain.split(".");
  if (parts.length <= 2) {
    return null; // Apex domain
  }
  return parts[0];
}
