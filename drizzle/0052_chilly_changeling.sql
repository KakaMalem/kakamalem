CREATE TYPE "public"."seller_ledger_entry_type" AS ENUM('earning', 'refund', 'payout', 'payout_reversal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."seller_payout_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "seller_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"currency" varchar(10) DEFAULT 'AFN' NOT NULL,
	"available" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reserved" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lifetime_earned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lifetime_paid_out" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_balances_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "seller_balances_available_check" CHECK (available >= 0),
	CONSTRAINT "seller_balances_reserved_check" CHECK (reserved >= 0)
);
--> statement-breakpoint
CREATE TABLE "seller_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "seller_ledger_entry_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"reference_type" varchar(30) NOT NULL,
	"reference_id" uuid NOT NULL,
	"order_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payout_number" varchar(30) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'AFN' NOT NULL,
	"status" "seller_payout_status" DEFAULT 'processing' NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_name" varchar(120),
	"gateway_response" jsonb,
	"failure_reason" text,
	"requested_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "seller_payouts_payout_number_unique" UNIQUE("payout_number"),
	CONSTRAINT "seller_payouts_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "hesabpay_account_number" varchar(50);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "hesabpay_account_name" varchar(120);--> statement-breakpoint
ALTER TABLE "seller_balances" ADD CONSTRAINT "seller_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_balances_tenant_id_idx" ON "seller_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seller_ledger_entries_tenant_idx" ON "seller_ledger_entries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "seller_ledger_entries_order_idx" ON "seller_ledger_entries" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_ledger_entries_source_idx" ON "seller_ledger_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "seller_payouts_tenant_idx" ON "seller_payouts" USING btree ("tenant_id","requested_at");--> statement-breakpoint
CREATE INDEX "seller_payouts_status_idx" ON "seller_payouts" USING btree ("status");

--> statement-breakpoint
-- Backfill earnings for card payments taken before this ledger existed.
--
-- This is a DATA migration, not a schema one, and the container entrypoint
-- aborts startup on any migration error. A schema failure should stop a deploy;
-- a backfill failure should not take the site down, so it is wrapped and
-- downgraded to a warning. If it does not run, `pnpm earnings:backfill` repairs
-- it later, and it is idempotent either way.
DO $backfill$
BEGIN
  -- Only completed HesabPay payments in AFN: that is what the platform
  -- actually received. Cash on delivery never reached us, so it is not owed.
  INSERT INTO "seller_ledger_entries" (
    "tenant_id", "type", "amount", "balance_after",
    "reference_type", "reference_id", "order_id", "description", "created_at"
  )
  SELECT
    ot."tenant_id",
    'earning'::"public"."seller_ledger_entry_type",
    ot."amount",
    SUM(ot."amount") OVER (
      PARTITION BY ot."tenant_id"
      ORDER BY COALESCE(ot."processed_at", ot."created_at"), ot."id"
    ),
    'order_payment',
    ot."id",
    ot."order_id",
    'Order ' || o."order_number",
    COALESCE(ot."processed_at", ot."created_at")
  FROM "order_transactions" ot
  JOIN "orders" o ON o."id" = ot."order_id"
  WHERE ot."gateway" = 'hesabpay'
    AND ot."type" = 'payment'
    AND ot."status" = 'completed'
    AND UPPER(COALESCE(ot."currency_code", 'AFN')) = 'AFN'
    AND ot."amount" > 0
  ON CONFLICT ("reference_type", "reference_id") DO NOTHING;

  -- Opening balances from those entries. DO NOTHING so this can never
  -- overwrite a balance the running application is already maintaining.
  INSERT INTO "seller_balances" (
    "tenant_id", "currency", "available", "lifetime_earned"
  )
  SELECT
    le."tenant_id",
    'AFN',
    SUM(le."amount"),
    SUM(le."amount")
  FROM "seller_ledger_entries" le
  WHERE le."type" = 'earning'
  GROUP BY le."tenant_id"
  ON CONFLICT ("tenant_id") DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Seller earnings backfill skipped: % (%). Run pnpm earnings:backfill to repair.', SQLERRM, SQLSTATE;
END
$backfill$;
