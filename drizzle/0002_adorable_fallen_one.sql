ALTER TABLE "user_addresses" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN "h3_index" varchar(20);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN "plus_code" varchar(20);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN "accuracy" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN "source" varchar(10);