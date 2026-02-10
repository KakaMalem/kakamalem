CREATE TABLE "marketplace_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_fa" text,
	"name_ps" text,
	"icon" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "marketplace_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketplace_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cover_image" text,
	"about" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"featured_product_ids" jsonb DEFAULT '[]'::jsonb,
	"price_range" integer DEFAULT 2,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "marketplace_profiles_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "marketplace_store_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "marketplace_profiles" ADD CONSTRAINT "marketplace_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_store_categories" ADD CONSTRAINT "marketplace_store_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_store_categories" ADD CONSTRAINT "marketplace_store_categories_category_id_marketplace_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketplace_profiles_tenant_idx" ON "marketplace_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_store_categories_tenant_cat_idx" ON "marketplace_store_categories" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "marketplace_store_categories_cat_idx" ON "marketplace_store_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_follows_user_tenant_idx" ON "store_follows" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "store_follows_tenant_idx" ON "store_follows" USING btree ("tenant_id");