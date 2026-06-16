/**
 * Production migration runner — invoked by docker-entrypoint.sh on container
 * start.
 *
 * Applies:
 *   1. Drizzle schema migrations (drizzle/*.sql, gated by drizzle/meta/_journal.json)
 *      — always; this is the `pnpm db:migrate` equivalent.
 *   2. Custom SQL migrations (drizzle/custom/*.sql) — triggers, functions, seeds
 *      — ONLY when RUN_CUSTOM_MIGRATIONS="true". Off by default so a container
 *      boot never re-applies custom SQL that may already exist on the database
 *      but isn't recorded in `custom_migrations`. Keep running these by hand
 *      (`pnpm db:migrate:custom`) until you've confirmed that table, then flip
 *      the flag in Dokploy to automate them too.
 *
 * Design notes:
 * - Self-contained: bundled by esbuild at build time so the slim Next.js
 *   standalone runtime image doesn't need drizzle-kit or the full node_modules.
 * - Idempotent: Drizzle gates by the journal timestamps; custom migrations are
 *   tracked in `custom_migrations`. Safe to run on every boot.
 * - Serialized with a Postgres advisory lock so concurrent container boots
 *   don't migrate at the same time.
 * - Fail-fast: a migration error exits non-zero, so the container won't start
 *   and a broken migration never serves traffic.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Migrations need a DIRECT connection (DDL + transactions), not the pooled
// PgBouncer URL. Prefer the unpooled URL, fall back to DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "[migrate] DATABASE_URL_UNPOOLED (or DATABASE_URL) is required"
  );
  process.exit(1);
}

// Stable, app-specific key so simultaneous boots serialize on the same lock.
const ADVISORY_LOCK_KEY = 4_727_274;

const sql = postgres(databaseUrl, {
  max: 1,
  onnotice: (n) => n.message && console.log(`  ${n.message}`),
});

async function runDrizzleMigrations() {
  const db = drizzle(sql);
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  console.log("[migrate] drizzle schema migrations up to date");
}

async function runCustomMigrations() {
  const dir = path.join(process.cwd(), "drizzle", "custom");
  if (!fs.existsSync(dir)) {
    console.log("[migrate] no custom migrations directory, skipping");
    return;
  }

  // Same tracking table + schema as scripts/migrate-custom.ts.
  await sql`
    CREATE TABLE IF NOT EXISTS custom_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const applied = await sql<{ name: string }[]>`
    SELECT name FROM custom_migrations ORDER BY id
  `;
  const appliedSet = new Set(applied.map((m) => m.name));

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    console.log(`[migrate] applying custom ${file}...`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx.unsafe(`INSERT INTO custom_migrations (name) VALUES ($1)`, [
        file,
      ]);
    });
    count++;
  }

  console.log(
    count > 0
      ? `[migrate] ${count} custom migration(s) applied`
      : "[migrate] custom migrations up to date"
  );
}

async function main() {
  console.log("[migrate] acquiring advisory lock...");
  await sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`;
  try {
    await runDrizzleMigrations();
    if (process.env.RUN_CUSTOM_MIGRATIONS === "true") {
      await runCustomMigrations();
    } else {
      console.log(
        "[migrate] custom migrations skipped (set RUN_CUSTOM_MIGRATIONS=true to enable)"
      );
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}

main()
  .then(async () => {
    await sql.end();
    console.log("[migrate] done");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[migrate] FAILED:", err);
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
