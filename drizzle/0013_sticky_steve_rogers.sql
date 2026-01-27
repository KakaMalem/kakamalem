ALTER TABLE "product_variants" ADD COLUMN "barcode" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" varchar(50);--> statement-breakpoint
CREATE INDEX "product_variants_tenant_barcode_idx" ON "product_variants" USING btree ("tenant_id","barcode");--> statement-breakpoint
CREATE INDEX "products_tenant_sku_idx" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "products_tenant_barcode_idx" ON "products" USING btree ("tenant_id","barcode");