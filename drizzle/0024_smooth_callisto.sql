CREATE TYPE "public"."payment_gateway" AS ENUM('hesabpay', 'stripe', 'cod', 'bank_transfer', 'mobile_money');--> statement-breakpoint
CREATE TYPE "public"."payment_session_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_webhook_status" AS ENUM('received', 'processing', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"display_name" varchar(100),
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"api_key" text,
	"secret_key" text,
	"merchant_id" varchar(100),
	"merchant_pin" varchar(50),
	"webhook_secret" text,
	"stripe_account_id" varchar(100),
	"is_live" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"supported_currencies" jsonb,
	"min_amount" numeric(12, 2),
	"max_amount" numeric(12, 2),
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid,
	"invoice_id" uuid,
	"gateway" "payment_gateway" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"gateway_session_id" varchar(255),
	"gateway_session_url" text,
	"gateway_response" jsonb,
	"status" "payment_session_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"customer_email" varchar(255),
	"customer_phone" varchar(50),
	"success_url" text,
	"cancel_url" text,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"gateway" "payment_gateway" NOT NULL,
	"event_id" varchar(255),
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"status" "payment_webhook_status" DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"order_id" uuid,
	"transaction_id" uuid,
	"source_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_options" ALTER COLUMN "swatch_shape" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "variant_options" ALTER COLUMN "swatch_shape" SET DEFAULT 'square'::text;--> statement-breakpoint
DROP TYPE "public"."swatch_shape";--> statement-breakpoint
CREATE TYPE "public"."swatch_shape" AS ENUM('square', 'circle');--> statement-breakpoint
ALTER TABLE "variant_options" ALTER COLUMN "swatch_shape" SET DEFAULT 'square'::"public"."swatch_shape";--> statement-breakpoint
ALTER TABLE "variant_options" ALTER COLUMN "swatch_shape" SET DATA TYPE "public"."swatch_shape" USING "swatch_shape"::"public"."swatch_shape";--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_transaction_id_order_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."order_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_configs_tenant_gateway_idx" ON "payment_gateway_configs" USING btree ("tenant_id","gateway");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_tenant_id_idx" ON "payment_gateway_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_enabled_idx" ON "payment_gateway_configs" USING btree ("tenant_id","is_enabled");--> statement-breakpoint
CREATE INDEX "payment_sessions_tenant_id_idx" ON "payment_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_order_id_idx" ON "payment_sessions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_invoice_id_idx" ON "payment_sessions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_status_idx" ON "payment_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_sessions_gateway_session_idx" ON "payment_sessions" USING btree ("gateway_session_id");--> statement-breakpoint
CREATE INDEX "payment_sessions_expires_at_idx" ON "payment_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_gateway_event_idx" ON "payment_webhook_events" USING btree ("gateway","event_id") WHERE event_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_webhook_events_tenant_id_idx" ON "payment_webhook_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_status_idx" ON "payment_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_created_at_idx" ON "payment_webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_order_id_idx" ON "payment_webhook_events" USING btree ("order_id");