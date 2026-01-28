import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { verifyDomainDns } from "@/lib/services/domain-verification";

/**
 * Domain Health Check Cron Job
 *
 * This endpoint should be called periodically (e.g., every 5 minutes) by an external
 * cron service (GitHub Actions, systemd timer, etc.) to:
 *
 * 1. Check pending/dns_verification domains for DNS configuration
 * 2. Auto-activate domains once DNS is verified (Caddy handles SSL automatically)
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[DomainCron] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DomainCron] Starting domain health check...");

  const results = {
    checked: 0,
    updated: 0,
    errors: 0,
    details: [] as Array<{ domain: string; status: string; action: string }>,
  };

  try {
    // Get domains needing verification (pending, dns_verification)
    const pendingDomains = await db.query.tenants.findMany({
      where: and(
        isNotNull(tenants.customDomain),
        inArray(tenants.customDomainStatus, ["pending", "dns_verification"])
      ),
      columns: {
        id: true,
        slug: true,
        customDomain: true,
        customDomainStatus: true,
        domainVerificationToken: true,
      },
    });

    console.log(`[DomainCron] Found ${pendingDomains.length} pending domains`);

    // Check each pending domain
    for (const tenant of pendingDomains) {
      if (!tenant.customDomain || !tenant.domainVerificationToken) continue;

      results.checked++;

      try {
        // Verify DNS configuration
        const verification = await verifyDomainDns(
          tenant.customDomain,
          tenant.domainVerificationToken
        );

        if (verification.verified) {
          // DNS verified — domain is active!
          // Caddy will automatically provision SSL on the first request.
          await db
            .update(tenants)
            .set({
              customDomainStatus: "active",
              domainVerifiedAt: new Date().toISOString(),
              sslStatus: "active",
              sslProvisionedAt: new Date().toISOString(),
              domainLastCheckedAt: new Date().toISOString(),
              domainError: null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(tenants.id, tenant.id));

          results.updated++;
          results.details.push({
            domain: tenant.customDomain,
            status: "active",
            action: "DNS verified, domain activated",
          });
        } else {
          // DNS not verified yet — update last checked time
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
            status: "dns_verification",
            action: "DNS not yet verified",
          });
        }
      } catch (error) {
        console.error(
          `[DomainCron] Error checking domain ${tenant.customDomain}:`,
          error
        );
        results.errors++;
        results.details.push({
          domain: tenant.customDomain,
          status: "error",
          action: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        });
      }
    }

    console.log(
      `[DomainCron] Complete: ${results.checked} checked, ${results.updated} updated, ${results.errors} errors`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("[DomainCron] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
