CREATE TYPE "public"."platform_affiliate_commission_status" AS ENUM('pending', 'available', 'paid', 'voided');--> statement-breakpoint
CREATE TYPE "public"."platform_affiliate_payout_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."platform_affiliate_referral_status" AS ENUM('trial', 'active', 'churned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."platform_affiliate_status" AS ENUM('pending', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."platform_affiliate_tier" AS ENUM('bronze', 'silver', 'gold');--> statement-breakpoint
CREATE TABLE "platform_affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"visitor_id" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"referrer" text,
	"landing_page" text,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"utm_content" varchar(100),
	"converted" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp with time zone,
	"referral_id" uuid,
	"cookie_expires_at" timestamp with time zone NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_amount" numeric(12, 2) NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"commission_month" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "platform_affiliate_commission_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone,
	"payout_id" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"payout_number" varchar(20) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"payout_method" varchar(50) NOT NULL,
	"payout_details" jsonb NOT NULL,
	"status" "platform_affiliate_payout_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" text,
	"completed_at" timestamp with time zone,
	"admin_notes" text,
	"failure_reason" text,
	"transaction_reference" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_affiliate_payouts_payout_number_unique" UNIQUE("payout_number")
);
--> statement-breakpoint
CREATE TABLE "platform_affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"click_id" uuid,
	"signed_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_ends_at" timestamp with time zone,
	"first_paid_at" timestamp with time zone,
	"retention_passed" boolean DEFAULT false NOT NULL,
	"retention_checked_at" timestamp with time zone,
	"status" "platform_affiliate_referral_status" DEFAULT 'trial' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_subscription_paid" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_commission_earned" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_commission_paid" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_affiliate_referrals_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "platform_affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"website_url" text,
	"social_links" jsonb,
	"base_commission_rate" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"commission_duration_months" integer DEFAULT 12 NOT NULL,
	"cookie_duration_days" integer DEFAULT 90 NOT NULL,
	"current_tier" "platform_affiliate_tier" DEFAULT 'bronze' NOT NULL,
	"current_commission_rate" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_signups" integer DEFAULT 0 NOT NULL,
	"successful_referrals" integer DEFAULT 0 NOT NULL,
	"total_earned" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_pending" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_paid_out" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" "platform_affiliate_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"rejection_reason" text,
	"payout_method" varchar(50),
	"payout_details" jsonb,
	"application_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_affiliates_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "platform_affiliates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reserved_slugs" (
	"slug" varchar(63) PRIMARY KEY NOT NULL,
	"reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Skip: enable_shipping already added in 0030_enable_shipping_flag.sql
-- ALTER TABLE "tenants" ADD COLUMN "enable_shipping" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_affiliate_clicks" ADD CONSTRAINT "platform_affiliate_clicks_affiliate_id_platform_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_commissions" ADD CONSTRAINT "platform_affiliate_commissions_affiliate_id_platform_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_commissions" ADD CONSTRAINT "platform_affiliate_commissions_referral_id_platform_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."platform_affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_commissions" ADD CONSTRAINT "platform_affiliate_commissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_commissions" ADD CONSTRAINT "platform_affiliate_commissions_payout_id_platform_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."platform_affiliate_payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_payouts" ADD CONSTRAINT "platform_affiliate_payouts_affiliate_id_platform_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_payouts" ADD CONSTRAINT "platform_affiliate_payouts_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_referrals" ADD CONSTRAINT "platform_affiliate_referrals_affiliate_id_platform_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_referrals" ADD CONSTRAINT "platform_affiliate_referrals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliate_referrals" ADD CONSTRAINT "platform_affiliate_referrals_click_id_platform_affiliate_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."platform_affiliate_clicks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliates" ADD CONSTRAINT "platform_affiliates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_affiliates" ADD CONSTRAINT "platform_affiliates_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_affiliate_clicks_affiliate_id_idx" ON "platform_affiliate_clicks" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_clicks_visitor_id_idx" ON "platform_affiliate_clicks" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_clicks_clicked_at_idx" ON "platform_affiliate_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "platform_affiliate_commissions_affiliate_id_idx" ON "platform_affiliate_commissions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_commissions_referral_id_idx" ON "platform_affiliate_commissions" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_commissions_status_idx" ON "platform_affiliate_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_affiliate_commissions_tenant_id_idx" ON "platform_affiliate_commissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_affiliate_payouts_payout_number_idx" ON "platform_affiliate_payouts" USING btree ("payout_number");--> statement-breakpoint
CREATE INDEX "platform_affiliate_payouts_affiliate_id_idx" ON "platform_affiliate_payouts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_payouts_status_idx" ON "platform_affiliate_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_affiliate_referrals_affiliate_id_idx" ON "platform_affiliate_referrals" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_referrals_tenant_id_idx" ON "platform_affiliate_referrals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_affiliate_referrals_status_idx" ON "platform_affiliate_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_affiliates_user_id_idx" ON "platform_affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_affiliates_status_idx" ON "platform_affiliates" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_affiliates_slug_idx" ON "platform_affiliates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "platform_affiliates_tier_idx" ON "platform_affiliates" USING btree ("current_tier");