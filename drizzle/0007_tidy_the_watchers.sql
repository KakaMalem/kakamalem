CREATE TABLE "onboarding_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 5 NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_checklists_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "order_payments" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'mobile_money', 'bank_transfer');--> statement-breakpoint
ALTER TABLE "order_payments" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "onboarding_checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_checklists_tenant_id_idx" ON "onboarding_checklists" USING btree ("tenant_id");