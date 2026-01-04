CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "length" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "width" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "height" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_product_category_idx" ON "product_categories" USING btree ("product_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_images_tenant_variant_media_idx" ON "product_variant_images" USING btree ("tenant_id","variant_id","media_id");