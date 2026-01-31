ALTER TABLE "tenants" ADD COLUMN "store_location_lat" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "store_location_lng" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "store_location_city" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "store_location_accuracy" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "store_location_source" varchar(10);