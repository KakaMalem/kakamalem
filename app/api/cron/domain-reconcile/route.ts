import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getDomainProvisioner, ProvisionerError } from "@/lib/domains";

/**
 * Domain Reconcile Cron
 *
 * Diffs the set of `active` custom domains in our DB against the set the
 * upstream proxy (Dokploy) knows about, and corrects drift in both
 * directions:
 *
 *   - In DB but not in upstream → re-register (likely a failed
 *     verifyDomain() call, or upstream forgot during a restore).
 *   - In upstream but not in DB → log as an orphan. We never delete
 *     orphans automatically — admins remove them manually from Dokploy
 *     after confirming they're not for an active deploy.
 *
 * Schedule: once per day is plenty. The hot path (verifyDomain /
 * disconnectDomain) does the right thing on its own; this is just the
 * safety net for partial failures.
 *
 * Security: Bearer {CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provisioner = getDomainProvisioner();
  console.log(`[DomainReconcile] start (provisioner=${provisioner.name})`);

  const summary = {
    provisioner: provisioner.name,
    activeInDb: 0,
    registeredUpstream: 0,
    reRegistered: 0,
    reRegisterFailed: 0,
    orphansInUpstream: [] as string[],
    errors: [] as string[],
  };

  try {
    // Domains in our DB that should be live.
    const dbDomains = await db.query.tenants.findMany({
      where: and(
        isNotNull(tenants.customDomain),
        eq(tenants.customDomainStatus, "active")
      ),
      columns: { id: true, customDomain: true },
    });
    summary.activeInDb = dbDomains.length;

    // Domains the upstream knows about.
    let upstreamHosts: string[] = [];
    try {
      upstreamHosts = await provisioner.listRegisteredHosts();
    } catch (err) {
      const message =
        err instanceof ProvisionerError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to list upstream domains";
      summary.errors.push(`listRegisteredHosts: ${message}`);
      return NextResponse.json({ success: false, ...summary }, { status: 502 });
    }
    summary.registeredUpstream = upstreamHosts.length;

    const upstreamSet = new Set(upstreamHosts.map((h) => h.toLowerCase()));
    const dbSet = new Set(
      dbDomains
        .map((d) => d.customDomain?.toLowerCase())
        .filter((d): d is string => Boolean(d))
    );

    // Direction 1: in DB, missing upstream → re-register.
    for (const row of dbDomains) {
      const host = row.customDomain;
      if (!host) continue;
      if (upstreamSet.has(host.toLowerCase())) continue;

      try {
        await provisioner.register(host);
        summary.reRegistered++;
        await db
          .update(tenants)
          .set({
            domainError: null,
            domainLastCheckedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenants.id, row.id));
      } catch (err) {
        summary.reRegisterFailed++;
        const message =
          err instanceof ProvisionerError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        summary.errors.push(`${host}: ${message}`);
        await db
          .update(tenants)
          .set({
            customDomainStatus: "error",
            sslStatus: "error",
            domainError: `Reconcile failed: ${message}`,
            domainLastCheckedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenants.id, row.id));
      }
    }

    // Direction 2: in upstream, not in DB → orphan. Log only.
    for (const host of upstreamHosts) {
      if (!dbSet.has(host.toLowerCase())) {
        summary.orphansInUpstream.push(host);
      }
    }

    console.log(
      `[DomainReconcile] done: db=${summary.activeInDb} upstream=${summary.registeredUpstream} fixed=${summary.reRegistered} failed=${summary.reRegisterFailed} orphans=${summary.orphansInUpstream.length}`
    );

    return NextResponse.json({
      success: summary.reRegisterFailed === 0,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (err) {
    console.error("[DomainReconcile] fatal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
        ...summary,
      },
      { status: 500 }
    );
  }
}
