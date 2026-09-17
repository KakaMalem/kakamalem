ALTER TABLE "orders" ADD COLUMN "buyer_country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_city" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_region" varchar(100);--> statement-breakpoint
CREATE INDEX "orders_tenant_buyer_country_idx" ON "orders" USING btree ("tenant_id","buyer_country_code");