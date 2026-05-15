import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { verifyDomainDns } from "@/lib/services/domain-verification";
import { getDomainProvisioner, ProvisionerError } from "@/lib/domains";

/**
 * Domain Health Cron
 *
 * Two responsibilities:
 *
 *   1. For domains still in `pending` / `dns_verification`, re-check DNS.
 *      If it now resolves, delegate to verifyDomain() so the upstream
 *      proxy gets the registration call exactly the same way the UI
 *      would have triggered it.
 *
 *   2. For domains already `active`, fetch `https://{host}/` and update
 *      sslStatus based on what the TLS handshake returns. This catches
 *      certs that silently failed to provision (the original tuhfaa.com
 *      symptom: UI says active, browser sees ERR_CERT_AUTHORITY_INVALID).
 *
 * Recommended schedule: every 5–10 minutes. Hit /api/cron/domain-health
 * with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[DomainHealth] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DomainHealth] start");

  const results = {
    dns: { checked: 0, activated: 0, errors: 0 },
    https: { checked: 0, healthy: 0, broken: 0, errors: 0 },
    details: [] as Array<{ domain: string; phase: string; outcome: string }>,
  };

  try {
    await Promise.all([checkPendingDns(results), probeActiveCerts(results)]);

    console.log(
      `[DomainHealth] done dns(${results.dns.checked}/${results.dns.activated}) https(${results.https.checked}/${results.https.broken} broken)`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (err) {
    console.error("[DomainHealth] fatal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

type Results = {
  dns: { checked: number; activated: number; errors: number };
  https: { checked: number; healthy: number; broken: number; errors: number };
  details: Array<{ domain: string; phase: string; outcome: string }>;
};

async function checkPendingDns(results: Results): Promise<void> {
  const pending = await db.query.tenants.findMany({
    where: and(
      isNotNull(tenants.customDomain),
      inArray(tenants.customDomainStatus, ["pending", "dns_verification"])
    ),
    columns: {
      id: true,
      slug: true,
      customDomain: true,
      domainVerificationToken: true,
    },
  });

  for (const tenant of pending) {
    if (!tenant.customDomain || !tenant.domainVerificationToken) continue;
    results.dns.checked++;

    try {
      const verification = await verifyDomainDns(
        tenant.customDomain,
        tenant.domainVerificationToken
      );

      if (!verification.verified) {
        await db
          .update(tenants)
          .set({
            customDomainStatus: "dns_verification",
            domainLastCheckedAt: new Date().toISOString(),
            domainError: verification.errors[0]?.message || null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenants.id, tenant.id));
        results.details.push({
          domain: tenant.customDomain,
          phase: "dns",
          outcome: "not_verified",
        });
        continue;
      }

      // DNS resolves — register with the upstream proxy and flip to
      // active. We replicate the verifyDomain() body inline (rather
      // than calling the server action) because the action requires
      // a logged-in user with owner role; this cron path has no
      // session.
      const provisioner = getDomainProvisioner();
      try {
        await provisioner.register(tenant.customDomain);
        const now = new Date().toISOString();
        await db
          .update(tenants)
          .set({
            customDomainStatus: "active",
            domainVerifiedAt: now,
            sslStatus: "active",
            sslProvisionedAt: now,
            domainError: null,
            domainLastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(tenants.id, tenant.id));
        results.dns.activated++;
        results.details.push({
          domain: tenant.customDomain,
          phase: "dns",
          outcome: "activated",
        });
      } catch (err) {
        const message =
          err instanceof ProvisionerError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown provisioner error";
        await db
          .update(tenants)
          .set({
            customDomainStatus: "error",
            sslStatus: "error",
            domainError: message,
            domainLastCheckedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenants.id, tenant.id));
        results.dns.errors++;
        results.details.push({
          domain: tenant.customDomain,
          phase: "dns",
          outcome: message,
        });
      }
    } catch (err) {
      results.dns.errors++;
      results.details.push({
        domain: tenant.customDomain,
        phase: "dns",
        outcome: err instanceof Error ? err.message : "Unknown",
      });
    }
  }
}

async function probeActiveCerts(results: Results): Promise<void> {
  const active = await db.query.tenants.findMany({
    where: and(
      isNotNull(tenants.customDomain),
      eq(tenants.customDomainStatus, "active")
    ),
    columns: { id: true, customDomain: true },
  });

  for (const tenant of active) {
    if (!tenant.customDomain) continue;
    results.https.checked++;

    const probe = await probeHttps(tenant.customDomain);
    const now = new Date().toISOString();

    if (probe.ok) {
      results.https.healthy++;
      // Clear any prior cert error and ensure sslStatus is active.
      await db
        .update(tenants)
        .set({
          sslStatus: "active",
          domainError: null,
          domainLastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(tenants.id, tenant.id));
      results.details.push({
        domain: tenant.customDomain,
        phase: "https",
        outcome: "ok",
      });
    } else {
      results.https.broken++;
      await db
        .update(tenants)
        .set({
          sslStatus: "error",
          domainError: probe.error,
          domainLastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(tenants.id, tenant.id));
      results.details.push({
        domain: tenant.customDomain,
        phase: "https",
        outcome: probe.error,
      });
    }
  }
}

async function probeHttps(
  host: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://${host}/`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    // Any HTTP status means the TLS handshake succeeded — that's what
    // we actually care about. A 5xx from the app is a different
    // problem and not the domain system's job.
    if (res.status > 0) return { ok: true };
    return { ok: false, error: "Empty response" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `TLS/connection error: ${message}` };
  }
}
