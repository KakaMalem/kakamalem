/**
 * Domain Types
 *
 * Type definitions for the custom domain system.
 * SSL provisioning is handled by Dokploy + Traefik + Let's Encrypt — the
 * app registers verified hostnames with Dokploy via its API; Traefik
 * issues a cert on first request.
 */

import type { DomainDnsRecords } from "@/lib/db/schema";

// =============================================================================
// STATUS TYPES
// =============================================================================

/**
 * Domain configuration status.
 *
 * Flow: pending → dns_verification → ssl_provisioning → active
 *                                          ↓
 *                                        error
 *
 * Keep in sync with `domainStatusEnum` in lib/db/schema.ts.
 */
export type DomainStatus =
  | "pending" // Domain added, awaiting DNS configuration
  | "dns_verification" // Checking DNS records
  | "ssl_provisioning" // DNS verified, registering with upstream proxy
  | "active" // Fully configured and serving
  | "error" // Configuration error (see domainError field)
  | "suspended"; // Manually suspended by admin

/**
 * SSL certificate status. Mirrors `sslStatusEnum` in lib/db/schema.ts.
 * With Dokploy/Traefik most domains transition pending → active quickly;
 * the intermediate states are kept for observability / future providers.
 */
export type SslStatus =
  | "pending"
  | "initializing"
  | "pending_validation"
  | "pending_issuance"
  | "pending_deployment"
  | "active"
  | "expiring_soon"
  | "expired"
  | "error";

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
    code?:
      | "dns_not_configured"
      | "unauthorized"
      | "provisioning_failed"
      | "unknown";
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
  /** Label for the retry button — depends on which phase failed. */
  retryLabel: string;
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
        retryLabel: "Re-check",
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
        retryLabel: "Check DNS",
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
        retryLabel: "Check DNS",
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
        retryLabel: "Retry",
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
        retryLabel: "Re-check",
      };
    case "ssl_provisioning":
      return {
        status,
        sslStatus,
        label: "Provisioning SSL",
        description:
          "DNS verified — issuing a Let's Encrypt certificate. This usually takes under a minute.",
        color: "yellow",
        icon: "clock",
        showDnsInstructions: false,
        canDisconnect: true,
        canRetry: true,
        retryLabel: "Retry provisioning",
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
        retryLabel: "Re-check",
      };
  }
}

/**
 * Get human-readable SSL status
 */
export function getSslStatusLabel(status: SslStatus): string {
  const labels: Record<SslStatus, string> = {
    pending: "Pending",
    initializing: "Initializing",
    pending_validation: "Validating domain ownership",
    pending_issuance: "Issuing certificate",
    pending_deployment: "Deploying certificate",
    active: "Active (Let's Encrypt)",
    expiring_soon: "Expiring soon",
    expired: "Expired",
    error: "Error",
  };
  return labels[status] || "Unknown";
}
