CREATE TYPE "public"."swatch_type" AS ENUM('text', 'color', 'image');--> statement-breakpoint
CREATE TABLE "option_value_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"option_value_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD COLUMN "swatch_type" "swatch_type" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD COLUMN "swatch_value" varchar(255);--> statement-breakpoint
ALTER TABLE "option_value_images" ADD CONSTRAINT "option_value_images_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value_images" ADD CONSTRAINT "option_value_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value_images" ADD CONSTRAINT "option_value_images_option_value_id_variant_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."variant_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value_images" ADD CONSTRAINT "option_value_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "option_value_images_product_value_media_idx" ON "option_value_images" USING btree ("product_id","option_value_id","media_id");--> statement-breakpoint
CREATE INDEX "option_value_images_product_idx" ON "option_value_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "option_value_images_option_value_idx" ON "option_value_images" USING btree ("option_value_id");