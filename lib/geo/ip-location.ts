/**
 * Locating a buyer by IP address, as a fallback.
 *
 * The edge already tells us the country for free: Cloudflare sends
 * `cf-ipcountry` on every request, and `getGeoFromHeaders()` reads it. This
 * module exists only for deployments where that header is absent, for example
 * behind a plain reverse proxy with no geo layer, so the "where do our
 * customers order from" map does not silently record nothing.
 *
 * It is therefore a best-effort, never-blocking path: one short request to a
 * free, keyless service, and a null on any failure at all.
 */

const LOOKUP_TIMEOUT_MS = 3000;

export type IpLocation = {
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  city: string | null;
  region: string | null;
};

/**
 * Addresses that can never be located: loopback, link-local, and the private
 * ranges a reverse proxy hands us when it is not forwarding the real client.
 */
export function isPrivateOrUnknownIp(ip: string | null | undefined): boolean {
  if (!ip || ip === "unknown") return true;

  const address = ip.trim().toLowerCase();
  if (!address) return true;

  // IPv6 loopback and unique-local / link-local ranges
  if (address === "::1") return true;
  if (address.startsWith("fc") || address.startsWith("fd")) return true;
  if (address.startsWith("fe80:")) return true;

  const octets = address.split(".");
  if (octets.length !== 4) {
    // Not IPv4. Public IPv6 is fine to look up.
    return false;
  }

  const [a, b] = octets.map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;

  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;

  return false;
}

type IpWhoIsResponse = {
  success?: boolean;
  country_code?: string;
  city?: string;
  region?: string;
};

/**
 * Look up the rough location of an IP address. Returns null when the address
 * cannot be located or the service does not answer promptly.
 */
export async function lookupIpLocation(
  ip: string | null | undefined
): Promise<IpLocation | null> {
  if (isPrivateOrUnknownIp(ip)) return null;

  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip as string)}?fields=success,country_code,city,region`,
      {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as IpWhoIsResponse;
    if (data.success === false || !data.country_code) return null;

    return {
      country: data.country_code.toUpperCase().slice(0, 2),
      city: data.city?.slice(0, 100) || null,
      region: data.region?.slice(0, 100) || null,
    };
  } catch {
    // Timeout, DNS failure, rate limit, malformed body: all mean "unknown".
    return null;
  }
}
