"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { hasMinimumRole } from "@/lib/auth/context";
import { customDomainSchema } from "@/lib/validations/domains";
import {
  generateVerificationToken,
  generateDnsInstructions,
  verifyDomainDns,
} from "@/lib/services/domain-verification";
import type {
  ConnectDomainResult,
  VerifyDomainResult,
  DisconnectDomainResult,
  RefreshDomainStatusResult,
  DnsInstructions,
  DomainStatus,
  SslStatus,
} from "@/lib/types/domains";

// =============================================================================
// CONNECT DOMAIN
// =============================================================================

/**
 * Connect a custom domain to a store
 * Creates the verification token and DNS instructions.
 * SSL is handled automatically by Caddy on-demand TLS.
 */
export async function connectDomain(
  storeSlug: string,
  domain: string
): Promise<ConnectDomainResult> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in", code: "unauthorized" },
    };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return {
      success: false,
      error: { message: "Store not found", code: "unauthorized" },
    };
  }

  const canManage = await hasMinimumRole(store.id, "owner");
  if (!canManage) {
    return {
      success: false,
      error: {
        message: "Only the store owner can manage domain settings",
        code: "unauthorized",
      },
    };
  }

  // Validate domain
  try {
    customDomainSchema.parse({ domain });
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        success: false,
        error: {
          message: err.issues[0]?.message || "Invalid domain",
          code: "invalid_domain",
        },
      };
    }
    throw err;
  }

  const normalizedDomain = domain.toLowerCase().trim();

  // Check if domain is already in use by another store
  const existingStore = await db.query.tenants.findFirst({
    where: and(
      eq(tenants.customDomain, normalizedDomain),
      isNotNull(tenants.customDomain)
    ),
    columns: { id: true, slug: true },
  });

  if (existingStore && existingStore.id !== store.id) {
    return {
      success: false,
      error: {
        message: "This domain is already connected to another store",
        code: "domain_taken",
      },
    };
  }

  // Generate verification token
  const verificationToken = generateVerificationToken();

  // Generate DNS instructions
  const dnsInstructions = generateDnsInstructions(
    normalizedDomain,
    verificationToken
  );

  // Update store with domain configuration
  await db
    .update(tenants)
    .set({
      customDomain: normalizedDomain,
      customDomainStatus: "pending",
      domainVerificationToken: verificationToken,
      domainVerifiedAt: null,
      sslStatus: "pending",
      sslProvisionedAt: null,
      cloudflareHostnameId: null,
      domainDnsRecords: {
        cname: {
          name: dnsInstructions.records[0].name,
          target: dnsInstructions.records[0].value,
          verified: false,
        },
        txt: {
          name: dnsInstructions.records[1].name,
          value: dnsInstructions.records[1].value,
          verified: false,
        },
      },
      domainError: null,
      domainLastCheckedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, store.id));

  revalidatePath(`/dashboard/${storeSlug}/settings/domains`);

  return {
    success: true,
    dnsInstructions,
  };
}

// =============================================================================
// VERIFY DOMAIN
// =============================================================================

/**
 * Manually trigger DNS verification for a domain.
 * Once DNS is verified, the domain becomes active immediately.
 * SSL is provisioned automatically by Caddy on the first request.
 */
export async function verifyDomain(
  storeSlug: string
): Promise<VerifyDomainResult> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in", code: "unauthorized" },
    };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return {
      success: false,
      error: { message: "Store not found", code: "unauthorized" },
    };
  }

  const canManage = await hasMinimumRole(store.id, "owner");
  if (!canManage) {
    return {
      success: false,
      error: {
        message: "Only the store owner can verify domain settings",
        code: "unauthorized",
      },
    };
  }

  if (!store.customDomain || !store.domainVerificationToken) {
    return {
      success: false,
      error: {
        message: "No domain configured for this store",
        code: "dns_not_configured",
      },
    };
  }

  // Verify DNS records
  const verification = await verifyDomainDns(
    store.customDomain,
    store.domainVerificationToken
  );

  let status: DomainStatus = store.customDomainStatus as DomainStatus;
  let sslStatus: SslStatus = (store.sslStatus as SslStatus) || "pending";

  // Update DNS records in database
  const dnsRecords = store.domainDnsRecords || {
    cname: { name: "", target: "", verified: false },
    txt: { name: "", value: "", verified: false },
  };

  dnsRecords.cname.verified = verification.cnameVerified;
  if (verification.cnameVerified) {
    dnsRecords.cname.verifiedAt = new Date().toISOString();
  }
  dnsRecords.txt.verified = verification.txtVerified;
  if (verification.txtVerified) {
    dnsRecords.txt.verifiedAt = new Date().toISOString();
  }
  dnsRecords.lastCheck = {
    timestamp: new Date().toISOString(),
    success: verification.verified,
    errors: verification.errors.map((e) => e.message),
  };

  if (verification.verified) {
    // DNS verified - domain is active!
    // Caddy will automatically provision SSL on the first request.
    status = "active";
    sslStatus = "active";

    await db
      .update(tenants)
      .set({
        customDomainStatus: "active",
        domainVerifiedAt: new Date().toISOString(),
        sslStatus: "active",
        sslProvisionedAt: new Date().toISOString(),
        domainDnsRecords: dnsRecords,
        domainError: null,
        domainLastCheckedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, store.id));
  } else {
    // DNS not verified yet
    status = "dns_verification";

    await db
      .update(tenants)
      .set({
        customDomainStatus: status,
        domainDnsRecords: dnsRecords,
        domainError: verification.errors[0]?.message || null,
        domainLastCheckedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, store.id));
  }

  revalidatePath(`/dashboard/${storeSlug}/settings/domains`);

  return {
    success: true,
    status,
    sslStatus,
    verification,
  };
}

// =============================================================================
// DISCONNECT DOMAIN
// =============================================================================

/**
 * Disconnect a custom domain from a store
 */
export async function disconnectDomain(
  storeSlug: string
): Promise<DisconnectDomainResult> {
  const user = await getUser();
  if (!user) {
    return {
      success: false,
      error: { message: "You must be logged in", code: "unauthorized" },
    };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return {
      success: false,
      error: { message: "Store not found", code: "unauthorized" },
    };
  }

  const canManage = await hasMinimumRole(store.id, "owner");
  if (!canManage) {
    return {
      success: false,
      error: {
        message: "Only the store owner can manage domain settings",
        code: "unauthorized",
      },
    };
  }

  // Clear domain configuration
  await db
    .update(tenants)
    .set({
      customDomain: null,
      customDomainStatus: "pending",
      domainVerificationToken: null,
      domainVerifiedAt: null,
      sslStatus: "pending",
      sslProvisionedAt: null,
      cloudflareHostnameId: null,
      domainDnsRecords: null,
      domainError: null,
      domainLastCheckedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, store.id));

  revalidatePath(`/dashboard/${storeSlug}/settings/domains`);

  return { success: true };
}

// =============================================================================
// REFRESH STATUS
// =============================================================================

/**
 * Re-check DNS verification for a domain
 */
export async function refreshDomainStatus(
  storeSlug: string
): Promise<RefreshDomainStatusResult> {
  // This is the same as verifyDomain but with a simpler return type
  const result = await verifyDomain(storeSlug);

  return {
    success: result.success,
    status: result.status,
    sslStatus: result.sslStatus,
    error: result.error ? { message: result.error.message } : undefined,
  };
}

// =============================================================================
// GET DOMAIN CONFIG
// =============================================================================

/**
 * Get domain configuration for a store (read-only, used by UI)
 */
export async function getDomainConfig(storeSlug: string) {
  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return null;
  }

  return {
    customDomain: store.customDomain,
    customDomainStatus: store.customDomainStatus as DomainStatus,
    domainVerificationToken: store.domainVerificationToken,
    domainVerifiedAt: store.domainVerifiedAt,
    sslStatus: (store.sslStatus as SslStatus) || "pending",
    sslProvisionedAt: store.sslProvisionedAt,
    cloudflareHostnameId: store.cloudflareHostnameId,
    domainDnsRecords: store.domainDnsRecords,
    domainError: store.domainError,
    domainLastCheckedAt: store.domainLastCheckedAt,
  };
}

/**
 * Get DNS instructions for a store's configured domain
 */
export async function getDnsInstructions(
  storeSlug: string
): Promise<DnsInstructions | null> {
  const store = await getTenantBySlug(storeSlug);
  if (!store || !store.customDomain || !store.domainVerificationToken) {
    return null;
  }

  return generateDnsInstructions(
    store.customDomain,
    store.domainVerificationToken
  );
}
