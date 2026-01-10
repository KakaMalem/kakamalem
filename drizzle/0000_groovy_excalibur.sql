CREATE TYPE "public"."affiliate_commission_type" AS ENUM('percentage', 'fixed', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'approved', 'suspended', 'rejected', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."analytics_event_type" AS ENUM('add_to_cart', 'remove_from_cart', 'update_cart_quantity', 'checkout_start', 'checkout_complete', 'order_cancelled', 'search', 'product_click', 'category_click', 'review_submitted');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('free_tier', 'active', 'grace_period', 'suspended', 'forgiven');--> statement-breakpoint
CREATE TYPE "public"."commission_transaction_type" AS ENUM('order_commission', 'payment', 'adjustment', 'forgiveness');--> statement-breakpoint
CREATE TYPE "public"."customer_group_type" AS ENUM('retail', 'wholesale', 'vip');--> statement-breakpoint
CREATE TYPE "public"."delivery_assignment_status" AS ENUM('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_payout_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_provider_status" AS ENUM('pending', 'approved', 'suspended', 'rejected', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."delivery_provider_type" AS ENUM('individual', 'company', 'platform');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('adjustment', 'sale', 'return', 'restock', 'reserved', 'released');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_method_type" AS ENUM('bank_transfer', 'mobile_money', 'cash', 'check', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('user', 'platform_admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."seller_transaction_type" AS ENUM('sale', 'refund', 'commission_fee', 'shipping_fee', 'adjustment', 'payout', 'payout_reversal', 'affiliate_commission', 'hold', 'release');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned');--> statement-breakpoint
CREATE TYPE "public"."shipping_rate_type" AS ENUM('flat', 'per_item', 'weight_based', 'weight_tiered', 'price_based');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'on_backorder');--> statement-breakpoint
CREATE TYPE "public"."tenant_member_role" AS ENUM('owner', 'admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('pending_review', 'active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"visitor_id" varchar(255),
	"session_id" varchar(255),
	"ip_address" varchar(45),
	"referrer" text,
	"user_agent" text,
	"device_type" varchar(20),
	"country_code" varchar(2),
	"city" varchar(100),
	"is_converted" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp with time zone,
	"order_id" uuid,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"partnership_id" uuid NOT NULL,
	"link_id" uuid,
	"click_id" uuid,
	"order_id" uuid NOT NULL,
	"order_total" numeric(14, 2) NOT NULL,
	"order_currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"commission_type" "affiliate_commission_type" NOT NULL,
	"commission_rate" numeric(5, 2),
	"commission_fixed" numeric(12, 2),
	"commission_amount" numeric(14, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"payout_id" uuid,
	"paid_at" timestamp with time zone,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"partnership_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"name" varchar(255),
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"type" "payout_method_type" NOT NULL,
	"label" varchar(100),
	"bank_name" varchar(255),
	"bank_code" varchar(50),
	"account_number" varchar(100),
	"account_name" varchar(255),
	"routing_number" varchar(50),
	"swift_code" varchar(20),
	"iban" varchar(50),
	"mobile_number" varchar(50),
	"mobile_provider" varchar(100),
	"wallet_address" varchar(255),
	"additional_info" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"payout_method_id" uuid,
	"payout_number" varchar(50) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"conversion_count" integer NOT NULL,
	"status" "affiliate_payout_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"external_reference" varchar(255),
	"failure_reason" text,
	"processed_by_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"partnership_id" uuid NOT NULL,
	"rated_by_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"comment" text,
	"communication_rating" integer,
	"quality_rating" integer,
	"professionalism_rating" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"response" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_ratings_rating_check" CHECK (rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE "affiliate_tenant_partnerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"commission_type" "affiliate_commission_type" DEFAULT 'percentage' NOT NULL,
	"commission_rate" numeric(5, 2),
	"commission_fixed" numeric(12, 2),
	"cookie_duration_days" integer DEFAULT 30 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_commission_earned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"website_url" text,
	"social_links" jsonb,
	"niches" jsonb DEFAULT '[]'::jsonb,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_earnings" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_paid_out" numeric(14, 2) DEFAULT '0' NOT NULL,
	"conversion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_rating" numeric(3, 2),
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"active_partnerships" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "analytics_category_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"orders_containing" integer DEFAULT 0 NOT NULL,
	"unique_products_sold" integer DEFAULT 0 NOT NULL,
	"category_views" integer DEFAULT 0 NOT NULL,
	"product_views_in_category" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" "analytics_event_type" NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"visitor_id" varchar(255),
	"user_id" text,
	"product_id" uuid,
	"variant_id" uuid,
	"category_id" uuid,
	"order_id" uuid,
	"cart_id" uuid,
	"quantity" integer,
	"value" numeric(14, 2),
	"search_query" varchar(255),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"gross_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_collected" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discounts_given" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refunds_issued" numeric(14, 2) DEFAULT '0' NOT NULL,
	"commission_accrued" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"cancelled_orders" integer DEFAULT 0 NOT NULL,
	"pending_orders" integer DEFAULT 0 NOT NULL,
	"average_order_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"items_sold" integer DEFAULT 0 NOT NULL,
	"unique_products_sold" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"new_visitors" integer DEFAULT 0 NOT NULL,
	"returning_visitors" integer DEFAULT 0 NOT NULL,
	"cart_creations" integer DEFAULT 0 NOT NULL,
	"checkout_starts" integer DEFAULT 0 NOT NULL,
	"checkout_completions" integer DEFAULT 0 NOT NULL,
	"conversion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"new_customers" integer DEFAULT 0 NOT NULL,
	"returning_customers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_geographic_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"state" varchar(100),
	"city" varchar(100),
	"orders" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"items_sold" integer DEFAULT 0 NOT NULL,
	"shipping_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unique_customers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_hourly_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cart_creations" integer DEFAULT 0 NOT NULL,
	"checkout_starts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"visitor_id" varchar(255),
	"user_id" text,
	"page_type" varchar(50) NOT NULL,
	"page_path" varchar(500) NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"referrer" text,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(255),
	"device_type" varchar(20),
	"browser" varchar(50),
	"os" varchar(50),
	"country_code" varchar(2),
	"city" varchar(100),
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_product_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"orders_containing" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"add_to_cart_count" integer DEFAULT 0 NOT NULL,
	"view_to_cart_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cart_to_purchase_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"revenue_per_view" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reviews_received" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"stock_at_end_of_day" integer DEFAULT 0 NOT NULL,
	"stock_status" "stock_status" DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_traffic_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"source" varchar(100) NOT NULL,
	"medium" varchar(100),
	"campaign" varchar(255),
	"referrer_domain" varchar(255),
	"visitors" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"conversion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" varchar(255),
	"user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"product_id" uuid,
	"commission_rate" numeric(5, 2) NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"min_monthly_revenue" numeric(14, 2),
	"min_monthly_orders" integer,
	"min_account_age_days" integer,
	"commission_rate" numeric(5, 2) NOT NULL,
	"free_shipping_credits" numeric(12, 2),
	"priority_support" boolean DEFAULT false NOT NULL,
	"badge_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "commission_transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"order_id" uuid,
	"description" text,
	"processed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"customer_group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_group_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_group_id" uuid NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"compare_at_price" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "customer_group_type" DEFAULT 'retail' NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"partnership_id" uuid,
	"assignment_number" varchar(50) NOT NULL,
	"status" "delivery_assignment_status" DEFAULT 'pending' NOT NULL,
	"pickup_address" jsonb NOT NULL,
	"pickup_instructions" text,
	"scheduled_pickup_at" timestamp with time zone,
	"actual_pickup_at" timestamp with time zone,
	"delivery_address" jsonb NOT NULL,
	"delivery_instructions" text,
	"estimated_delivery_at" timestamp with time zone,
	"actual_delivery_at" timestamp with time zone,
	"weight_kg" numeric(10, 3),
	"package_count" integer DEFAULT 1 NOT NULL,
	"description" text,
	"delivery_fee" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"provider_earnings" numeric(12, 2) NOT NULL,
	"is_cod" boolean DEFAULT false NOT NULL,
	"cod_amount" numeric(14, 2),
	"cod_collected" boolean DEFAULT false NOT NULL,
	"cod_collected_at" timestamp with time zone,
	"failure_reason" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"delivery_photo_url" text,
	"signature_url" text,
	"recipient_name" varchar(255),
	"driver_notes" text,
	"customer_notes" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"cod_amount" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_payout_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"type" "payout_method_type" NOT NULL,
	"label" varchar(100),
	"bank_name" varchar(255),
	"bank_code" varchar(50),
	"account_number" varchar(100),
	"account_name" varchar(255),
	"routing_number" varchar(50),
	"swift_code" varchar(20),
	"iban" varchar(50),
	"mobile_number" varchar(50),
	"mobile_provider" varchar(100),
	"wallet_address" varchar(255),
	"additional_info" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"payout_method_id" uuid,
	"payout_number" varchar(50) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"delivery_count" integer NOT NULL,
	"cod_collected" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "delivery_payout_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"external_reference" varchar(255),
	"failure_reason" text,
	"processed_by_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_provider_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"state" varchar(100),
	"city" varchar(100),
	"postal_codes" jsonb,
	"base_rate" numeric(12, 2) NOT NULL,
	"per_km_rate" numeric(12, 2),
	"per_kg_rate" numeric(12, 2),
	"min_delivery_hours" integer,
	"max_delivery_hours" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "delivery_provider_type" DEFAULT 'individual' NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"company_name" varchar(255),
	"company_logo" text,
	"business_license" varchar(100),
	"contact_email" varchar(255),
	"contact_phone" varchar(50) NOT NULL,
	"whatsapp_number" varchar(50),
	"address" jsonb,
	"vehicle_type" varchar(50),
	"vehicle_plate" varchar(20),
	"vehicle_capacity_kg" numeric(10, 2),
	"status" "delivery_provider_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"id_document_url" text,
	"license_document_url" text,
	"operating_hours" jsonb,
	"is_available" boolean DEFAULT true NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"completed_deliveries" integer DEFAULT 0 NOT NULL,
	"failed_deliveries" integer DEFAULT 0 NOT NULL,
	"on_time_delivery_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_rating" numeric(3, 2),
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"total_earnings" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_paid_out" numeric(14, 2) DEFAULT '0' NOT NULL,
	"active_partnerships" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_providers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "delivery_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "delivery_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"tenant_id" uuid,
	"rated_by_id" text NOT NULL,
	"rater_type" varchar(20) NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"comment" text,
	"punctuality_rating" integer,
	"handling_rating" integer,
	"communication_rating" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"response" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_ratings_rating_check" CHECK (rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE "delivery_tenant_partnerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" "delivery_provider_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"custom_base_rate" numeric(12, 2),
	"custom_per_km_rate" numeric(12, 2),
	"custom_per_kg_rate" numeric(12, 2),
	"priority" integer DEFAULT 0 NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"completed_deliveries" integer DEFAULT 0 NOT NULL,
	"failed_deliveries" integer DEFAULT 0 NOT NULL,
	"total_earned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"status" "delivery_assignment_status" NOT NULL,
	"description" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_name" varchar(255),
	"photo_url" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"expected_quantity" integer NOT NULL,
	"counted_quantity" integer,
	"variance" integer,
	"is_counted" boolean DEFAULT false NOT NULL,
	"is_adjusted" boolean DEFAULT false NOT NULL,
	"notes" text,
	"counted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"counted_by_id" text,
	"verified_by_id" text,
	"notes" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"incoming" integer DEFAULT 0 NOT NULL,
	"damaged" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5,
	"reorder_point" integer,
	"reorder_quantity" integer,
	"bin_location" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"description" text,
	"address" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"can_fulfill_online" boolean DEFAULT true NOT NULL,
	"contact_name" varchar(255),
	"contact_phone" varchar(50),
	"contact_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"location_id" uuid,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"type" "inventory_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"unit_cost" numeric(12, 2),
	"total_cost" numeric(14, 2),
	"order_id" uuid,
	"shipment_id" uuid,
	"purchase_order_ref" varchar(100),
	"user_id" text,
	"reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"url" text NOT NULL,
	"alt_text" varchar(255),
	"file_name" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_name" varchar(255) NOT NULL,
	"variant_name" varchar(255),
	"sku" varchar(100),
	"price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_number" varchar(30) NOT NULL,
	"user_id" text,
	"store_customer_id" uuid,
	"customer_snapshot" jsonb NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb,
	"subtotal" numeric(12, 2) NOT NULL,
	"shipping_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"customer_notes" text,
	"staff_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"min_quantity" integer NOT NULL,
	"max_quantity" integer,
	"price" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"option_value_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(100),
	"display_name" varchar(255),
	"price" numeric(12, 2),
	"compare_at_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"weight" numeric(10, 3),
	"length" numeric(10, 2),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"description" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"reserved_stock" integer DEFAULT 0 NOT NULL,
	"stock_status" "stock_status" DEFAULT 'in_stock' NOT NULL,
	"image_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"compare_at_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"min_order_quantity" integer DEFAULT 1 NOT NULL,
	"max_order_quantity" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"has_variants" boolean DEFAULT false NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"allow_backorder" boolean DEFAULT false NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"show_stock" boolean DEFAULT false NOT NULL,
	"weight" numeric(10, 3),
	"length" numeric(10, 2),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"order_id" uuid,
	"user_id" text,
	"customer_snapshot" jsonb NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"comment" text,
	"reply_content" text,
	"replied_at" timestamp with time zone,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_check" CHECK (rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE "scheduled_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(255),
	"sale_price" numeric(12, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"available" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pending" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reserved" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lifetime_earnings" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lifetime_paid_out" numeric(14, 2) DEFAULT '0' NOT NULL,
	"current_tier_id" uuid,
	"tier_qualified_at" timestamp with time zone,
	"auto_payout" boolean DEFAULT false NOT NULL,
	"auto_payout_threshold" numeric(12, 2),
	"payout_hold_days" integer DEFAULT 7 NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_balances_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "seller_payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_payout_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "payout_method_type" NOT NULL,
	"label" varchar(100),
	"bank_name" varchar(255),
	"bank_code" varchar(50),
	"account_number" varchar(100),
	"account_name" varchar(255),
	"routing_number" varchar(50),
	"swift_code" varchar(20),
	"iban" varchar(50),
	"mobile_number" varchar(50),
	"mobile_provider" varchar(100),
	"wallet_address" varchar(255),
	"additional_info" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payout_method_id" uuid,
	"payout_number" varchar(50) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"external_reference" varchar(255),
	"failure_reason" text,
	"processed_by_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "seller_transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"available_after" numeric(14, 2) NOT NULL,
	"pending_after" numeric(14, 2) NOT NULL,
	"reserved_after" numeric(14, 2) NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"payout_id" uuid,
	"affiliate_id" uuid,
	"description" text NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" "shipment_status" NOT NULL,
	"location" varchar(255),
	"description" text,
	"event_time" timestamp with time zone DEFAULT now() NOT NULL,
	"is_carrier_update" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"shipping_method_id" uuid,
	"carrier_name" varchar(255),
	"tracking_number" varchar(255),
	"tracking_url" text,
	"shipping_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivery_address" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"min_delivery_days" integer,
	"max_delivery_days" integer,
	"rate_type" "shipping_rate_type" DEFAULT 'flat' NOT NULL,
	"base_rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"per_item_rate" numeric(12, 2),
	"per_kg_rate" numeric(12, 2),
	"free_shipping_threshold" numeric(12, 2),
	"min_weight_kg" numeric(10, 3),
	"max_weight_kg" numeric(10, 3),
	"handling_fee" numeric(12, 2) DEFAULT '0',
	"includes_insurance" boolean DEFAULT false NOT NULL,
	"insurance_rate" numeric(5, 2),
	"includes_tracking" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_weight_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"min_weight_kg" numeric(10, 3) NOT NULL,
	"max_weight_kg" numeric(10, 3),
	"rate" numeric(12, 2) NOT NULL,
	"per_kg_rate_in_tier" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"countries" jsonb,
	"states" jsonb,
	"cities" jsonb,
	"postal_codes" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"internal_notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(14, 2) DEFAULT '0' NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "tenant_member_role" DEFAULT 'staff' NOT NULL,
	"can_manage_products" boolean DEFAULT true NOT NULL,
	"can_manage_orders" boolean DEFAULT true NOT NULL,
	"can_manage_customers" boolean DEFAULT false NOT NULL,
	"can_view_analytics" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"name" varchar(255) NOT NULL,
	"tagline" varchar(255),
	"description" text,
	"logo_url" text,
	"favicon_url" text,
	"header_display" varchar(20) DEFAULT 'logo_and_name',
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"social_links" jsonb,
	"seo" jsonb,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"status" "tenant_status" DEFAULT 'pending_review' NOT NULL,
	"billing_status" "billing_status" DEFAULT 'free_tier' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"commission_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"free_tier_limit" numeric(14, 2) DEFAULT '10000' NOT NULL,
	"free_tier_exceeded_at" timestamp with time zone,
	"grace_period_ends_at" timestamp with time zone,
	"analytics" jsonb DEFAULT '{"totalViews":0,"uniqueVisitors":0,"totalOrders":0,"totalRevenue":0}'::jsonb,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(100),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"latitude" numeric(12, 9) NOT NULL,
	"longitude" numeric(12, 9) NOT NULL,
	"h3_index" varchar(20),
	"plus_code" varchar(20),
	"city" varchar(100),
	"accuracy" numeric(8, 2),
	"source" varchar(10),
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"phone" varchar(50),
	"platform_role" "platform_role" DEFAULT 'user' NOT NULL,
	"preferred_currency" varchar(3) DEFAULT 'AFN',
	"preferred_language" varchar(10) DEFAULT 'fa',
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"value" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) DEFAULT 'My Wishlist' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_partnership_id_affiliate_tenant_partnerships_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."affiliate_tenant_partnerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_click_id_affiliate_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_partnership_id_affiliate_tenant_partnerships_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."affiliate_tenant_partnerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout_methods" ADD CONSTRAINT "affiliate_payout_methods_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_payout_method_id_affiliate_payout_methods_id_fk" FOREIGN KEY ("payout_method_id") REFERENCES "public"."affiliate_payout_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_processed_by_id_user_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_partnership_id_affiliate_tenant_partnerships_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."affiliate_tenant_partnerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_rated_by_id_user_id_fk" FOREIGN KEY ("rated_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_tenant_partnerships" ADD CONSTRAINT "affiliate_tenant_partnerships_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_tenant_partnerships" ADD CONSTRAINT "affiliate_tenant_partnerships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_category_performance" ADD CONSTRAINT "analytics_category_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_category_performance" ADD CONSTRAINT "analytics_category_performance_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_conversion_events" ADD CONSTRAINT "analytics_conversion_events_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily_snapshots" ADD CONSTRAINT "analytics_daily_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_geographic_sales" ADD CONSTRAINT "analytics_geographic_sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_hourly_metrics" ADD CONSTRAINT "analytics_hourly_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_product_performance" ADD CONSTRAINT "analytics_product_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_product_performance" ADD CONSTRAINT "analytics_product_performance_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_traffic_sources" ADD CONSTRAINT "analytics_traffic_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_prices" ADD CONSTRAINT "customer_group_prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_prices" ADD CONSTRAINT "customer_group_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_prices" ADD CONSTRAINT "customer_group_prices_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_partnership_id_delivery_tenant_partnerships_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."delivery_tenant_partnerships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payout_items" ADD CONSTRAINT "delivery_payout_items_payout_id_delivery_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."delivery_payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payout_items" ADD CONSTRAINT "delivery_payout_items_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payout_methods" ADD CONSTRAINT "delivery_payout_methods_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payouts" ADD CONSTRAINT "delivery_payouts_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payouts" ADD CONSTRAINT "delivery_payouts_payout_method_id_delivery_payout_methods_id_fk" FOREIGN KEY ("payout_method_id") REFERENCES "public"."delivery_payout_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_payouts" ADD CONSTRAINT "delivery_payouts_processed_by_id_user_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_provider_zones" ADD CONSTRAINT "delivery_provider_zones_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_providers" ADD CONSTRAINT "delivery_providers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_rated_by_id_user_id_fk" FOREIGN KEY ("rated_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tenant_partnerships" ADD CONSTRAINT "delivery_tenant_partnerships_provider_id_delivery_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."delivery_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tenant_partnerships" ADD CONSTRAINT "delivery_tenant_partnerships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tracking_events" ADD CONSTRAINT "delivery_tracking_events_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."inventory_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_counted_by_id_user_id_fk" FOREIGN KEY ("counted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_verified_by_id_user_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_customer_id_store_customers_id_fk" FOREIGN KEY ("store_customer_id") REFERENCES "public"."store_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_option_value_id_variant_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."variant_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_sales" ADD CONSTRAINT "scheduled_sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_sales" ADD CONSTRAINT "scheduled_sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balances" ADD CONSTRAINT "seller_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balances" ADD CONSTRAINT "seller_balances_current_tier_id_commission_tiers_id_fk" FOREIGN KEY ("current_tier_id") REFERENCES "public"."commission_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payout_items" ADD CONSTRAINT "seller_payout_items_payout_id_seller_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."seller_payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payout_items" ADD CONSTRAINT "seller_payout_items_transaction_id_seller_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."seller_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payout_methods" ADD CONSTRAINT "seller_payout_methods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_payout_method_id_seller_payout_methods_id_fk" FOREIGN KEY ("payout_method_id") REFERENCES "public"."seller_payout_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_processed_by_id_user_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_transactions" ADD CONSTRAINT "seller_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_transactions" ADD CONSTRAINT "seller_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_transactions" ADD CONSTRAINT "seller_transactions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_weight_tiers" ADD CONSTRAINT "shipping_weight_tiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_weight_tiers" ADD CONSTRAINT "shipping_weight_tiers_method_id_shipping_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_option_id_variant_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."variant_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_clicks_link_id_idx" ON "affiliate_clicks" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_affiliate_id_idx" ON "affiliate_clicks" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_tenant_id_idx" ON "affiliate_clicks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_clicked_at_idx" ON "affiliate_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_visitor_id_idx" ON "affiliate_clicks" USING btree ("visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_conversions_order_id_idx" ON "affiliate_conversions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "affiliate_conversions_affiliate_id_idx" ON "affiliate_conversions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_conversions_tenant_id_idx" ON "affiliate_conversions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "affiliate_conversions_status_idx" ON "affiliate_conversions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_conversions_converted_at_idx" ON "affiliate_conversions" USING btree ("converted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_links_code_idx" ON "affiliate_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliate_links_affiliate_id_idx" ON "affiliate_links" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_links_tenant_id_idx" ON "affiliate_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "affiliate_payout_methods_affiliate_id_idx" ON "affiliate_payout_methods" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payouts_payout_number_idx" ON "affiliate_payouts" USING btree ("payout_number");--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliate_id_idx" ON "affiliate_payouts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_payouts_status_idx" ON "affiliate_payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_ratings_partnership_idx" ON "affiliate_ratings" USING btree ("partnership_id");--> statement-breakpoint
CREATE INDEX "affiliate_ratings_affiliate_id_idx" ON "affiliate_ratings" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_tenant_partnerships_affiliate_tenant_idx" ON "affiliate_tenant_partnerships" USING btree ("affiliate_id","tenant_id");--> statement-breakpoint
CREATE INDEX "affiliate_tenant_partnerships_tenant_id_idx" ON "affiliate_tenant_partnerships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "affiliate_tenant_partnerships_status_idx" ON "affiliate_tenant_partnerships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliates_user_id_idx" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "affiliates_status_idx" ON "affiliates" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_slug_idx" ON "affiliates" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_category_perf_tenant_cat_date_idx" ON "analytics_category_performance" USING btree ("tenant_id","category_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "analytics_conversion_events_tenant_id_idx" ON "analytics_conversion_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "analytics_conversion_events_occurred_at_idx" ON "analytics_conversion_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_snapshots_tenant_date_idx" ON "analytics_daily_snapshots" USING btree ("tenant_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_geo_tenant_date_location_idx" ON "analytics_geographic_sales" USING btree ("tenant_id","snapshot_date","country_code","state","city");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_hourly_tenant_hour_idx" ON "analytics_hourly_metrics" USING btree ("tenant_id","hour");--> statement-breakpoint
CREATE INDEX "analytics_page_views_tenant_id_idx" ON "analytics_page_views" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "analytics_page_views_viewed_at_idx" ON "analytics_page_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_product_perf_tenant_product_date_idx" ON "analytics_product_performance" USING btree ("tenant_id","product_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_traffic_tenant_date_source_idx" ON "analytics_traffic_sources" USING btree ("tenant_id","snapshot_date","source","medium");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_product_variant_idx" ON "cart_items" USING btree ("cart_id","product_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_tenant_session_idx" ON "carts" USING btree ("tenant_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_tenant_user_idx" ON "carts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "carts_expires_at_idx" ON "carts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_slug_idx" ON "categories" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "commission_rules_tenant_id_idx" ON "commission_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_rules_category_id_idx" ON "commission_rules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "commission_rules_product_id_idx" ON "commission_rules" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_tiers_name_idx" ON "commission_tiers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "commission_transactions_tenant_id_idx" ON "commission_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_group_members_tenant_user_idx" ON "customer_group_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "customer_group_members_group_idx" ON "customer_group_members" USING btree ("customer_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_group_prices_product_group_idx" ON "customer_group_prices" USING btree ("product_id","customer_group_id");--> statement-breakpoint
CREATE INDEX "customer_group_prices_group_idx" ON "customer_group_prices" USING btree ("customer_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_groups_tenant_name_idx" ON "customer_groups" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "customer_groups_tenant_idx" ON "customer_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_assignments_assignment_number_idx" ON "delivery_assignments" USING btree ("assignment_number");--> statement-breakpoint
CREATE INDEX "delivery_assignments_shipment_id_idx" ON "delivery_assignments" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "delivery_assignments_provider_id_idx" ON "delivery_assignments" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "delivery_assignments_tenant_id_idx" ON "delivery_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_assignments_status_idx" ON "delivery_assignments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_payout_items_payout_assignment_idx" ON "delivery_payout_items" USING btree ("payout_id","assignment_id");--> statement-breakpoint
CREATE INDEX "delivery_payout_items_payout_id_idx" ON "delivery_payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "delivery_payout_methods_provider_id_idx" ON "delivery_payout_methods" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_payouts_payout_number_idx" ON "delivery_payouts" USING btree ("payout_number");--> statement-breakpoint
CREATE INDEX "delivery_payouts_provider_id_idx" ON "delivery_payouts" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "delivery_payouts_status_idx" ON "delivery_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_provider_zones_provider_id_idx" ON "delivery_provider_zones" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "delivery_provider_zones_country_state_city_idx" ON "delivery_provider_zones" USING btree ("country_code","state","city");--> statement-breakpoint
CREATE INDEX "delivery_providers_user_id_idx" ON "delivery_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_providers_status_idx" ON "delivery_providers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_providers_slug_idx" ON "delivery_providers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_ratings_assignment_rater_idx" ON "delivery_ratings" USING btree ("assignment_id","rated_by_id");--> statement-breakpoint
CREATE INDEX "delivery_ratings_provider_id_idx" ON "delivery_ratings" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tenant_partnerships_provider_tenant_idx" ON "delivery_tenant_partnerships" USING btree ("provider_id","tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_tenant_partnerships_tenant_id_idx" ON "delivery_tenant_partnerships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_tenant_partnerships_status_idx" ON "delivery_tenant_partnerships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delivery_tracking_events_assignment_id_idx" ON "delivery_tracking_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "delivery_tracking_events_occurred_at_idx" ON "delivery_tracking_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_count_items_count_product_variant_idx" ON "inventory_count_items" USING btree ("count_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "inventory_count_items_count_id_idx" ON "inventory_count_items" USING btree ("count_id");--> statement-breakpoint
CREATE INDEX "inventory_counts_tenant_id_idx" ON "inventory_counts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_counts_location_id_idx" ON "inventory_counts" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_levels_location_product_variant_idx" ON "inventory_levels" USING btree ("location_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "inventory_levels_product_id_idx" ON "inventory_levels" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_levels_tenant_id_idx" ON "inventory_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_locations_tenant_name_idx" ON "inventory_locations" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "inventory_locations_tenant_active_idx" ON "inventory_locations" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "inventory_movements_tenant_id_idx" ON "inventory_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_id_idx" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_location_id_idx" ON "inventory_movements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_tenant_id_idx" ON "media" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_order_number_idx" ON "orders" USING btree ("tenant_id","order_number");--> statement-breakpoint
CREATE INDEX "orders_tenant_created_idx" ON "orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_store_customer_id_idx" ON "orders" USING btree ("store_customer_id");--> statement-breakpoint
CREATE INDEX "price_tiers_product_idx" ON "price_tiers" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_tiers_product_min_qty_idx" ON "price_tiers" USING btree ("product_id","min_quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_product_category_idx" ON "product_categories" USING btree ("product_id","category_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_id_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_media_idx" ON "product_images" USING btree ("product_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_images_tenant_variant_media_idx" ON "product_variant_images" USING btree ("tenant_id","variant_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_options_variant_value_idx" ON "product_variant_options" USING btree ("variant_id","option_value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_tenant_product_sku_idx" ON "product_variants" USING btree ("tenant_id","product_id","sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_slug_idx" ON "products" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "products_tenant_status_idx" ON "products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_published_at_idx" ON "products" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_media_tenant_review_media_idx" ON "review_media" USING btree ("tenant_id","review_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_product_idx" ON "reviews" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_product_id_idx" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_sales_product_idx" ON "scheduled_sales" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "scheduled_sales_active_dates_idx" ON "scheduled_sales" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "scheduled_sales_tenant_idx" ON "scheduled_sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seller_balances_tenant_id_idx" ON "seller_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_payout_items_payout_transaction_idx" ON "seller_payout_items" USING btree ("payout_id","transaction_id");--> statement-breakpoint
CREATE INDEX "seller_payout_items_payout_id_idx" ON "seller_payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "seller_payout_methods_tenant_id_idx" ON "seller_payout_methods" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_payouts_payout_number_idx" ON "seller_payouts" USING btree ("payout_number");--> statement-breakpoint
CREATE INDEX "seller_payouts_tenant_id_idx" ON "seller_payouts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seller_payouts_status_idx" ON "seller_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seller_payouts_requested_at_idx" ON "seller_payouts" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "seller_transactions_tenant_id_idx" ON "seller_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seller_transactions_order_id_idx" ON "seller_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_transactions_created_at_idx" ON "seller_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seller_transactions_type_idx" ON "seller_transactions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_items_shipment_order_item_idx" ON "shipment_items" USING btree ("shipment_id","order_item_id");--> statement-breakpoint
CREATE INDEX "shipment_items_order_item_id_idx" ON "shipment_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "shipment_tracking_events_shipment_id_idx" ON "shipment_tracking_events" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipments_order_id_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_methods_tenant_zone_name_idx" ON "shipping_methods" USING btree ("tenant_id","zone_id","name");--> statement-breakpoint
CREATE INDEX "shipping_methods_zone_id_idx" ON "shipping_methods" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "shipping_weight_tiers_method_id_idx" ON "shipping_weight_tiers" USING btree ("method_id");--> statement-breakpoint
CREATE INDEX "shipping_weight_tiers_method_weight_idx" ON "shipping_weight_tiers" USING btree ("method_id","min_weight_kg");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_zones_tenant_name_idx" ON "shipping_zones" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "store_customers_tenant_user_idx" ON "store_customers" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "store_customers_user_id_idx" ON "store_customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_customers_tenant_id_idx" ON "store_customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_members_tenant_user_idx" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_members_user_id_idx" ON "tenant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenants_owner_id_idx" ON "tenants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_deleted_at_idx" ON "user_profiles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_option_values_tenant_option_value_idx" ON "variant_option_values" USING btree ("tenant_id","option_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_options_tenant_name_idx" ON "variant_options" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_wishlist_product_variant_idx" ON "wishlist_items" USING btree ("wishlist_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "wishlists_tenant_user_idx" ON "wishlists" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "wishlists_user_id_idx" ON "wishlists" USING btree ("user_id");