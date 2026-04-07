DO $$ BEGIN CREATE TYPE "public"."checkout_address_mode" AS ENUM('gps', 'standard_form'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TYPE "public"."dispute_party" AS ENUM('buyer', 'seller', 'admin');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved_buyer', 'resolved_seller');--> statement-breakpoint
CREATE TYPE "public"."escrow_currency" AS ENUM('usdt', 'usdc');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('pending', 'funded', 'in_transit', 'delivered', 'released', 'disputed', 'resolved_buyer', 'resolved_seller', 'expired');--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"role" "dispute_party" NOT NULL,
	"body" text NOT NULL,
	"attachment_urls" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_transaction_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"opened_by" text NOT NULL,
	"opened_by_role" "dispute_party" NOT NULL,
	"reason" varchar(255) NOT NULL,
	"description" text,
	"evidence_urls" jsonb DEFAULT '[]'::jsonb,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"currency" "escrow_currency" NOT NULL,
	"network" "crypto_network" NOT NULL,
	"wallet_address" varchar(100) NOT NULL,
	"tx_hash" varchar(100),
	"status" "escrow_status" DEFAULT 'pending' NOT NULL,
	"platform_fee_percent" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"platform_fee" numeric(20, 8),
	"seller_payout" numeric(20, 8),
	"seller_wallet_address" varchar(100),
	"seller_payout_tx_hash" varchar(100),
	"tracking_number" varchar(100),
	"tracking_carrier" varchar(50),
	"shipped_at" timestamp with time zone,
	"auto_release_at" timestamp with time zone,
	"funded_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tenants" ADD COLUMN "checkout_address_mode" "checkout_address_mode" DEFAULT 'gps' NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_escrow_transaction_id_escrow_transactions_id_fk" FOREIGN KEY ("escrow_transaction_id") REFERENCES "public"."escrow_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_messages_dispute_idx" ON "dispute_messages" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_messages_author_idx" ON "dispute_messages" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "disputes_escrow_idx" ON "disputes" USING btree ("escrow_transaction_id");--> statement-breakpoint
CREATE INDEX "disputes_tenant_idx" ON "disputes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_opened_by_idx" ON "disputes" USING btree ("opened_by");--> statement-breakpoint
CREATE INDEX "escrow_tx_order_idx" ON "escrow_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "escrow_tx_tenant_idx" ON "escrow_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "escrow_tx_buyer_idx" ON "escrow_transactions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "escrow_tx_seller_idx" ON "escrow_transactions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "escrow_tx_status_idx" ON "escrow_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_tx_auto_release_idx" ON "escrow_transactions" USING btree ("auto_release_at");--> statement-breakpoint
CREATE INDEX "escrow_tx_hash_idx" ON "escrow_transactions" USING btree ("tx_hash");