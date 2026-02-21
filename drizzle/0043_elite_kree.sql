CREATE TABLE "page_layout_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_layout_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer NOT NULL,
	"published_by" text,
	"published_by_name" varchar(255),
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "theme_config" jsonb;--> statement-breakpoint
ALTER TABLE "page_layout_versions" ADD CONSTRAINT "page_layout_versions_page_layout_id_page_layouts_id_fk" FOREIGN KEY ("page_layout_id") REFERENCES "public"."page_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_layout_versions" ADD CONSTRAINT "page_layout_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_layout_versions" ADD CONSTRAINT "page_layout_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_layout_versions_layout_idx" ON "page_layout_versions" USING btree ("page_layout_id","version");--> statement-breakpoint
CREATE INDEX "page_layout_versions_tenant_idx" ON "page_layout_versions" USING btree ("tenant_id");