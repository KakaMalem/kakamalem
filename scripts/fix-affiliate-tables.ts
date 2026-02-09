/**
 * Fix missing affiliate tables
 *
 * Run with: npx tsx scripts/fix-affiliate-tables.ts
 */

import dotenv from "dotenv";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

// Load .env.local first (like Next.js), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL_UNPOOLED or DATABASE_URL not found");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(connectionString);

  try {
    // Check if platform_affiliates table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'platform_affiliates'
      );
    `;

    if (tableExists[0].exists) {
      console.log("✓ platform_affiliates table already exists");

      // Check reserved_slugs
      const reservedExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'reserved_slugs'
        );
      `;

      if (reservedExists[0].exists) {
        console.log("✓ reserved_slugs table already exists");
        console.log("\nAll affiliate tables exist. No action needed.");
        process.exit(0);
      }
    }

    console.log(
      "\n⚠️  Missing affiliate tables detected. Applying migration...\n"
    );

    // Read and execute the migration SQL
    const migrationPath = path.join(
      __dirname,
      "../drizzle/0031_greedy_deadpool.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Split by statement breakpoint and execute each statement
    const statements = migrationSql.split("--> statement-breakpoint");

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await sql.unsafe(stmt);
        console.log(`  ✓ Statement ${i + 1} executed`);
      } catch (error) {
        // Ignore "already exists" errors
        // 42P07 = duplicate_table
        // 42710 = duplicate_object
        // 42P06 = duplicate_schema
        // 42701 = duplicate_column
        // 42P16 = invalid_table_definition (for constraints)
        const skipCodes = [
          "42P07",
          "42710",
          "42P06",
          "42701",
          "42P16",
          "42710",
        ];
        const pgError = error as { code?: string };
        if (pgError.code && skipCodes.includes(pgError.code)) {
          console.log(`  → Statement ${i + 1} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }

    console.log("\n✓ Migration applied successfully!");
    console.log(
      "\nYou can now access the affiliate admin page at /admin/affiliates"
    );
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
