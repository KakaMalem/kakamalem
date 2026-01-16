/**
 * Custom SQL Migration Runner
 *
 * Runs SQL files from drizzle/custom/ folder that aren't managed by drizzle-kit.
 * Tracks applied migrations in a `custom_migrations` table.
 *
 * Usage: pnpm db:migrate:custom
 */
import dotenv from "dotenv";
import postgres from "postgres";
import fs from "fs";
import path from "path";

// Load .env.local first (like Next.js), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle", "custom");

async function runCustomMigrations() {
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl) {
    console.error("DATABASE_URL_UNPOOLED environment variable is required");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    onnotice: (notice) => {
      if (notice.message) {
        console.log(`  ${notice.message}`);
      }
    },
  });

  try {
    // Create tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS custom_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Get already applied migrations
    const applied = await sql<{ name: string }[]>`
      SELECT name FROM custom_migrations ORDER BY id
    `;
    const appliedSet = new Set(applied.map((m) => m.name));

    // Get all SQL files from custom migrations directory
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
      console.log(`Created ${MIGRATIONS_DIR} directory`);
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No custom migrations found in drizzle/custom/");
      return;
    }

    // Run pending migrations
    let migrationsRun = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      console.log(`→ Running ${file}...`);

      await sql.begin(async (tx) => {
        await tx.unsafe(sqlContent);
        await tx.unsafe(`INSERT INTO custom_migrations (name) VALUES ($1)`, [
          file,
        ]);
      });

      console.log(`✓ ${file} applied successfully`);
      migrationsRun++;
    }

    if (migrationsRun === 0) {
      console.log("\nAll migrations already applied.");
    } else {
      console.log(`\n${migrationsRun} migration(s) applied successfully.`);
    }
  } catch (error) {
    console.error("\nMigration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runCustomMigrations();
