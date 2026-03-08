CREATE TYPE "public"."product_source_type" AS ENUM('manual', 'aliexpress', 'amazon', 'autods');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_type" "product_source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_data" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_currency" varchar(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "external_api_key" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_external_api_key_unique" UNIQUE("external_api_key");