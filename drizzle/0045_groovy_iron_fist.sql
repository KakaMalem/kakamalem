-- Orphan from the crypto-era `db:push` work: never created by any migration and
-- absent from schema.ts, but its `status` column uses crypto_payment_status, so
-- it blocks the DROP TYPE at the bottom of this file. IF EXISTS because a
-- database built from 0000 forward never had it.
DROP TABLE IF EXISTS "hesabpay_manual_payments" CASCADE;--> statement-breakpoint
DROP TABLE "commission_tiers" CASCADE;--> statement-breakpoint
DROP TABLE "crypto_payments" CASCADE;--> statement-breakpoint
DROP TABLE "dispute_messages" CASCADE;--> statement-breakpoint
DROP TABLE "disputes" CASCADE;--> statement-breakpoint
DROP TABLE "escrow_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "seller_balances" CASCADE;--> statement-breakpoint
DROP TABLE "seller_payout_items" CASCADE;--> statement-breakpoint
DROP TABLE "seller_payout_methods" CASCADE;--> statement-breakpoint
DROP TABLE "seller_payouts" CASCADE;--> statement-breakpoint
DROP TABLE "seller_transactions" CASCADE;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ALTER COLUMN "gateway" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment_sessions" ALTER COLUMN "gateway" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ALTER COLUMN "gateway" SET DATA TYPE text;--> statement-breakpoint
DELETE FROM "payment_gateway_configs" WHERE "gateway" NOT IN ('hesabpay', 'cod', 'bank_transfer', 'mobile_money');--> statement-breakpoint
UPDATE "payment_sessions" SET "gateway" = 'hesabpay' WHERE "gateway" NOT IN ('hesabpay', 'cod', 'bank_transfer', 'mobile_money');--> statement-breakpoint
UPDATE "payment_webhook_events" SET "gateway" = 'hesabpay' WHERE "gateway" NOT IN ('hesabpay', 'cod', 'bank_transfer', 'mobile_money');--> statement-breakpoint
DROP TYPE "public"."payment_gateway";--> statement-breakpoint
CREATE TYPE "public"."payment_gateway" AS ENUM('hesabpay', 'cod', 'bank_transfer', 'mobile_money');--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ALTER COLUMN "gateway" SET DATA TYPE "public"."payment_gateway" USING "gateway"::"public"."payment_gateway";--> statement-breakpoint
ALTER TABLE "payment_sessions" ALTER COLUMN "gateway" SET DATA TYPE "public"."payment_gateway" USING "gateway"::"public"."payment_gateway";--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ALTER COLUMN "gateway" SET DATA TYPE "public"."payment_gateway" USING "gateway"::"public"."payment_gateway";--> statement-breakpoint
ALTER TABLE "platform_settings" DROP COLUMN "usdt_wallet_config";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "stripe_price_id";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "stripe_yearly_price_id";--> statement-breakpoint
DROP TYPE "public"."crypto_network";--> statement-breakpoint
DROP TYPE "public"."crypto_payment_status";--> statement-breakpoint
DROP TYPE "public"."dispute_party";--> statement-breakpoint
DROP TYPE "public"."dispute_status";--> statement-breakpoint
DROP TYPE "public"."escrow_currency";--> statement-breakpoint
DROP TYPE "public"."escrow_status";--> statement-breakpoint
DROP TYPE "public"."payout_status";--> statement-breakpoint
DROP TYPE "public"."seller_transaction_type";