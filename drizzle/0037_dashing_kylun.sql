-- Marketplace: Add marketplace_enabled flag to tenants
-- Note: This migration was trimmed to only include new changes.
-- Drizzle-kit generated a larger migration because snapshots for manual
-- migrations 0030-0036 were missing. The 0037_snapshot.json is correct
-- and future db:generate calls will work properly.

ALTER TABLE "tenants" ADD COLUMN "marketplace_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "tenants_marketplace_idx" ON "tenants" USING btree ("marketplace_enabled","status");
