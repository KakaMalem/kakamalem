CREATE TABLE "store_link_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"visitor_id" varchar(255),
	"ip_address" varchar(45),
	"referrer" text,
	"user_agent" text,
	"device_type" varchar(20),
	"browser" varchar(50),
	"os" varchar(50),
	"country_code" varchar(2),
	"city" varchar(100),
	"is_unique" boolean DEFAULT false NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"is_converted" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp with time zone,
	"order_id" uuid,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255),
	"target_type" varchar(20) NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"target_url" text,
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"utm_content" varchar(255),
	"utm_term" varchar(255),
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "store_link_clicks" ADD CONSTRAINT "store_link_clicks_link_id_store_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."store_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_link_clicks" ADD CONSTRAINT "store_link_clicks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_link_clicks" ADD CONSTRAINT "store_link_clicks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_links" ADD CONSTRAINT "store_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_links" ADD CONSTRAINT "store_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_links" ADD CONSTRAINT "store_links_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_link_clicks_link_id_idx" ON "store_link_clicks" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "store_link_clicks_tenant_id_idx" ON "store_link_clicks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "store_link_clicks_clicked_at_idx" ON "store_link_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "store_link_clicks_link_clicked_idx" ON "store_link_clicks" USING btree ("link_id","clicked_at");--> statement-breakpoint
CREATE INDEX "store_link_clicks_visitor_id_idx" ON "store_link_clicks" USING btree ("visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_links_code_idx" ON "store_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "store_links_tenant_id_idx" ON "store_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "store_links_tenant_created_idx" ON "store_links" USING btree ("tenant_id","created_at");