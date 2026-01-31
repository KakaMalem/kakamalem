CREATE TABLE "store_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"city" varchar(100),
	"plus_code" varchar(20),
	"accuracy" integer,
	"source" varchar(10),
	"phone" varchar(50),
	"email" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_locations" ADD CONSTRAINT "store_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_locations_tenant_id_idx" ON "store_locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "store_locations_primary_idx" ON "store_locations" USING btree ("tenant_id","is_primary");