CREATE TYPE "public"."billing_transaction_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."billing_transaction_type" AS ENUM('subscription_payment', 'subscription_upgrade', 'subscription_downgrade', 'trial_extension', 'refund', 'credit', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'void', 'partially_paid');--> statement-breakpoint
CREATE TABLE "billing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "billing_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"payment_method" "payment_method",
	"payment_reference" varchar(255),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"from_plan" "subscription_plan",
	"to_plan" "subscription_plan",
	"status" "billing_transaction_status" DEFAULT 'completed' NOT NULL,
	"invoice_id" uuid,
	"processed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"due_date" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"items" jsonb,
	"billing_name" varchar(255),
	"billing_email" varchar(255),
	"billing_phone" varchar(50),
	"billing_address" text,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_transactions_tenant_id_idx" ON "billing_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_type_idx" ON "billing_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "billing_transactions_status_idx" ON "billing_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_transactions_created_at_idx" ON "billing_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_transactions_processed_by_idx" ON "billing_transactions" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");