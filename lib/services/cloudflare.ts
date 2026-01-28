/**
 * Caddy On-Demand TLS Validation
 *
 * Caddy handles SSL certificate provisioning automatically via Let's Encrypt.
 * Our app provides a validation endpoint that Caddy checks before issuing
 * a certificate for a custom domain.
 *
 * How it works:
 * 1. Custom domain request hits Caddy
 * 2. Caddy calls our /api/caddy/ask endpoint with the domain
 * 3. We check if the domain is verified in our database
 * 4. If yes (200), Caddy gets a cert from Let's Encrypt automatically
 * 5. If no (404), Caddy rejects the request
 *
 * @see https://caddyserver.com/docs/automatic-https#on-demand-tls
 */

/**
 * Check if a domain should be approved for TLS certificate provisioning.
 * This is called by the /api/caddy/ask endpoint.
 *
 * Returns true if the domain is configured and DNS-verified in our system.
 */
export async function shouldProvisionCertificate(
  domain: string
): Promise<boolean> {
  // Import here to avoid circular dependencies
  const { getTenantByCustomDomain } = await import("@/lib/db/queries/tenants");

  const tenant = await getTenantByCustomDomain(domain);
  return !!tenant;
}
