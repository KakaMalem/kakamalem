CREATE TYPE "public"."discount_scope" AS ENUM('order', 'item', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."discount_source" AS ENUM('coupon', 'automatic', 'manual', 'loyalty', 'employee', 'price_match', 'negotiated');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('shipping', 'pickup', 'instant', 'local_delivery', 'curbside');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('sellable', 'damaged', 'defective', 'missing');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('online', 'pos', 'phone', 'marketplace', 'social');--> statement-breakpoint
CREATE TYPE "public"."order_event_category" AS ENUM('order', 'payment', 'fulfillment', 'refund', 'discount', 'note');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'refunded', 'partial_refund');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('customer_request', 'defective', 'wrong_item', 'not_as_described', 'arrived_late', 'duplicate_order', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."refund_type" AS ENUM('full', 'partial', 'exchange', 'store_credit', 'appeasement');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'committed', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."store_credit_source" AS ENUM('refund', 'gift_card', 'compensation', 'promotion', 'loyalty');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('payment', 'refund', 'void', 'chargeback', 'adjustment');--> statement-breakpoint
CREATE TABLE "coupon_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"discount_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" "discount_type" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"scope" "discount_scope" DEFAULT 'order' NOT NULL,
	"minimum_order_amount" numeric(14, 2),
	"maximum_discount_amount" numeric(14, 2),
	"usage_limit" integer,
	"usage_limit_per_customer" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"eligible_products" jsonb,
	"eligible_categories" jsonb,
	"eligible_customer_groups" jsonb,
	"excluded_products" jsonb,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"combinable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "coupons_value_positive" CHECK (value > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	CONSTRAINT "inventory_reservations_quantity_positive" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "order_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid,
	"source" "discount_source" NOT NULL,
	"coupon_id" uuid,
	"type" "discount_type" NOT NULL,
	"scope" "discount_scope" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"applied_amount" numeric(14, 2) NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text,
	"authorized_by" text,
	"authorization_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_category" "order_event_category",
	"actor_type" varchar(20) NOT NULL,
	"actor_id" text,
	"actor_name" varchar(100),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"idempotency_key" varchar(64),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency_code" varchar(3) DEFAULT 'AFN' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"gateway" varchar(50),
	"gateway_transaction_id" varchar(100),
	"gateway_response" jsonb,
	"card_last_four" varchar(4),
	"card_brand" varchar(20),
	"parent_transaction_id" uuid,
	"refund_id" uuid,
	"cash_received" numeric(14, 2),
	"cash_change" numeric(14, 2),
	"recorded_by" text,
	"authorized_by" text,
	"idempotency_key" varchar(64),
	"processed_at" timestamp with time zone,
	"notes" text,
	"internal_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_refund_amount" numeric(12, 2) NOT NULL,
	"total_refund_amount" numeric(14, 2) NOT NULL,
	"condition" "item_condition" DEFAULT 'sellable' NOT NULL,
	"restock" boolean DEFAULT true NOT NULL,
	"restock_location" varchar(100),
	"restocked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_items_quantity_positive" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"refund_number" varchar(30) NOT NULL,
	"type" "refund_type" NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_refund" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_refund" numeric(14, 2) DEFAULT '0' NOT NULL,
	"restocking_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency_code" varchar(3) DEFAULT 'AFN' NOT NULL,
	"refund_method" varchar(30) NOT NULL,
	"reason_code" "refund_reason" NOT NULL,
	"reason_details" text,
	"customer_notes" text,
	"requested_by" text,
	"approved_by" text,
	"processed_by" text,
	"rejected_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"store_credit_id" uuid,
	"internal_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_total_positive" CHECK (total_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "store_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_credit_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"order_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"currency_code" varchar(3) DEFAULT 'AFN' NOT NULL,
	"source_type" "store_credit_source" NOT NULL,
	"source_id" uuid,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_credits_balance_valid" CHECK (balance >= 0 AND balance <= original_amount)
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
DROP INDEX "orders_tenant_channel_idx";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_total" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_total" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "tax_total" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "tax_total" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_total" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_total" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_price" numeric(12, 2);--> statement-breakpoint
UPDATE "order_items" SET "unit_price" = "price" WHERE "unit_price" IS NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "compare_at_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_subtotal" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rate" numeric(5, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_code" varchar(20);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_fulfilled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_refunded" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "fulfillment_status" varchar(20) DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel" "order_channel" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_type" "fulfillment_type" DEFAULT 'shipping' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "item_discounts_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_discounts_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_discounts_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "manual_discounts_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "surcharges_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tip_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_code" varchar(3) DEFAULT 'AFN' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_refunded" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_due" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "register_id" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashier_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "placed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_customer_id_store_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."store_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_authorized_by_user_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_authorized_by_user_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_store_credit_id_store_credits_id_fk" FOREIGN KEY ("store_credit_id") REFERENCES "public"."store_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_customer_id_store_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."store_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_usages_coupon_order_idx" ON "coupon_usages" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_usages_customer_id_idx" ON "coupon_usages" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_tenant_code_idx" ON "coupons" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "coupons_tenant_active_idx" ON "coupons" USING btree ("tenant_id","is_active","starts_at","expires_at");--> statement-breakpoint
CREATE INDEX "inventory_reservations_product_idx" ON "inventory_reservations" USING btree ("product_id","variant_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_source_idx" ON "inventory_reservations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_expires_idx" ON "inventory_reservations" USING btree ("expires_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "inventory_reservations_tenant_idx" ON "inventory_reservations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_discounts_order_id_idx" ON "order_discounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_discounts_coupon_id_idx" ON "order_discounts" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "order_events_tenant_idx" ON "order_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "order_events_type_idx" ON "order_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_idempotency_idx" ON "order_events" USING btree ("order_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "order_transactions_order_id_idx" ON "order_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_transactions_tenant_id_idx" ON "order_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_transactions_type_idx" ON "order_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "order_transactions_status_idx" ON "order_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_transactions_parent_idx" ON "order_transactions" USING btree ("parent_transaction_id");--> statement-breakpoint
CREATE INDEX "order_transactions_refund_idx" ON "order_transactions" USING btree ("refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_transactions_idempotency_idx" ON "order_transactions" USING btree ("tenant_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "refund_items_refund_id_idx" ON "refund_items" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_items_order_item_id_idx" ON "refund_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_tenant_number_idx" ON "refunds" USING btree ("tenant_id","refund_number");--> statement-breakpoint
CREATE INDEX "refunds_order_id_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_tenant_id_idx" ON "refunds" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_requested_at_idx" ON "refunds" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "store_credit_transactions_credit_id_idx" ON "store_credit_transactions" USING btree ("store_credit_id");--> statement-breakpoint
CREATE INDEX "store_credit_transactions_order_id_idx" ON "store_credit_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_credits_tenant_code_idx" ON "store_credits" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "store_credits_customer_idx" ON "store_credits" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "store_credits_tenant_idx" ON "store_credits" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_user_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_id_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_idempotency_idx" ON "orders" USING btree ("tenant_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_tenant_sales_channel_idx" ON "orders" USING btree ("tenant_id","sales_channel");--> statement-breakpoint
CREATE INDEX "orders_tenant_payment_status_idx" ON "orders" USING btree ("tenant_id","payment_status");--> statement-breakpoint
CREATE INDEX "orders_tenant_placed_idx" ON "orders" USING btree ("tenant_id","placed_at") WHERE placed_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_tenant_active_idx" ON "orders" USING btree ("tenant_id","status","created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "orders_tenant_channel_idx" ON "orders" USING btree ("tenant_id","channel");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_fulfillment_valid" CHECK (quantity_fulfilled >= 0 AND quantity_fulfilled <= quantity);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_refund_valid" CHECK (quantity_refunded >= 0 AND quantity_refunded <= quantity);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_paid_positive" CHECK (amount_paid >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_refunded_valid" CHECK (amount_refunded >= 0 AND amount_refunded <= amount_paid);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_positive" CHECK (total >= 0);