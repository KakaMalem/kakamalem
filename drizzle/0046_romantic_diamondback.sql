ALTER TABLE "exchange_rates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "exchange_rates" CASCADE;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ALTER COLUMN "order_currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "billing_transactions" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "delivery_payouts" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "order_transactions" ALTER COLUMN "currency_code" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency_code" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "payment_sessions" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "platform_affiliate_commissions" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "platform_affiliate_payouts" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "currency_code" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "store_credits" ALTER COLUMN "currency_code" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "currency" SET DEFAULT 'AFN';--> statement-breakpoint
ALTER TABLE "platform_affiliate_payouts" DROP COLUMN "crypto_tx_hash";--> statement-breakpoint
ALTER TABLE "platform_affiliate_payouts" DROP COLUMN "crypto_sent_at";