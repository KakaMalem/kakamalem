CREATE TABLE "subscription_invoice_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gateway_transaction_id" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_invoice_jobs_attempts_valid" CHECK (attempts >= 0)
);
--> statement-breakpoint
ALTER TABLE "subscription_invoice_jobs" ADD CONSTRAINT "subscription_invoice_jobs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoice_jobs" ADD CONSTRAINT "subscription_invoice_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoice_jobs_invoice_idx" ON "subscription_invoice_jobs" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "subscription_invoice_jobs_pending_idx" ON "subscription_invoice_jobs" USING btree ("available_at") WHERE completed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "order_transactions_gateway_payment_idx" ON "order_transactions" USING btree ("gateway","gateway_transaction_id") WHERE type = 'payment' AND gateway_transaction_id IS NOT NULL;