ALTER TABLE "marketplace_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "marketplace_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "marketplace_store_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_follows" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "marketplace_categories" CASCADE;--> statement-breakpoint
DROP TABLE "marketplace_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "marketplace_store_categories" CASCADE;--> statement-breakpoint
DROP TABLE "store_follows" CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DEFAULT 'online'::text;--> statement-breakpoint
DROP TYPE "public"."order_channel";--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('online', 'pos', 'social');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DEFAULT 'online'::"public"."order_channel";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DATA TYPE "public"."order_channel" USING "channel"::"public"."order_channel";--> statement-breakpoint
DROP INDEX "tenants_marketplace_idx";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "marketplace_enabled";