CREATE TYPE "public"."sale_campaign_discount_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."sale_campaign_scope" AS ENUM('store_wide', 'categories', 'products');--> statement-breakpoint
CREATE TABLE "sale_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"slug" varchar(255),
	"discount_type" "sale_campaign_discount_type" DEFAULT 'percentage' NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"scope" "sale_campaign_scope" DEFAULT 'store_wide' NOT NULL,
	"eligible_categories" jsonb,
	"eligible_products" jsonb,
	"excluded_products" jsonb,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"minimum_order_amount" numeric(12, 2),
	"show_badge" boolean DEFAULT true NOT NULL,
	"badge_text" varchar(50),
	"banner_image" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_campaigns" ADD CONSTRAINT "sale_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_campaigns_tenant_idx" ON "sale_campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sale_campaigns_active_dates_idx" ON "sale_campaigns" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "sale_campaigns_scope_idx" ON "sale_campaigns" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_campaigns_slug_idx" ON "sale_campaigns" USING btree ("tenant_id","slug");