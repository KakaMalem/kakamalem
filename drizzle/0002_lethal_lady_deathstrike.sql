CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'mobile_money', 'bank_transfer', 'credit');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('online', 'offline', 'phone');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sales_channel" "sales_channel" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" "payment_method";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "receipt_number" varchar(30);--> statement-breakpoint
CREATE INDEX "orders_tenant_channel_idx" ON "orders" USING btree ("tenant_id","sales_channel");--> statement-breakpoint
-- Mark existing confirmed/processing/shipped/delivered orders as paid
UPDATE "orders" SET "is_paid" = true, "paid_at" = "created_at" WHERE "status" IN ('confirmed', 'processing', 'shipped', 'delivered');