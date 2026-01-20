CREATE TYPE "public"."store_mode" AS ENUM('full', 'online_only', 'offline_only', 'catalog');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "store_mode" "store_mode" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "online_checkout_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pos_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "phone_orders_enabled" boolean DEFAULT true NOT NULL;