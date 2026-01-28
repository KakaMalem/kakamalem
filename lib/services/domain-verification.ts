/**
 * Domain Verification Service
 *
 * Handles DNS verification for custom domains using Google's DNS-over-HTTPS API.
 * Verifies CNAME records point to proxy.kakamalem.com and TXT records contain
 * the verification token.
 */

import { randomBytes } from "crypto";
import type {
  DnsVerificationResult,
  DnsVerificationError,
  DomainHealthResult,
  DnsInstructions,
  DnsRecord,
} from "@/lib/types/domains";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * The target that CNAME records should point to
 */
export const PROXY_TARGET =
  process.env.DOMAIN_PROXY_TARGET || "proxy.kakamalem.com";

/**
 * TXT record prefix for verification
 */
export const TXT_VERIFICATION_PREFIX = "_kakamalem-verify";

/**
 * Token prefix for verification values
 */
export const TOKEN_PREFIX = "km_";

/**
 * Google DNS-over-HTTPS endpoint
 */
const DNS_API = "https://dns.google/resolve";

// =============================================================================
// DNS LOOKUP
// =============================================================================

interface DnsApiResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: Array<{ name: string; type: number }>;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
  Authority?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

/**
 * DNS record type numbers
 */
const DNS_TYPES = {
  A: 1,
  CNAME: 5,
  TXT: 16,
  AAAA: 28,
};

/**
 * Query DNS records using Google DNS-over-HTTPS
 */
async function queryDns(
  domain: string,
  type: keyof typeof DNS_TYPES
): Promise<string[]> {
  try {
    const url = new URL(DNS_API);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", type);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/dns-json" },
      // Cache DNS responses for 30 seconds
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.error(
        `[DNS] Query failed for ${domain} ${type}:`,
        response.status
      );
      return [];
    }

    const data = (await response.json()) as DnsApiResponse;

    // Status 0 = NOERROR (success)
    if (data.Status !== 0) {
      return [];
    }

    // Extract answers of the requested type
    const typeNum = DNS_TYPES[type];
    const answers =
      data.Answer?.filter((a) => a.type === typeNum).map((a) => a.data) || [];

    // Clean up TXT records (remove quotes)
    if (type === "TXT") {
      return answers.map((txt) => txt.replace(/^"|"$/g, ""));
    }

    // Clean up CNAME/A records (remove trailing dot)
    return answers.map((record) => record.replace(/\.$/, ""));
  } catch (error) {
    console.error(`[DNS] Query error for ${domain} ${type}:`, error);
    return [];
  }
}

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Generate a unique verification token
 */
export function generateVerificationToken(): string {
  // Generate a 24-character random string (18 bytes = 24 base64url chars)
  return `${TOKEN_PREFIX}${randomBytes(18).toString("base64url")}`;
}

/**
 * Get the TXT record name for verification
 */
export function getTxtRecordName(domain: string): string {
  return `${TXT_VERIFICATION_PREFIX}.${domain}`;
}

/**
 * Get the expected TXT record value
 */
export function getTxtRecordValue(token: string): string {
  return `verify=${token}`;
}

/**
 * Check if a domain is an apex domain (no subdomain)
 */
export function isApexDomain(domain: string): boolean {
  const parts = domain.split(".");
  // Apex domains have exactly 2 parts (e.g., "example.com")
  // This is a simplification - doesn't handle all TLDs correctly
  return parts.length === 2;
}

/**
 * Generate DNS instructions for a domain
 */
export function generateDnsInstructions(
  domain: string,
  verificationToken: string
): DnsInstructions {
  const isApex = isApexDomain(domain);
  const records: DnsRecord[] = [];

  // CNAME record for routing traffic
  if (isApex) {
    // For apex domains, some registrars support CNAME flattening
    // Others may need A record
    records.push({
      type: "CNAME",
      name: "@",
      value: PROXY_TARGET,
      purpose: "routing",
      required: true,
    });
  } else {
    // Extract subdomain
    const parts = domain.split(".");
    const subdomain = parts[0];
    records.push({
      type: "CNAME",
      name: subdomain,
      value: PROXY_TARGET,
      purpose: "routing",
      required: true,
    });
  }

  // TXT record for verification
  const txtName = isApex
    ? TXT_VERIFICATION_PREFIX
    : `${TXT_VERIFICATION_PREFIX}.${domain.split(".")[0]}`;

  records.push({
    type: "TXT",
    name: txtName,
    value: getTxtRecordValue(verificationToken),
    purpose: "verification",
    required: true,
  });

  return {
    domain,
    isApexDomain: isApex,
    records,
    verificationToken,
    proxyTarget: PROXY_TARGET,
  };
}

/**
 * Verify DNS configuration for a domain
 */
export async function verifyDomainDns(
  domain: string,
  expectedToken: string
): Promise<DnsVerificationResult> {
  const errors: DnsVerificationError[] = [];
  let cnameVerified = false;
  let txtVerified = false;

  // Check CNAME record
  const cnameRecords = await queryDns(domain, "CNAME");
  if (cnameRecords.length === 0) {
    // If no CNAME, check for A record (some setups use A records for apex)
    const aRecords = await queryDns(domain, "A");
    if (aRecords.length === 0) {
      errors.push({
        type: "cname_missing",
        message: `No CNAME or A record found for ${domain}`,
        expected: PROXY_TARGET,
      });
    } else {
      // A record exists - this is acceptable for apex domains
      // We'll assume it's correctly configured
      cnameVerified = true;
    }
  } else {
    // Verify CNAME points to our proxy
    const target = cnameRecords[0].toLowerCase();
    if (target === PROXY_TARGET.toLowerCase()) {
      cnameVerified = true;
    } else {
      errors.push({
        type: "cname_wrong_target",
        message: `CNAME record points to wrong target`,
        expected: PROXY_TARGET,
        actual: target,
      });
    }
  }

  // Check TXT verification record
  const txtRecordName = getTxtRecordName(domain);
  const txtRecords = await queryDns(txtRecordName, "TXT");
  const expectedValue = getTxtRecordValue(expectedToken);

  if (txtRecords.length === 0) {
    errors.push({
      type: "txt_missing",
      message: `No TXT record found at ${txtRecordName}`,
      expected: expectedValue,
    });
  } else {
    // Check if any TXT record matches our verification
    const matchingRecord = txtRecords.find(
      (txt) => txt.toLowerCase() === expectedValue.toLowerCase()
    );
    if (matchingRecord) {
      txtVerified = true;
    } else {
      errors.push({
        type: "txt_wrong_value",
        message: `TXT record value doesn't match verification token`,
        expected: expectedValue,
        actual: txtRecords[0],
      });
    }
  }

  return {
    verified: cnameVerified && txtVerified,
    cnameVerified,
    txtVerified,
    errors,
    lastCheckedAt: new Date().toISOString(),
  };
}

// =============================================================================
// HEALTH CHECKS
// =============================================================================

/**
 * Check the overall health of a custom domain
 */
export async function checkDomainHealth(
  domain: string
): Promise<DomainHealthResult> {
  const result: DomainHealthResult = {
    domain,
    healthy: false,
    dns: { status: "error" },
    ssl: { status: "error" },
    http: { status: "error" },
    checkedAt: new Date().toISOString(),
  };

  // Check DNS resolution
  try {
    const cnameRecords = await queryDns(domain, "CNAME");
    const aRecords = await queryDns(domain, "A");

    if (cnameRecords.length > 0 || aRecords.length > 0) {
      result.dns = {
        status: "ok",
        resolvedTo: cnameRecords[0] || aRecords[0],
      };
    } else {
      result.dns = {
        status: "error",
        message: "Domain does not resolve",
      };
    }
  } catch (error) {
    result.dns = {
      status: "error",
      message: error instanceof Error ? error.message : "DNS lookup failed",
    };
  }

  // Check HTTPS connectivity and SSL certificate
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch(`https://${domain}/`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });
    const responseTime = Date.now() - startTime;

    clearTimeout(timeoutId);

    result.http = {
      status:
        response.ok || response.status === 301 || response.status === 302
          ? "ok"
          : "error",
      statusCode: response.status,
      responseTimeMs: responseTime,
    };

    // If we got a response, SSL is working
    if (response.ok || response.status === 301 || response.status === 302) {
      result.ssl = { status: "ok" };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        result.http = {
          status: "error",
          statusCode: 0,
        };
      } else if (
        error.message.includes("certificate") ||
        error.message.includes("SSL")
      ) {
        result.ssl = {
          status: "error",
        };
        result.http = { status: "error" };
      } else {
        result.http = { status: "error" };
      }
    }
  }

  // Determine overall health
  result.healthy =
    result.dns.status === "ok" &&
    result.ssl.status === "ok" &&
    result.http.status === "ok";

  return result;
}

/**
 * Quick DNS check without full verification
 */
export async function quickDnsCheck(domain: string): Promise<boolean> {
  const cnameRecords = await queryDns(domain, "CNAME");
  if (cnameRecords.length > 0) {
    return cnameRecords[0].toLowerCase() === PROXY_TARGET.toLowerCase();
  }

  // Check A records as fallback for apex domains
  const aRecords = await queryDns(domain, "A");
  return aRecords.length > 0;
}
