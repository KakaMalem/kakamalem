/**
 * Domain Types
 *
 * Type definitions for the custom domain system.
 * SSL provisioning is handled automatically by Caddy + Let's Encrypt.
 */

import type { DomainDnsRecords } from "@/lib/db/schema";

// =============================================================================
// STATUS TYPES
// =============================================================================

/**
 * Domain configuration status
 *
 * Flow: pending → dns_verification → active
 *                      ↓
 *                    error
 */
export type DomainStatus =
  | "pending" // Domain added, awaiting DNS configuration
  | "dns_verification" // Checking DNS records
  | "active" // DNS verified, SSL handled by Caddy automatically
  | "error" // Configuration error (see domainError field)
  | "suspended"; // Manually suspended by admin

/**
 * SSL certificate status
 * With Caddy on-demand TLS, this is mostly "active" once DNS is verified.
 * Caddy handles provisioning transparently.
 */
export type SslStatus =
  | "pending" // Not yet provisioned (DNS not verified)
  | "active" // Caddy has a valid certificate
  | "error"; // Provisioning failed (rare with Caddy)

// =============================================================================
// DOMAIN CONFIGURATION
// =============================================================================

/**
 * Domain configuration stored in tenant record
 */
export interface DomainConfig {
  customDomain: string | null;
  customDomainStatus: DomainStatus;
  domainVerificationToken: string | null;
  domainVerifiedAt: string | null;
  sslStatus: SslStatus;
  sslProvisionedAt: string | null;
  cloudflareHostnameId: string | null;
  domainDnsRecords: DomainDnsRecords | null;
  domainError: string | null;
  domainLastCheckedAt: string | null;
}

/**
 * DNS instructions for store owner to configure
 */
export interface DnsInstructions {
  domain: string;
  isApexDomain: boolean;
  records: DnsRecord[];
  verificationToken: string;
  proxyTarget: string;
}

/**
 * Individual DNS record instruction
 */
export interface DnsRecord {
  type: "CNAME" | "TXT" | "A";
  name: string;
  value: string;
  priority?: number;
  purpose: "routing" | "verification";
  required: boolean;
}

// =============================================================================
// VERIFICATION RESULTS
// =============================================================================

/**
 * Result of DNS verification check
 */
export interface DnsVerificationResult {
  verified: boolean;
  cnameVerified: boolean;
  txtVerified: boolean;
  aRecordVerified?: boolean;
  errors: DnsVerificationError[];
  lastCheckedAt: string;
}

/**
 * DNS verification error detail
 */
export interface DnsVerificationError {
  type:
    | "cname_missing"
    | "cname_wrong_target"
    | "txt_missing"
    | "txt_wrong_value"
    | "a_missing"
    | "dns_timeout"
    | "unknown";
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Domain health check result
 */
export interface DomainHealthResult {
  domain: string;
  healthy: boolean;
  dns: {
    status: "ok" | "error";
    message?: string;
    resolvedTo?: string;
  };
  ssl: {
    status: "ok" | "warning" | "error";
    expiresAt?: string;
    issuer?: string;
  };
  http: {
    status: "ok" | "error";
    statusCode?: number;
    responseTimeMs?: number;
  };
  checkedAt: string;
}

// =============================================================================
// ACTION RESULTS
// =============================================================================

/**
 * Result of connectDomain action
 */
export interface ConnectDomainResult {
  success: boolean;
  dnsInstructions?: DnsInstructions;
  error?: {
    message: string;
    code?:
      | "domain_taken"
      | "invalid_domain"
      | "unauthorized"
      | "pro_required"
      | "unknown";
  };
}

/**
 * Result of verifyDomain action
 */
export interface VerifyDomainResult {
  success: boolean;
  status?: DomainStatus;
  sslStatus?: SslStatus;
  verification?: DnsVerificationResult;
  error?: {
    message: string;
    code?: "dns_not_configured" | "unauthorized" | "unknown";
  };
}

/**
 * Result of disconnectDomain action
 */
export interface DisconnectDomainResult {
  success: boolean;
  error?: {
    message: string;
    code?: "unauthorized" | "unknown";
  };
}

/**
 * Result of refreshDomainStatus action
 */
export interface RefreshDomainStatusResult {
  success: boolean;
  status?: DomainStatus;
  sslStatus?: SslStatus;
  health?: DomainHealthResult;
  error?: {
    message: string;
  };
}

// =============================================================================
// UI TYPES
// =============================================================================

/**
 * Domain status for UI display
 */
export interface DomainStatusDisplay {
  status: DomainStatus;
  sslStatus: SslStatus;
  label: string;
  description: string;
  color: "green" | "yellow" | "red" | "gray";
  icon: "check" | "clock" | "alert" | "x";
  showDnsInstructions: boolean;
  canDisconnect: boolean;
  canRetry: boolean;
}

/**
 * Get display info for domain status
 */
export function getDomainStatusDisplay(
  status: DomainStatus,
  sslStatus: SslStatus
): DomainStatusDisplay {
  switch (status) {
    case "active":
      return {
        status,
        sslStatus,
        label: "Active",
        description: "Your custom domain is active and working",
        color: "green",
        icon: "check",
        showDnsInstructions: false,
        canDisconnect: true,
        canRetry: false,
      };
    case "dns_verification":
      return {
        status,
        sslStatus,
        label: "Verifying DNS",
        description: "Checking your DNS configuration...",
        color: "yellow",
        icon: "clock",
        showDnsInstructions: true,
        canDisconnect: true,
        canRetry: true,
      };
    case "pending":
      return {
        status,
        sslStatus,
        label: "Pending Setup",
        description: "Configure your DNS records to activate",
        color: "yellow",
        icon: "clock",
        showDnsInstructions: true,
        canDisconnect: true,
        canRetry: true,
      };
    case "error":
      return {
        status,
        sslStatus,
        label: "Configuration Error",
        description: "There was an error configuring your domain",
        color: "red",
        icon: "alert",
        showDnsInstructions: true,
        canDisconnect: true,
        canRetry: true,
      };
    case "suspended":
      return {
        status,
        sslStatus,
        label: "Suspended",
        description: "This domain has been suspended",
        color: "gray",
        icon: "x",
        showDnsInstructions: false,
        canDisconnect: true,
        canRetry: false,
      };
    default:
      return {
        status,
        sslStatus,
        label: "Unknown",
        description: "Unknown status",
        color: "gray",
        icon: "alert",
        showDnsInstructions: false,
        canDisconnect: true,
        canRetry: true,
      };
  }
}

/**
 * Get human-readable SSL status
 */
export function getSslStatusLabel(status: SslStatus): string {
  const labels: Record<SslStatus, string> = {
    pending: "Pending (auto-provisioned on first visit)",
    active: "Active (Let's Encrypt)",
    error: "Error",
  };
  return labels[status] || "Unknown";
}
