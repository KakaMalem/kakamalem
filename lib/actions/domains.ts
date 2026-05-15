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
import { getDomainProvisioner, ProvisionerError } from "@/lib/domains";
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
 * Connect a custom domain to a store. Creates the verification token and
 * DNS instructions the buyer must add at their registrar. The domain isn't
 * registered with the upstream proxy (Dokploy/Traefik) yet — that happens
 * in {@link verifyDomain} once the DNS records are confirmed.
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

  // Pro plan required
  if (store.subscriptionPlan !== "pro") {
    return {
      success: false,
      error: {
        message:
          "Custom domains are available on the Pro plan. Upgrade to use this feature.",
        code: "pro_required",
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
 * Manually trigger DNS verification for a domain. Once DNS is verified,
 * the domain is registered with the upstream proxy (Dokploy/Traefik) and
 * an SSL cert is provisioned via Let's Encrypt. The domain is only
 * marked `active` after both DNS and provisioning succeed.
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
    // DNS is good. Move into ssl_provisioning, ask the upstream proxy
    // (Dokploy) to register the hostname so Traefik will issue a cert,
    // then mark active once registration succeeds. We persist the
    // intermediate state first so a UI that re-fetches between the DNS
    // success and the registration call sees the in-progress status.
    status = "ssl_provisioning";
    sslStatus = "pending_issuance";
    const now = new Date().toISOString();
    await db
      .update(tenants)
      .set({
        customDomainStatus: status,
        domainVerifiedAt: now,
        sslStatus,
        domainDnsRecords: dnsRecords,
        domainError: null,
        domainLastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(tenants.id, store.id));

    const provisioner = getDomainProvisioner();
    try {
      await provisioner.register(store.customDomain);
    } catch (err) {
      const message =
        err instanceof ProvisionerError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to register domain with upstream proxy";
      console.error(
        `[verifyDomain] provisioner (${provisioner.name}) failed for ${store.customDomain}:`,
        err
      );

      status = "error";
      sslStatus = "error";
      await db
        .update(tenants)
        .set({
          customDomainStatus: status,
          sslStatus,
          domainError: message,
          domainLastCheckedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tenants.id, store.id));

      revalidatePath(`/dashboard/${storeSlug}/settings/domains`);
      return {
        success: false,
        status,
        sslStatus,
        verification,
        error: { message, code: "provisioning_failed" },
      };
    }

    // Registration succeeded. Traefik may take a few seconds to actually
    // serve a valid cert — the domain-health cron probes HTTPS and
    // downgrades sslStatus if the cert turns out to be invalid.
    status = "active";
    sslStatus = "active";
    const activatedAt = new Date().toISOString();
    await db
      .update(tenants)
      .set({
        customDomainStatus: status,
        sslStatus,
        sslProvisionedAt: activatedAt,
        domainError: null,
        domainLastCheckedAt: activatedAt,
        updatedAt: activatedAt,
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

  // Best-effort: tell the upstream proxy to forget about this domain so
  // its cert/route are torn down. Failures here are logged but don't
  // block the DB cleanup — leaving stale entries in our DB is worse
  // than leaving stale entries in Dokploy (the reconcile cron catches
  // those).
  if (store.customDomain) {
    const provisioner = getDomainProvisioner();
    try {
      await provisioner.unregister(store.customDomain);
    } catch (err) {
      console.error(
        `[disconnectDomain] provisioner (${provisioner.name}) failed to unregister ${store.customDomain}:`,
        err
      );
    }
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
