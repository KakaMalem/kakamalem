CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"target_currency" varchar(3) NOT NULL,
	"rate" numeric(18, 10) NOT NULL,
	"source" varchar(50) DEFAULT 'fawazahmed0',
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "exchange_rate_used" numeric(18, 10);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "exchange_rate_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_price_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_base_target_idx" ON "exchange_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_fetched_at_idx" ON "exchange_rates" USING btree ("fetched_at");