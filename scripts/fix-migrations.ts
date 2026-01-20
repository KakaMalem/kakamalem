/**
 * Fix migration state for native PostgreSQL
 *
 * Run with: npx tsx scripts/fix-migrations.ts
 */

import postgres from "postgres";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: ".env" });

const DATABASE_URL =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function fixMigrations() {
  console.log("Checking migration state...\n");

  // Check current migrations
  const applied = await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;

  console.log("Currently applied migrations:");
  if (applied.length === 0) {
    console.log("  (none)");
  } else {
    applied.forEach((m) => console.log(`  - ${m.hash}`));
  }

  // Check if 0001 needs to be marked as applied
  const has0001 = applied.some((m) => m.hash.includes("0001"));
  const has0002 = applied.some((m) => m.hash.includes("0002"));

  // Check if delivery_mode type exists (indicates 0001 was partially applied)
  const typeExists = await sql`
    SELECT 1 FROM pg_type WHERE typname = 'delivery_mode'
  `;

  console.log("\nDatabase state:");
  console.log(`  delivery_mode type exists: ${typeExists.length > 0}`);
  console.log(`  0001 migration recorded: ${has0001}`);
  console.log(`  0002 migration recorded: ${has0002}`);

  if (typeExists.length > 0 && !has0001) {
    console.log("\n⚠️  Migration 0001 was partially applied but not recorded.");
    console.log("   Marking it as applied...");

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0001_clammy_viper', ${Date.now()})
    `;
    console.log("   ✓ Migration 0001 marked as applied");
  }

  // Check if sales_channel column exists
  const salesChannelExists = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sales_channel'
  `;

  if (salesChannelExists.length === 0) {
    console.log("\n⚠️  sales_channel column missing from orders table.");
    console.log("   Applying migration 0002...");

    // Check if payment_method type exists
    const paymentMethodExists = await sql`
      SELECT 1 FROM pg_type WHERE typname = 'payment_method'
    `;
    if (paymentMethodExists.length === 0) {
      await sql`CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'mobile_money', 'bank_transfer')`;
      console.log("   ✓ Created payment_method enum");
    }

    // Check if sales_channel type exists
    const salesChannelTypeExists = await sql`
      SELECT 1 FROM pg_type WHERE typname = 'sales_channel'
    `;
    if (salesChannelTypeExists.length === 0) {
      await sql`CREATE TYPE "public"."sales_channel" AS ENUM('online', 'offline', 'phone')`;
      console.log("   ✓ Created sales_channel enum");
    }

    // Alter orders table
    await sql`ALTER TABLE "orders" ALTER COLUMN "shipping_address" DROP NOT NULL`;
    console.log("   ✓ Made shipping_address nullable");

    await sql`ALTER TABLE "orders" ADD COLUMN "sales_channel" "sales_channel" DEFAULT 'online' NOT NULL`;
    console.log("   ✓ Added sales_channel column");

    await sql`ALTER TABLE "orders" ADD COLUMN "payment_method" "payment_method"`;
    console.log("   ✓ Added payment_method column");

    await sql`ALTER TABLE "orders" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL`;
    console.log("   ✓ Added is_paid column");

    await sql`ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone`;
    console.log("   ✓ Added paid_at column");

    await sql`ALTER TABLE "orders" ADD COLUMN "receipt_number" varchar(30)`;
    console.log("   ✓ Added receipt_number column");

    // Create index
    await sql`CREATE INDEX "orders_tenant_channel_idx" ON "orders" USING btree ("tenant_id","sales_channel")`;
    console.log("   ✓ Created index");

    // Mark existing orders as paid
    await sql`UPDATE "orders" SET "is_paid" = true, "paid_at" = "created_at" WHERE "status" IN ('confirmed', 'processing', 'shipped', 'delivered')`;
    console.log("   ✓ Marked existing orders as paid");

    // Record migration
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0002_lethal_lady_deathstrike', ${Date.now()})
    `;
    console.log("   ✓ Migration 0002 recorded");
  } else if (!has0002) {
    console.log("\n⚠️  Migration 0002 was applied but not recorded.");
    console.log("   Marking it as applied...");

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0002_lethal_lady_deathstrike', ${Date.now()})
    `;
    console.log("   ✓ Migration 0002 marked as applied");
  }

  console.log(
    "\n✓ Done! Now run 'pnpm db:migrate' to apply any remaining migrations."
  );

  await sql.end();
}

fixMigrations().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
