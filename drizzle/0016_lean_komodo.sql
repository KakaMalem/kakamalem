CREATE TABLE "order_invoice_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_invoice_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "order_invoice_tokens" ADD CONSTRAINT "order_invoice_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice_tokens" ADD CONSTRAINT "order_invoice_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice_tokens" ADD CONSTRAINT "order_invoice_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_invoice_tokens_order_id_idx" ON "order_invoice_tokens" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_invoice_tokens_tenant_id_idx" ON "order_invoice_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoice_tokens_token_idx" ON "order_invoice_tokens" USING btree ("token");