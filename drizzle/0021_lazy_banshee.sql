CREATE TYPE "public"."domain_status" AS ENUM('pending', 'dns_verification', 'ssl_provisioning', 'active', 'error', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."ssl_status" AS ENUM('pending', 'initializing', 'pending_validation', 'pending_issuance', 'pending_deployment', 'active', 'expiring_soon', 'expired', 'error');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_domain_status" "domain_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "domain_verification_token" varchar(64);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "domain_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ssl_status" "ssl_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ssl_provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "cloudflare_hostname_id" varchar(64);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "domain_dns_records" jsonb;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "domain_error" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "domain_last_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tenants_custom_domain_idx" ON "tenants" USING btree ("custom_domain");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_custom_domain_unique" UNIQUE("custom_domain");