ALTER TABLE "affiliate_conversions" ALTER COLUMN "order_currency" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ALTER COLUMN "order_currency" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "order_transactions" ALTER COLUMN "currency_code" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency_code" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "currency_code" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "store_credits" ALTER COLUMN "currency_code" SET DEFAULT 'USDT';