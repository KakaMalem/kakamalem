ALTER TYPE "public"."order_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'partially_refunded';--> statement-breakpoint
DROP INDEX "product_variants_product_sku_idx";--> statement-breakpoint
DROP INDEX "review_media_review_media_idx";--> statement-breakpoint
DROP INDEX "shipping_methods_zone_name_idx";--> statement-breakpoint
DROP INDEX "variant_option_values_option_value_idx";--> statement-breakpoint
ALTER TABLE "analytics_product_performance" ADD COLUMN "revenue_per_view" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_tenant_product_sku_idx" ON "product_variants" USING btree ("tenant_id","product_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "review_media_tenant_review_media_idx" ON "review_media" USING btree ("tenant_id","review_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_methods_tenant_zone_name_idx" ON "shipping_methods" USING btree ("tenant_id","zone_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_option_values_tenant_option_value_idx" ON "variant_option_values" USING btree ("tenant_id","option_id","value");