ALTER TABLE "orders" ALTER COLUMN "channel" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DEFAULT 'online'::text;--> statement-breakpoint
DROP TYPE "public"."order_channel";--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('online', 'pos', 'marketplace', 'social');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DEFAULT 'online'::"public"."order_channel";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "channel" SET DATA TYPE "public"."order_channel" USING "channel"::"public"."order_channel";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "receipt_print_mode" varchar(10) DEFAULT 'prompt' NOT NULL;