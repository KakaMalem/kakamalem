CREATE TYPE "public"."delivery_mode" AS ENUM('distance_based', 'service_level', 'weight_price_based');--> statement-breakpoint
CREATE TYPE "public"."delivery_zone_type" AS ENUM('circle', 'polygon');--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"zone_type" "delivery_zone_type" DEFAULT 'circle' NOT NULL,
	"center_lat" numeric(10, 8),
	"center_lng" numeric(11, 8),
	"radius_meters" integer,
	"polygon_coordinates" jsonb,
	"delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"min_order_amount" numeric(12, 2),
	"free_shipping_threshold" numeric(12, 2),
	"estimated_delivery_time" varchar(50),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"color" varchar(7) DEFAULT '#3b82f6',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "delivery_mode" "delivery_mode" DEFAULT 'distance_based' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "enable_delivery_zones" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_zones_tenant_id_idx" ON "delivery_zones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_zones_active_idx" ON "delivery_zones" USING btree ("tenant_id","is_active");