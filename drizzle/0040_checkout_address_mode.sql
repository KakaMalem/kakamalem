CREATE TYPE "public"."checkout_address_mode" AS ENUM('gps', 'standard_form');-->statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "checkout_address_mode" "checkout_address_mode" DEFAULT 'gps' NOT NULL;
