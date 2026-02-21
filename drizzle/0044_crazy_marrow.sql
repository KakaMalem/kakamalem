CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."section_event_type" AS ENUM('impression', 'click');--> statement-breakpoint
CREATE TABLE "experiment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"visitor_id" varchar(255) NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"order_id" uuid,
	"revenue" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"layout_version_id" uuid NOT NULL,
	"weight" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_type" varchar(50) DEFAULT 'homepage' NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefront_section_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_type" varchar(50) NOT NULL,
	"section_type" varchar(100) NOT NULL,
	"section_index" integer NOT NULL,
	"event_type" "section_event_type" NOT NULL,
	"visitor_id" varchar(255),
	"session_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_css" text;--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_variant_id_experiment_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_layout_version_id_page_layout_versions_id_fk" FOREIGN KEY ("layout_version_id") REFERENCES "public"."page_layout_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_section_events" ADD CONSTRAINT "storefront_section_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_events_exp_variant_idx" ON "experiment_events" USING btree ("experiment_id","variant_id","event_type");--> statement-breakpoint
CREATE INDEX "experiment_events_visitor_idx" ON "experiment_events" USING btree ("experiment_id","visitor_id");--> statement-breakpoint
CREATE INDEX "experiment_variants_exp_idx" ON "experiment_variants" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "experiments_tenant_active_idx" ON "experiments" USING btree ("tenant_id","page_type","status");--> statement-breakpoint
CREATE INDEX "section_events_tenant_type_idx" ON "storefront_section_events" USING btree ("tenant_id","section_type","created_at");--> statement-breakpoint
CREATE INDEX "section_events_tenant_page_idx" ON "storefront_section_events" USING btree ("tenant_id","page_type","created_at");