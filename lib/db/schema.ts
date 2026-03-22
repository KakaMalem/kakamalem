import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  time,
  date,
  decimal,
  integer,
  boolean,
  uniqueIndex,
  index,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { Polygon } from "geojson";

// ============================================================================
// SHARED TYPES
// ============================================================================

// Address structure for orders and shipments
// Supports both GPS-based (map picker) and standard form (Shopify-style) addresses.
export type Address = {
  firstName: string;
  lastName: string;
  phone: string; // REQUIRED - critical for delivery coordination
  // GPS location (mandatory for GPS mode, 0/0 for standard form mode)
  latitude: number;
  longitude: number;
  // Geospatial indexing (computed on save)
  h3Index?: string; // H3 cell ID at resolution 9 (~175m hexagon) for zone matching
  plusCode?: string; // Google Plus Code for human-readable location (e.g., "8J7XMJRV+97")
  // Reverse geocoded city name (from Nominatim/OpenStreetMap)
  city?: string; // e.g., "Kabul", "Dubai", "London"
  // Location quality metadata
  accuracy?: number; // GPS accuracy in meters when captured
  source?: "gps" | "manual"; // How the location was set
  // Optional notes for delivery (landmarks, directions, building details)
  notes?: string;
  // Standard form fields (Shopify-style) — used when store.checkoutAddressMode = "standard_form"
  addressLine1?: string; // e.g., "123 Main St"
  addressLine2?: string; // e.g., "Apt 4B"
  province?: string; // State / Province / Region
  postalCode?: string; // ZIP / Postal code
  country?: string; // Country code (ISO 3166-1 alpha-2, e.g., "AF", "US")
};

// Preferred contact method for phone links
export type PreferredContactMethod = "phone" | "whatsapp" | "both";

// Social links structure for storefronts
export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  whatsapp?: string; // With country code
  telegram?: string;
  tiktok?: string;
  youtube?: string;
  // WhatsApp settings
  preferredContactMethod?: PreferredContactMethod; // How phone number links behave
  showWhatsAppButton?: boolean; // Show floating WhatsApp button on storefront
};

// SEO metadata structure
export type SeoMetadata = {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string; // URL to social preview image
};

// USDT wallet configuration for self-hosted crypto payments
export type UsdtWalletConfig = {
  trc20?: { address: string; enabled: boolean }; // Tron network - low fees
  erc20?: { address: string; enabled: boolean }; // Ethereum network - high fees
  bep20?: { address: string; enabled: boolean }; // BSC network - low fees
  minAmount?: number; // Minimum USDT amount for payments
  expirationMinutes?: number; // How long payment session is valid (default: 60)
};

// Store analytics (system-managed, read-only)
export type StoreAnalytics = {
  totalViews: number;
  uniqueVisitors: number;
  totalOrders: number;
  totalRevenue: number; // In store's currency
  lastVisitedAt?: string; // ISO timestamp
};

// Customer snapshot for orders/reviews (immutable historical record)
export type CustomerSnapshot = {
  name: string;
  email?: string; // Optional - phone is primary in Afghanistan
  phone?: string; // Optional here, but required for checkout
};

// DNS records configuration for custom domains
export type DomainDnsRecords = {
  // Required CNAME record
  cname: {
    name: string; // e.g., "shop" or "@"
    target: string; // e.g., "proxy.kakamalem.com"
    verified: boolean;
    verifiedAt?: string; // ISO timestamp
  };
  // Required TXT verification record
  txt: {
    name: string; // e.g., "_kakamalem-verify.shop"
    value: string; // e.g., "verify=km_abc123xyz"
    verified: boolean;
    verifiedAt?: string;
  };
  // Optional A record for apex domains
  aRecord?: {
    name: string; // Usually "@"
    ip: string; // Cloudflare IP
    verified: boolean;
    verifiedAt?: string;
  };
  // Last DNS check result
  lastCheck?: {
    timestamp: string;
    success: boolean;
    errors?: string[];
  };
};

// ============================================================================
// ENUMS
// ============================================================================

// Platform-wide role (for Kaka Malem staff)
export const platformRoleEnum = pgEnum("platform_role", [
  "user", // Regular user (can create stores, be customer)
  "platform_admin", // Kaka Malem staff - can see all tenants
  "super_admin", // Full platform access
]);

// Tenant member roles (store staff)
export const tenantMemberRoleEnum = pgEnum("tenant_member_role", [
  "owner",
  "admin",
  "staff",
]);

// Product status (lifecycle)
export const productStatusEnum = pgEnum("product_status", [
  "draft", // Not visible to customers, work in progress
  "active", // Live and visible
  "archived", // Hidden but preserved for historical orders
]);

// Product source (origin of the product data)
export const productSourceTypeEnum = pgEnum("product_source_type", [
  "manual", // Created by store owner
  "aliexpress", // Imported from AliExpress
  "amazon", // Imported from Amazon
  "autods", // Imported/Synced via AutoDS
]);

// Order status
// Order status - Fulfillment/Delivery status (NOT payment status)
// Payment status is tracked separately in paymentStatusEnum
export const orderStatusEnum = pgEnum("order_status", [
  "pending", // Order received, awaiting confirmation
  "confirmed", // Order confirmed, preparing
  "processing", // Being prepared/packed
  "shipped", // Shipped/out for delivery
  "delivered", // Successfully delivered
  "returned", // Package returned (RTO, refused, etc.)
  "cancelled", // Order cancelled
]);

// Inventory & Variant Management Enums
export const stockStatusEnum = pgEnum("stock_status", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "on_backorder",
]);

// Swatch type for variant option values
export const swatchTypeEnum = pgEnum("swatch_type", [
  "text", // Default - just displays the value text
  "color", // Color circle/square with hex color
  "image", // Image thumbnail (for patterns, textures, materials)
]);

// Swatch display size for variant options (sm=20px, md=24px, lg=32px)
export const swatchSizeEnum = pgEnum("swatch_size", ["sm", "md", "lg"]);

// Swatch display shape for variant options
export const swatchShapeEnum = pgEnum("swatch_shape", ["square", "circle"]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "adjustment", // Manual stock adjustment
  "sale", // Stock reduced due to order
  "return", // Stock increased due to return
  "restock", // Stock replenished from supplier
  "reserved", // Stock reserved for pending order
  "released", // Reserved stock released (order cancelled)
]);

// Shipping Enums
export const shippingRateTypeEnum = pgEnum("shipping_rate_type", [
  "flat", // Fixed rate regardless of order
  "per_item", // Base rate + per item charge
  "weight_based", // Base rate + per kg charge
  "weight_tiered", // Freight shipping with weight tiers
  "price_based", // Rate based on order subtotal (e.g., free over $50)
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending", // Shipment created, not yet handed to carrier
  "picked_up", // Carrier has picked up the package
  "in_transit", // Package is on the way
  "out_for_delivery", // Package is out for final delivery
  "delivered", // Successfully delivered
  "failed", // Delivery attempt failed
  "returned", // Package returned to sender
]);

// Store Status Enum
export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending_review", // Just created, awaiting admin approval
  "active", // Live and accepting orders
  "suspended", // Temporarily disabled (by admin or due to billing)
  "inactive", // Disabled by owner or after commission grace period
]);

// Billing Status Enum (DEPRECATED - use subscriptionPlanEnum instead)
// Kept for backward compatibility during migration
export const billingStatusEnum = pgEnum("billing_status", [
  "free_tier", // In free trial period (up to 10,000 AFN commission accrued)
  "active", // Paid and in good standing
  "grace_period", // Free tier exceeded, has 30 days to pay
  "suspended", // Didn't pay, store suspended
  "forgiven", // Debt forgiven (store deactivated, can reactivate by paying)
]);

// Subscription Plan Enum (new subscription model)
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free", // Free tier with limitations (20 products per store)
  "pro", // Pro tier with all features (unlimited products per store)
]);

// Subscription Status Enum
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing", // In free trial period
  "active", // Paid and in good standing
  "past_due", // Payment failed, grace period
  "cancelled", // Subscription cancelled (access until period end)
  "expired", // Trial or subscription expired, needs to upgrade
]);

// Customer Group Type Enum (for tiered pricing)
export const customerGroupTypeEnum = pgEnum("customer_group_type", [
  "retail", // Default customers (regular pricing)
  "wholesale", // Bulk buyers (discounted pricing)
  "vip", // VIP customers (special pricing)
]);

// Commission Transaction Type
export const commissionTransactionTypeEnum = pgEnum(
  "commission_transaction_type",
  [
    "order_commission", // Commission from order
    "payment", // Payment received from store owner
    "adjustment", // Manual adjustment by admin
    "forgiveness", // Debt forgiven (write-off)
  ]
);

// Billing Transaction Type (subscription payments)
export const billingTransactionTypeEnum = pgEnum("billing_transaction_type", [
  "subscription_payment", // Monthly subscription payment
  "subscription_upgrade", // Upgrade from free to pro
  "subscription_downgrade", // Downgrade from pro to free
  "trial_extension", // Admin extended trial
  "refund", // Refund issued
  "credit", // Credit applied to account
  "adjustment", // Manual admin adjustment
]);

// Billing Transaction Status
export const billingTransactionStatusEnum = pgEnum(
  "billing_transaction_status",
  [
    "pending", // Payment initiated but not confirmed
    "completed", // Payment confirmed
    "failed", // Payment failed
    "refunded", // Payment refunded
    "cancelled", // Cancelled before completion
  ]
);

// Invoice Status
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", // Not yet finalized
  "unpaid", // Awaiting payment
  "paid", // Fully paid
  "overdue", // Past due date
  "void", // Cancelled/voided
  "partially_paid", // Partial payment received
]);

// Analytics Event Types
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "add_to_cart",
  "remove_from_cart",
  "update_cart_quantity",
  "checkout_start",
  "checkout_complete",
  "order_cancelled",
  "search",
  "product_click",
  "category_click",
  "review_submitted",
]);

// Delivery Mode - how the store calculates shipping/delivery fees
export const deliveryModeEnum = pgEnum("delivery_mode", [
  "distance_based", // GPS-based zones with distance-tiered pricing (like DoorDash/Talabat)
  "service_level", // Service tiers: Standard, Express, Same-Day (like Amazon)
  "weight_price_based", // Traditional shipping: weight/price-based rates (like Shopify)
]);

// Checkout Address Mode - how the checkout collects the delivery address
export const checkoutAddressModeEnum = pgEnum("checkout_address_mode", [
  "gps", // GPS/map-based location picker (current default)
  "standard_form", // Traditional address form (Shopify-style: street, city, state, zip, country)
]);

// Payment Method - how the customer paid (for offline sales tracking)
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", // Cash payment
  "card", // Credit/debit card
  "mobile_money", // Mobile money (M-Paisa, etc.)
  "bank_transfer", // Bank transfer
  "credit", // Debt/loan - pay later (traditional credit, not credit card)
]);

// Store Mode - how the store operates
export const storeModeEnum = pgEnum("store_mode", [
  "full", // Online + Offline (omnichannel)
  "online_only", // E-commerce only, no POS
  "offline_only", // POS only, no public storefront checkout
  "catalog", // Showcase only, no checkout anywhere (contact for orders)
]);

// ============================================================================
// UNIFIED COMMERCE ENUMS
// ============================================================================

// Order Channel - where the order originated
export const orderChannelEnum = pgEnum("order_channel", [
  "online", // Customer purchased through storefront
  "pos", // Point of sale / in-store
  "social", // Social media order (future)
]);

// Fulfillment Type - how the order is delivered
export const fulfillmentTypeEnum = pgEnum("fulfillment_type", [
  "shipping", // Ship to customer address
  "pickup", // Buy online, pickup in-store (BOPIS)
  "instant", // POS - customer takes items immediately
  "local_delivery", // Same-day local delivery
  "curbside", // Pickup without entering store
]);

// Payment Status - overall payment state of an order
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid", // No payments received
  "partial", // Partially paid
  "paid", // Fully paid
  "refunded", // Fully refunded
  "partial_refund", // Partially refunded
]);

// Transaction Type - type of financial transaction
export const transactionTypeEnum = pgEnum("transaction_type", [
  "payment", // Payment received
  "refund", // Refund issued
  "void", // Transaction voided/cancelled
  "chargeback", // Disputed transaction
  "adjustment", // Manual adjustment
]);

// Transaction Status - state of a transaction
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending", // Awaiting processing
  "completed", // Successfully processed
  "failed", // Processing failed
  "cancelled", // Cancelled before completion
]);

// Refund Type - type of refund
export const refundTypeEnum = pgEnum("refund_type", [
  "full", // Full order refund
  "partial", // Partial refund (some items/amounts)
  "exchange", // Exchange for different item
  "store_credit", // Refund as store credit
  "appeasement", // Goodwill credit without return
]);

// Refund Status - state of a refund request
export const refundStatusEnum = pgEnum("refund_status", [
  "pending", // Awaiting review
  "approved", // Approved, awaiting processing
  "processing", // Being processed
  "completed", // Successfully refunded
  "rejected", // Refund request rejected
]);

// Refund Reason - why the refund was requested
export const refundReasonEnum = pgEnum("refund_reason", [
  "customer_request", // Customer changed mind
  "defective", // Product defective
  "wrong_item", // Wrong item shipped
  "not_as_described", // Product not as described
  "arrived_late", // Delivery too late
  "duplicate_order", // Accidental duplicate
  "fraud", // Fraudulent order
  "other", // Other reason
]);

// Discount Source - where the discount originated
export const discountSourceEnum = pgEnum("discount_source", [
  "coupon", // Promo code applied
  "automatic", // Rule-based automatic discount
  "manual", // Staff-applied discount
  "loyalty", // Loyalty/rewards program
  "employee", // Employee discount
  "price_match", // Price matching competitor
  "negotiated", // Negotiated price (common in Afghan markets)
]);

// Discount Type - how the discount is calculated
export const discountTypeEnum = pgEnum("discount_type", [
  "percentage", // Percentage off
  "fixed_amount", // Fixed amount off
  "free_shipping", // Free shipping
  "buy_x_get_y", // Buy X get Y free/discounted
]);

// Discount Scope - what the discount applies to
export const discountScopeEnum = pgEnum("discount_scope", [
  "order", // Entire order
  "item", // Specific line items
  "shipping", // Shipping charges only
]);

// Item Condition - condition of returned items
export const itemConditionEnum = pgEnum("item_condition", [
  "sellable", // Can be resold as new
  "damaged", // Damaged, cannot resell as new
  "defective", // Manufacturer defect
  "missing", // Item not returned
]);

// Reservation Status - inventory reservation state
export const reservationStatusEnum = pgEnum("reservation_status", [
  "active", // Currently holding inventory
  "committed", // Converted to order
  "released", // Released back to stock
  "expired", // Auto-released after timeout
]);

// Store Credit Source - where store credit originated
export const storeCreditSourceEnum = pgEnum("store_credit_source", [
  "refund", // From a refund
  "gift_card", // Gift card purchase
  "compensation", // Customer service compensation
  "promotion", // Promotional credit
  "loyalty", // Loyalty program reward
]);

// Order Event Category - for filtering events
export const orderEventCategoryEnum = pgEnum("order_event_category", [
  "order", // Order lifecycle events
  "payment", // Payment events
  "fulfillment", // Fulfillment events
  "refund", // Refund events
  "discount", // Discount events
  "note", // Notes/comments
]);

// ============================================================================
// FINANCE & PAYOUT ENUMS
// ============================================================================

// Seller transaction types (for financial ledger)
export const sellerTransactionTypeEnum = pgEnum("seller_transaction_type", [
  "sale", // Revenue from order
  "refund", // Refund issued
  "commission_fee", // Platform commission deducted
  "shipping_fee", // Shipping fee collected
  "adjustment", // Manual adjustment by admin
  "payout", // Money sent to seller
  "payout_reversal", // Failed payout reversed
  "affiliate_commission", // Commission paid to affiliate
  "hold", // Funds held (dispute, review)
  "release", // Held funds released
]);

// Payout status
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending", // Awaiting processing
  "processing", // Being processed
  "completed", // Successfully sent
  "failed", // Failed to process
  "cancelled", // Cancelled before processing
]);

// Payout method types
export const payoutMethodTypeEnum = pgEnum("payout_method_type", [
  "bank_transfer", // Direct bank transfer
  "mobile_money", // M-Pesa, etc.
  "cash", // Cash pickup
  "check", // Physical check
  "crypto", // Cryptocurrency
]);

// ============================================================================
// AFFILIATE SYSTEM ENUMS
// ============================================================================

// Affiliate status
export const affiliateStatusEnum = pgEnum("affiliate_status", [
  "pending", // Application submitted
  "approved", // Active affiliate
  "suspended", // Temporarily disabled
  "rejected", // Application rejected
  "inactive", // Voluntarily inactive
]);

// Affiliate commission type
export const affiliateCommissionTypeEnum = pgEnum("affiliate_commission_type", [
  "percentage", // % of sale
  "fixed", // Fixed amount per sale
  "hybrid", // Base + percentage
]);

// Affiliate payout status (same as general but separate for clarity)
export const affiliatePayoutStatusEnum = pgEnum("affiliate_payout_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// ============================================================================
// PLATFORM AFFILIATE ENUMS (Affiliate program for Kaka Malem itself)
// ============================================================================

// Platform affiliate status (application/account status)
export const platformAffiliateStatusEnum = pgEnum("platform_affiliate_status", [
  "pending", // Application submitted, awaiting review
  "approved", // Approved and can earn commissions
  "suspended", // Account suspended
  "rejected", // Application rejected
]);

// Platform affiliate tier (based on successful referrals)
export const platformAffiliateTierEnum = pgEnum("platform_affiliate_tier", [
  "bronze", // 0-4 referrals: 30% commission
  "silver", // 5-19 referrals: 40% commission
  "gold", // 20+ referrals: 50% commission
]);

// Platform affiliate referral status
export const platformAffiliateReferralStatusEnum = pgEnum(
  "platform_affiliate_referral_status",
  [
    "trial", // Store is in trial period
    "active", // Store has active subscription
    "churned", // Store cancelled/expired
    "completed", // 12-month commission period ended
  ]
);

// Platform affiliate commission status
export const platformAffiliateCommissionStatusEnum = pgEnum(
  "platform_affiliate_commission_status",
  [
    "pending", // 30-day retention not yet met
    "available", // Ready to be paid out
    "paid", // Included in a payout
    "voided", // Commission voided (e.g., refund)
  ]
);

// Platform affiliate payout status
export const platformAffiliatePayoutStatusEnum = pgEnum(
  "platform_affiliate_payout_status",
  [
    "pending", // Requested, awaiting processing
    "processing", // Being processed
    "completed", // Successfully paid
    "failed", // Payment failed
  ]
);

// ============================================================================
// DELIVERY PROVIDER ENUMS
// ============================================================================

// Delivery provider type
export const deliveryProviderTypeEnum = pgEnum("delivery_provider_type", [
  "individual", // Single driver
  "company", // Delivery company with fleet
  "platform", // Platform's own delivery
]);

// Delivery provider status
export const deliveryProviderStatusEnum = pgEnum("delivery_provider_status", [
  "pending", // Application submitted
  "approved", // Active provider
  "suspended", // Temporarily disabled
  "rejected", // Application rejected
  "inactive", // Voluntarily inactive
]);

// Delivery assignment status
export const deliveryAssignmentStatusEnum = pgEnum(
  "delivery_assignment_status",
  [
    "pending", // Awaiting acceptance
    "accepted", // Driver accepted
    "picked_up", // Package picked up
    "in_transit", // On the way
    "delivered", // Successfully delivered
    "failed", // Delivery failed
    "returned", // Returned to sender
    "cancelled", // Assignment cancelled
  ]
);

// Delivery provider payout status
export const deliveryPayoutStatusEnum = pgEnum("delivery_payout_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// Store transfer request status
export const transferRequestStatusEnum = pgEnum("transfer_request_status", [
  "pending", // Waiting for new owner to respond
  "accepted", // Transfer completed
  "rejected", // New owner declined
  "cancelled", // Current owner cancelled
  "expired", // 7 days passed without response
]);

// Custom domain status
export const domainStatusEnum = pgEnum("domain_status", [
  "pending", // Domain added, awaiting DNS configuration
  "dns_verification", // Checking DNS records
  "ssl_provisioning", // DNS verified, provisioning SSL via Cloudflare
  "active", // Fully configured and working
  "error", // Configuration error (see domainError field)
  "suspended", // Manually suspended by admin
]);

// SSL certificate status (via Cloudflare for SaaS)
export const sslStatusEnum = pgEnum("ssl_status", [
  "pending", // Not yet provisioned
  "initializing", // Cloudflare hostname created, starting validation
  "pending_validation", // Waiting for DNS/HTTP validation
  "pending_issuance", // Validated, certificate being issued
  "pending_deployment", // Certificate issued, deploying to edge
  "active", // Valid certificate deployed
  "expiring_soon", // Certificate expires within 30 days
  "expired", // Certificate expired
  "error", // Provisioning failed
]);

// ============================================================================
// BETTER AUTH TABLES (Reference definitions - Better Auth manages these)
// ============================================================================
// These tables are created and managed by Better Auth.
// We define them here so Drizzle knows about them for relations/foreign keys.
// DO NOT manually modify these tables - Better Auth handles all auth logic.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // Hashed password for email/password auth
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// USER PROFILES (Extended user data - your business logic)
// ============================================================================
// Stores platform-specific user data that Better Auth doesn't manage.
// Created automatically when user signs up (via Better Auth hook).
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Additional profile fields
    phone: varchar("phone", { length: 50 }),
    platformRole: platformRoleEnum("platform_role").default("user").notNull(),

    // Preferences
    preferredCurrency: varchar("preferred_currency", { length: 3 }).default(
      "AFN"
    ),
    preferredLanguage: varchar("preferred_language", { length: 10 }).default(
      "fa"
    ), // Dari

    // Soft delete for GDPR compliance
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_profiles_user_id_idx").on(table.userId),
    index("user_profiles_deleted_at_idx").on(table.deletedAt),
  ]
);

// ============================================================================
// USER ADDRESSES (Platform-wide saved addresses)
// ============================================================================
// Users can save addresses that work across ALL stores.
// Example: "Home", "Office", "Parents' house" - usable at any checkout.
// GPS-based system for Afghanistan where traditional addresses aren't reliable.
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Address label (e.g., "Home", "Office", "Mom's House")
    label: varchar("label", { length: 100 }),

    // Contact details
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(), // Required for delivery coordination

    // GPS location (mandatory) - 10 decimal places for ~0.1mm precision
    latitude: decimal("latitude", { precision: 12, scale: 9 }).notNull(),
    longitude: decimal("longitude", { precision: 12, scale: 9 }).notNull(),

    // Geospatial indexing (computed on save)
    h3Index: varchar("h3_index", { length: 20 }), // H3 cell ID for zone matching
    plusCode: varchar("plus_code", { length: 20 }), // Plus Code for human-readable location

    // Reverse geocoded city name
    city: varchar("city", { length: 100 }), // e.g., "Kabul", "Dubai", "London"

    // Location quality metadata
    accuracy: decimal("accuracy", { precision: 8, scale: 2 }), // GPS accuracy in meters
    source: varchar("source", { length: 10 }), // 'gps' or 'manual'

    // Optional notes for delivery (landmarks, directions, building details)
    notes: text("notes"),

    // Default flag
    isDefault: boolean("is_default").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("user_addresses_user_id_idx").on(table.userId)]
);

// ============================================================================
// TENANTS (Stores/Storefronts)
// ============================================================================
// Each tenant is a storefront accessible at: kakamalem.com/store/[slug]
// Features: branding, social links, SEO, analytics, and commission tracking.
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    tagline: varchar("tagline", { length: 255 }), // Short catchy phrase
    description: text("description"),

    // Branding
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"), // Browser tab icon
    headerDisplay: varchar("header_display", { length: 20 }).default(
      "logo_and_name"
    ), // logo_and_name, logo_only, name_only

    // Contact
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),

    // Social & SEO
    socialLinks: jsonb("social_links").$type<SocialLinks>(),
    seo: jsonb("seo").$type<SeoMetadata>(),

    // Settings
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Delivery mode - how the store calculates shipping/delivery fees
    // DEPRECATED: Use enableDeliveryZones instead. Kept for backward compatibility.
    deliveryMode: deliveryModeEnum("delivery_mode")
      .default("distance_based")
      .notNull(),

    // Enable GPS-based delivery zone restrictions
    // When true, customers within a delivery zone see local delivery options
    // The delivery fee comes from the matching zone
    enableDeliveryZones: boolean("enable_delivery_zones")
      .default(false)
      .notNull(),

    // Enable shipping for customers outside delivery zones (or when no zones configured)
    // When true, customers can order from anywhere using configured shipping rates
    // Both can be enabled simultaneously for a hybrid fulfillment model
    enableShipping: boolean("enable_shipping").default(true).notNull(),

    // Checkout address mode - how the checkout collects the delivery address
    // "gps" = GPS/map-based location picker (default, original behavior)
    // "standard_form" = Shopify-style address form (street, city, state, zip, country)
    checkoutAddressMode: checkoutAddressModeEnum("checkout_address_mode")
      .default("gps")
      .notNull(),

    // Store Mode - determines how the store operates
    storeMode: storeModeEnum("store_mode").default("full").notNull(),

    // Channel toggles - fine-grained control over sales channels
    // These override storeMode for specific channels
    onlineCheckoutEnabled: boolean("online_checkout_enabled")
      .default(true)
      .notNull(),
    posEnabled: boolean("pos_enabled").default(true).notNull(),
    posScannerMode: varchar("pos_scanner_mode", { length: 10 })
      .default("camera")
      .notNull(), // 'camera' (phone) or 'usb' (external scanner)
    phoneOrdersEnabled: boolean("phone_orders_enabled").default(true).notNull(),

    // Receipt Settings
    receiptPaperWidth: varchar("receipt_paper_width", { length: 10 })
      .default("80mm")
      .notNull(),
    receiptShowLogo: boolean("receipt_show_logo").default(true).notNull(),
    receiptShowContact: boolean("receipt_show_contact").default(true).notNull(),
    receiptFooterText: varchar("receipt_footer_text", { length: 200 }),
    receiptPrintMode: varchar("receipt_print_mode", { length: 10 })
      .default("prompt")
      .notNull(), // 'disabled' | 'prompt' | 'silent'

    // Status (replaces simple isActive)
    status: tenantStatusEnum("status").default("pending_review").notNull(),

    // ==========================================================================
    // SUBSCRIPTION (New billing model)
    // ==========================================================================
    subscriptionPlan: subscriptionPlanEnum("subscription_plan")
      .default("free")
      .notNull(),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .default("trialing")
      .notNull(),

    // Trial tracking
    trialStartedAt: timestamp("trial_started_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    trialEndsAt: timestamp("trial_ends_at", {
      withTimezone: true,
      mode: "string",
    }), // Set to trialStartedAt + trial_duration_days from platform_settings

    // Subscription period (for paid subscriptions)
    subscriptionStartedAt: timestamp("subscription_started_at", {
      withTimezone: true,
      mode: "string",
    }),
    subscriptionEndsAt: timestamp("subscription_ends_at", {
      withTimezone: true,
      mode: "string",
    }), // Current billing period end

    // Admin notes for manual billing decisions
    subscriptionNotes: text("subscription_notes"),

    // ==========================================================================
    // STRIPE INTEGRATION (for Pro subscriptions)
    // ==========================================================================
    // Stripe customer ID (created when store first upgrades to Pro)
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    // Stripe subscription ID (for recurring billing)
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    // Stripe price ID being subscribed to
    stripePriceId: varchar("stripe_price_id", { length: 255 }),

    // Billing interval (monthly or yearly)
    billingInterval: varchar("billing_interval", { length: 10 })
      .default("monthly")
      .notNull(), // 'monthly' | 'yearly'
    // Stripe yearly price ID (separate from monthly)
    stripeYearlyPriceId: varchar("stripe_yearly_price_id", { length: 255 }),

    // ==========================================================================
    // SUBSCRIPTION PAUSE/RESUME
    // ==========================================================================
    // When subscription was paused (NULL if active)
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "string" }),
    // Reason for pausing
    pauseReason: text("pause_reason"),
    // Optional auto-resume date
    autoResumeAt: timestamp("auto_resume_at", {
      withTimezone: true,
      mode: "string",
    }),
    // Days credited due to pause (extends renewal date on resume)
    pauseCreditsDays: integer("pause_credits_days").default(0),

    // ==========================================================================
    // RENEWAL REMINDERS TRACKING
    // ==========================================================================
    // When the last reminder was sent (avoid duplicates)
    lastReminderSentAt: timestamp("last_reminder_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    // How many days before expiry (7, 3, 1)
    lastReminderDaysBefore: integer("last_reminder_days_before"),

    // ==========================================================================
    // LEGACY: Billing & Commission (DEPRECATED - kept for migration)
    // ==========================================================================
    billingStatus: billingStatusEnum("billing_status")
      .default("free_tier")
      .notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 })
      .default("5.00")
      .notNull(), // 5% default
    commissionBalance: decimal("commission_balance", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(), // Current owed (increased precision)
    freeTierLimit: decimal("free_tier_limit", { precision: 14, scale: 2 })
      .default("10000")
      .notNull(), // 10,000 AFN
    freeTierExceededAt: timestamp("free_tier_exceeded_at", {
      withTimezone: true,
      mode: "string",
    }),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ==========================================================================
    // CUSTOM DOMAIN (Cloudflare for SaaS integration)
    // ==========================================================================
    // The custom domain configured by the store owner (e.g., "shop.mybrand.com")
    customDomain: varchar("custom_domain", { length: 255 }).unique(),

    // Domain configuration status
    customDomainStatus: domainStatusEnum("custom_domain_status").default(
      "pending"
    ),

    // Unique verification token for DNS TXT record (e.g., "km_abc123xyz")
    domainVerificationToken: varchar("domain_verification_token", {
      length: 64,
    }),

    // When DNS was successfully verified
    domainVerifiedAt: timestamp("domain_verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    // SSL certificate status (managed by Cloudflare)
    sslStatus: sslStatusEnum("ssl_status").default("pending"),

    // When SSL certificate was successfully provisioned
    sslProvisionedAt: timestamp("ssl_provisioned_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Cloudflare custom hostname ID (for API operations)
    cloudflareHostnameId: varchar("cloudflare_hostname_id", { length: 64 }),

    // DNS records configuration and verification status
    domainDnsRecords: jsonb("domain_dns_records").$type<DomainDnsRecords>(),

    // Error message when domain configuration fails
    domainError: text("domain_error"),

    // Last time the domain health was checked
    domainLastCheckedAt: timestamp("domain_last_checked_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ==========================================================================
    // STORE LOCATION (Physical store location for POS/offline stores)
    // ==========================================================================
    // GPS coordinates - uses same precision as delivery zones
    storeLocationLat: decimal("store_location_lat", {
      precision: 10,
      scale: 8,
    }),
    storeLocationLng: decimal("store_location_lng", {
      precision: 11,
      scale: 8,
    }),
    // Reverse geocoded city name (from Nominatim/OpenStreetMap)
    storeLocationCity: varchar("store_location_city", { length: 100 }),
    // Location quality metadata
    storeLocationAccuracy: integer("store_location_accuracy"), // GPS accuracy in meters
    storeLocationSource: varchar("store_location_source", { length: 10 }), // 'gps' | 'manual'
    // Plus Code for easy sharing (e.g., "8J7XMJRV+97")
    storeLocationPlusCode: varchar("store_location_plus_code", { length: 20 }),

    // Analytics (system-managed, read-only for owners)
    analytics: jsonb("analytics").$type<StoreAnalytics>().default({
      totalViews: 0,
      uniqueVisitors: 0,
      totalOrders: 0,
      totalRevenue: 0,
    }),

    // ==========================================================================
    // EXTERNAL INTEGRATIONS
    // ==========================================================================
    // API key for AutoDS and other external platforms (Sales Channel API)
    externalApiKey: text("external_api_key").unique(),

    // Ownership - references Better Auth user
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tenants_owner_id_idx").on(table.ownerId),
    index("tenants_status_idx").on(table.status),
    // Index for custom domain lookups (partial - only non-null domains)
    index("tenants_custom_domain_idx").on(table.customDomain),
  ]
);

// ============================================================================
// STORE LOCATIONS (Multiple physical locations per store)
// ============================================================================
// For stores with multiple physical locations (branches, warehouses, pickup points).
// Each location can have its own address, hours, and be used for local pickup.
export const storeLocations = pgTable(
  "store_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Location name/label
    name: varchar("name", { length: 100 }).notNull(), // e.g., "Main Store", "Warehouse", "Kabul Branch"

    // GPS coordinates - uses same precision as delivery zones
    latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),

    // Reverse geocoded city name (from Nominatim/OpenStreetMap)
    city: varchar("city", { length: 100 }),

    // Plus Code for easy sharing (e.g., "8J7XMJRV+97")
    plusCode: varchar("plus_code", { length: 20 }),

    // Location quality metadata
    accuracy: integer("accuracy"), // GPS accuracy in meters
    source: varchar("source", { length: 10 }), // 'gps' | 'manual'

    // Contact info specific to this location
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),

    // Whether this is the primary/default location shown on storefront
    isPrimary: boolean("is_primary").default(false).notNull(),

    // Whether this location is active and shown on the storefront
    isActive: boolean("is_active").default(true).notNull(),

    // Display order for sorting
    displayOrder: integer("display_order").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("store_locations_tenant_id_idx").on(table.tenantId),
    // Primary location lookup
    index("store_locations_primary_idx").on(table.tenantId, table.isPrimary),
  ]
);

// Type export for Store Location
export type StoreLocation = typeof storeLocations.$inferSelect;
export type StoreLocationInsert = typeof storeLocations.$inferInsert;

// ============================================================================
// TENANT MEMBERS (Store staff/collaborators)
// ============================================================================
// Links platform users to stores with specific roles.
// A user can be a member of multiple stores with different roles.
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: tenantMemberRoleEnum("role").default("staff").notNull(),

    // Granular permissions (for staff role customization)
    canManageProducts: boolean("can_manage_products").default(true).notNull(),
    canManageOrders: boolean("can_manage_orders").default(true).notNull(),
    canManageCustomers: boolean("can_manage_customers")
      .default(false)
      .notNull(),
    canViewAnalytics: boolean("can_view_analytics").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One membership per user per tenant
    uniqueIndex("tenant_members_tenant_user_idx").on(
      table.tenantId,
      table.userId
    ),
    // Find all tenants a user belongs to (dashboard sidebar)
    index("tenant_members_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// STORE TRANSFER REQUESTS (Ownership transfer requests)
// ============================================================================
// Tracks ownership transfer requests between users.
// Flow: Current owner initiates → New owner accepts/rejects → Transfer executes
// Requests expire after 7 days if not responded to.
export const storeTransferRequests = pgTable(
  "store_transfer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Store being transferred
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Current owner initiating the transfer
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // New owner receiving the transfer
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Transfer status
    status: transferRequestStatusEnum("status").default("pending").notNull(),

    // Optional message from current owner explaining the transfer
    message: text("message"),

    // Expiration date (7 days from creation)
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    // Only one pending request per store at a time
    uniqueIndex("store_transfer_pending_idx")
      .on(table.tenantId)
      .where(sql`status = 'pending'`),
    // Find all pending requests for a user (as recipient)
    index("store_transfer_to_user_idx").on(table.toUserId, table.status),
    // Find pending requests that need expiration
    index("store_transfer_expires_idx")
      .on(table.expiresAt)
      .where(sql`status = 'pending'`),
  ]
);

// ============================================================================
// PUSH SUBSCRIPTIONS (Browser push notification subscriptions)
// ============================================================================
// Stores Web Push API subscriptions per user per tenant.
// Used for order notifications to store owners/admins.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Web Push subscription data (from browser's PushSubscription.toJSON())
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(), // Public encryption key
    auth: text("auth").notNull(), // Auth secret

    // Device/browser metadata for management UI
    userAgent: text("user_agent"),
    deviceName: varchar("device_name", { length: 100 }), // e.g., "Chrome on Windows"

    // Subscription status tracking
    isActive: boolean("is_active").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),
    failCount: integer("fail_count").default(0).notNull(), // Consecutive failures

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique subscription per endpoint per user per tenant
    uniqueIndex("push_subscriptions_endpoint_user_tenant_idx").on(
      table.endpoint,
      table.userId,
      table.tenantId
    ),
    // Find all subscriptions for a tenant (for sending notifications)
    index("push_subscriptions_tenant_id_idx").on(table.tenantId),
    // Find all subscriptions for a user (for managing devices)
    index("push_subscriptions_user_id_idx").on(table.userId),
    // Find active subscriptions efficiently
    index("push_subscriptions_tenant_active_idx").on(
      table.tenantId,
      table.isActive
    ),
  ]
);

// ============================================================================
// ONBOARDING CHECKLISTS (Getting started guides for new stores)
// ============================================================================
// Tracks onboarding progress for newly created stores.
// Items are personalized based on store mode (online, offline, catalog, full).

// Type for individual checklist items
export type OnboardingChecklistItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  completedAt?: string;
};

export const onboardingChecklists = pgTable(
  "onboarding_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Checklist items stored as JSONB for flexibility
    items: jsonb("items").$type<OnboardingChecklistItem[]>().notNull(),

    // Track overall progress
    completedCount: integer("completed_count").default(0).notNull(),
    totalCount: integer("total_count").default(5).notNull(),

    // Dismissal tracking
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    dismissedAt: timestamp("dismissed_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("onboarding_checklists_tenant_id_idx").on(table.tenantId)]
);

// ============================================================================
// NOTIFICATION PREFERENCES (User & Store-level notification settings)
// ============================================================================
// Enterprise-grade notification system with granular preferences:
// - Global user preferences (quiet hours, channel defaults)
// - Per-store preferences for owners/staff (override globals per store)
// - Customer notification preferences (order updates, marketing)
// - Notification history/feed for in-app notification center

// Notification event types for type safety
export const notificationEventTypes = [
  // Store owner/staff events
  "new_order",
  "order_cancelled",
  "low_stock",
  "out_of_stock",
  "new_review",
  "payment_received",
  "refund_processed",
  "daily_summary",
  // Customer events
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "back_in_stock",
  "price_drop",
  "review_reminder",
  // Store transfer events
  "store_transfer_request", // Sent to new owner when transfer initiated
  "store_transfer_accepted", // Sent to old owner when accepted
  "store_transfer_rejected", // Sent to old owner when rejected
  "store_transfer_cancelled", // Sent to new owner when cancelled
  "store_transfer_expired", // Sent to both parties when expired
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

// User global notification preferences (defaults applied across all stores)
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Quiet hours (do not disturb)
    quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
    quietHoursStart: time("quiet_hours_start"), // e.g., '22:00'
    quietHoursEnd: time("quiet_hours_end"), // e.g., '08:00'
    timezone: varchar("timezone", { length: 50 }).default("Asia/Kabul"),

    // Default channel preferences (can be overridden per store)
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
    pushEnabled: boolean("push_enabled").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    smsEnabled: boolean("sms_enabled").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  }
);

// Store-specific notification preferences for owners/staff
// Overrides userNotificationPreferences for a specific store
export type StoreEventPreferences = Partial<
  Record<
    NotificationEventType,
    {
      inApp?: boolean;
      push?: boolean;
      email?: boolean;
    }
  >
>;

export const storeNotificationPreferences = pgTable(
  "store_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Master switch for this store's notifications
    notificationsEnabled: boolean("notifications_enabled")
      .default(true)
      .notNull(),

    // Event-specific preferences (JSON for flexibility)
    // Example: { "new_order": { "push": true, "email": false } }
    eventPreferences: jsonb("event_preferences")
      .$type<StoreEventPreferences>()
      .default({}),

    // Digest preferences (batch notifications)
    digestEnabled: boolean("digest_enabled").default(false).notNull(),
    digestFrequency: varchar("digest_frequency", { length: 20 }).default(
      "daily"
    ), // 'hourly', 'daily', 'weekly'
    digestTime: time("digest_time").default("09:00"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("store_notification_prefs_user_tenant_idx").on(
      table.userId,
      table.tenantId
    ),
    index("store_notification_prefs_tenant_idx").on(table.tenantId),
  ]
);

// Customer notification preferences per store
export const customerNotificationPreferences = pgTable(
  "customer_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Order update channels
    orderUpdatesPush: boolean("order_updates_push").default(true).notNull(),
    orderUpdatesEmail: boolean("order_updates_email").default(true).notNull(),
    orderUpdatesSms: boolean("order_updates_sms").default(false).notNull(),

    // Promotional/marketing notifications
    promotionalPush: boolean("promotional_push").default(false).notNull(),
    promotionalEmail: boolean("promotional_email").default(false).notNull(),

    // Product alerts
    backInStockEnabled: boolean("back_in_stock_enabled")
      .default(true)
      .notNull(),
    priceDropEnabled: boolean("price_drop_enabled").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("customer_notification_prefs_user_tenant_idx").on(
      table.userId,
      table.tenantId
    ),
    index("customer_notification_prefs_tenant_idx").on(table.tenantId),
  ]
);

// Notification history/feed for in-app display
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Recipient
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }), // NULL for platform-level notifications

    // Content
    type: varchar("type", { length: 50 }).notNull(), // Event type
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().default({}), // Additional payload (order_id, etc.)

    // Actions
    actionUrl: text("action_url"), // Where to navigate on click
    actionLabel: varchar("action_label", { length: 50 }), // Button text

    // Avatar/icon (optional)
    avatarUrl: text("avatar_url"), // e.g., customer avatar, product image

    // State
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Delivery tracking
    channelsSent: jsonb("channels_sent").$type<string[]>().default([]), // ['in_app', 'push', 'email']

    // Novu integration
    novuMessageId: varchar("novu_message_id", { length: 100 }), // For syncing with Novu

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unread notifications for a user
    index("notifications_user_unread_idx").on(table.userId, table.readAt),
    // Notifications per tenant
    index("notifications_tenant_idx").on(table.tenantId),
    // Recent notifications
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);

// ============================================================================
// STORE CUSTOMERS (Tenant-scoped customer metadata)
// ============================================================================
// Stores tenant-specific data about customers. NOT for authentication.
// Created lazily when:
// - User opts into marketing for a store
// - Store staff adds notes/tags about customer
// - User places first order (for stats tracking)
//
// A user can shop WITHOUT a store_customer record (via user.id on orders).
export const storeCustomers = pgTable(
  "store_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Store-specific preferences (NOT duplicating user auth data)
    marketingConsent: boolean("marketing_consent").default(false).notNull(),

    // Store staff notes about this customer
    internalNotes: text("internal_notes"),

    // Customer tags for segmentation ["vip", "wholesale", "new"]
    tags: jsonb("tags").$type<string[]>().default([]),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    // Aggregated order stats (updated on order completion)
    totalOrders: integer("total_orders").default(0).notNull(),
    totalSpent: decimal("total_spent", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    firstOrderAt: timestamp("first_order_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastOrderAt: timestamp("last_order_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One customer record per user per store
    uniqueIndex("store_customers_tenant_user_idx").on(
      table.tenantId,
      table.userId
    ),
    index("store_customers_user_id_idx").on(table.userId),
    index("store_customers_tenant_id_idx").on(table.tenantId),
  ]
);

// ============================================================================
// WISHLISTS (Tenant-scoped, linked to platform user)
// ============================================================================
// Users can create multiple wishlists per store.
// Links directly to user.id (not store_customers).
export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Wishlist name (e.g., "My Wishlist", "Birthday Ideas")
    name: varchar("name", { length: 100 }).default("My Wishlist").notNull(),

    // Is this the default wishlist for the user at this store?
    isDefault: boolean("is_default").default(false).notNull(),

    // Privacy setting (future feature: shareable wishlists)
    isPublic: boolean("is_public").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // User can have multiple wishlists per store
    index("wishlists_tenant_user_idx").on(table.tenantId, table.userId),
    index("wishlists_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// WISHLIST ITEMS (Products in wishlists)
// ============================================================================
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    wishlistId: uuid("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Optional: specific variant wished for
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    // Optional note from user (e.g., "Size M in Blue")
    note: text("note"),
    // When item was added
    addedAt: timestamp("added_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Prevent duplicate products in same wishlist
    uniqueIndex("wishlist_items_wishlist_product_variant_idx").on(
      table.wishlistId,
      table.productId,
      table.variantId
    ),
  ]
);

// ============================================================================
// CATEGORIES
// ============================================================================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageId: uuid("image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("categories_tenant_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ============================================================================
// PRODUCTS
// ============================================================================
// Products can be simple (no variants) or have variants (e.g., T-shirt in S/M/L).
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),

    // Base price (for simple products, this is THE price; for variants, this is display "from" price)
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    // Original price for strikethrough/sale display (e.g., "was $100, now $80")
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }),
    // Wholesale/cost price for profit margin calculations
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }),

    // Order quantity limits
    minOrderQuantity: integer("min_order_quantity").default(1).notNull(),
    maxOrderQuantity: integer("max_order_quantity"), // null = unlimited

    // Stock for simple products (ignored when hasVariants=true)
    stock: integer("stock").default(0).notNull(),

    // Variant configuration
    hasVariants: boolean("has_variants").default(false).notNull(),

    // Identification (for simple products without variants)
    sku: varchar("sku", { length: 100 }), // Internal stock keeping unit
    barcode: varchar("barcode", { length: 50 }), // UPC/EAN/custom barcode for scanning

    // Inventory settings
    trackInventory: boolean("track_inventory").default(true).notNull(),
    allowBackorder: boolean("allow_backorder").default(false).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
    showStock: boolean("show_stock").default(false).notNull(),

    // Shipping weight (in kg) for weight-based shipping calculations
    weight: decimal("weight", { precision: 10, scale: 3 }),
    // Dimensions (in cm) for shipping calculations
    length: decimal("length", { precision: 10, scale: 2 }),
    width: decimal("width", { precision: 10, scale: 2 }),
    height: decimal("height", { precision: 10, scale: 2 }),

    // Display & status
    displayOrder: integer("display_order").default(0).notNull(),
    status: productStatusEnum("status").default("draft").notNull(),

    // External Sourcing & Dropshipping
    sourceType: productSourceTypeEnum("source_type")
      .default("manual")
      .notNull(),
    sourceId: text("source_id"), // Original ID from supplier (ASIN, AliExpress ID, etc.)
    sourceUrl: text("source_url"), // Original product URL
    sourceData: jsonb("source_data"), // Raw API response snapshot
    sourcePrice: decimal("source_price", { precision: 12, scale: 2 }), // Original price at source
    sourceCurrency: varchar("source_currency", { length: 3 }).default("USD"),
    sourceLastSyncedAt: timestamp("source_last_synced_at", {
      withTimezone: true,
      mode: "string",
    }),
    sourceSyncEnabled: boolean("source_sync_enabled").default(true).notNull(),

    // Channel visibility (where the product can be sold)
    showOnStorefront: boolean("show_on_storefront").default(true).notNull(),
    showOnPos: boolean("show_on_pos").default(true).notNull(),

    // Publishing timestamps
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("products_tenant_slug_idx").on(table.tenantId, table.slug),
    index("products_tenant_status_idx").on(table.tenantId, table.status),
    index("products_category_id_idx").on(table.categoryId),
    index("products_published_at_idx").on(table.publishedAt),
    index("products_tenant_sku_idx").on(table.tenantId, table.sku),
    index("products_tenant_barcode_idx").on(table.tenantId, table.barcode),
  ]
);

// ============================================================================
// MEDIA (Centralized media library - tenant-isolated)
// ============================================================================
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 255 }),
    fileName: text("file_name"),
    fileSize: integer("file_size"), // in bytes
    mimeType: varchar("mime_type", { length: 100 }), // image/png, image/jpeg, etc.
    width: integer("width"), // image width in pixels
    height: integer("height"), // image height in pixels
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("media_tenant_id_idx").on(table.tenantId),
    index("media_uploaded_by_idx").on(table.uploadedById),
  ]
);

// ============================================================================
// PRODUCT IMAGES (Junction table linking products to media)
// ============================================================================
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_images_product_media_idx").on(
      table.productId,
      table.mediaId
    ),
  ]
);

// ============================================================================
// PRODUCT CATEGORIES (Junction for many-to-many product-category)
// ============================================================================
export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_categories_product_category_idx").on(
      table.productId,
      table.categoryId
    ),
    index("product_categories_category_id_idx").on(table.categoryId),
  ]
);

// ============================================================================
// VARIANT OPTIONS (Tenant-scoped option types: Size, Color, Material, etc.)
// ============================================================================
export const variantOptions = pgTable(
  "variant_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Size", "Color", "Material"
    displayOrder: integer("display_order").default(0).notNull(),
    // Swatch display settings for this option's values on the storefront
    swatchSize: swatchSizeEnum("swatch_size").default("md").notNull(),
    swatchShape: swatchShapeEnum("swatch_shape").default("square").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("variant_options_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
  ]
);

// ============================================================================
// VARIANT OPTION VALUES (Values for each option: S, M, L, XL for Size)
// ============================================================================
export const variantOptionValues = pgTable(
  "variant_option_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => variantOptions.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 100 }).notNull(), // "S", "M", "L", "Red", "Blue"
    displayOrder: integer("display_order").default(0).notNull(),
    // Swatch configuration for visual display
    swatchType: swatchTypeEnum("swatch_type").default("text").notNull(),
    swatchValue: varchar("swatch_value", { length: 255 }), // Hex color (#FF5733) or media_id for image
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("variant_option_values_tenant_option_value_idx").on(
      table.tenantId,
      table.optionId,
      table.value
    ),
  ]
);

// ============================================================================
// PRODUCT VARIANTS (Actual purchasable SKUs with their own inventory)
// ============================================================================
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 50 }), // UPC/EAN/custom barcode for scanning
    displayName: varchar("display_name", { length: 255 }), // "Blue / XL"
    price: decimal("price", { precision: 12, scale: 2 }), // null = use product price
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }), // Original price for sale display
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }), // Wholesale/cost for margins
    weight: decimal("weight", { precision: 10, scale: 3 }),
    length: decimal("length", { precision: 10, scale: 2 }),
    width: decimal("width", { precision: 10, scale: 2 }),
    height: decimal("height", { precision: 10, scale: 2 }),
    description: text("description"),
    stock: integer("stock").default(0).notNull(),
    reservedStock: integer("reserved_stock").default(0).notNull(),
    stockStatus: stockStatusEnum("stock_status").default("in_stock").notNull(),
    imageId: uuid("image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_variants_tenant_product_sku_idx").on(
      table.tenantId,
      table.productId,
      table.sku
    ),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_tenant_barcode_idx").on(
      table.tenantId,
      table.barcode
    ),
  ]
);

// ============================================================================
// PRODUCT VARIANT IMAGES (Junction table for variant images)
// ============================================================================
export const productVariantImages = pgTable(
  "product_variant_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_variant_images_tenant_variant_media_idx").on(
      table.tenantId,
      table.variantId,
      table.mediaId
    ),
  ]
);

// ============================================================================
// OPTION VALUE IMAGES (Maps option values to their filter images)
// When customer selects "Blue" color, gallery shows blue product images
// ============================================================================
export const optionValueImages = pgTable(
  "option_value_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    optionValueId: uuid("option_value_id")
      .notNull()
      .references(() => variantOptionValues.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("option_value_images_product_value_media_idx").on(
      table.productId,
      table.optionValueId,
      table.mediaId
    ),
    index("option_value_images_product_idx").on(table.productId),
    index("option_value_images_option_value_idx").on(table.optionValueId),
  ]
);

// ============================================================================
// PRODUCT VARIANT OPTIONS (Junction: links variants to their option values)
// ============================================================================
export const productVariantOptions = pgTable(
  "product_variant_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    optionValueId: uuid("option_value_id")
      .notNull()
      .references(() => variantOptionValues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_variant_options_variant_value_idx").on(
      table.variantId,
      table.optionValueId
    ),
  ]
);

// ============================================================================
// PRICE TIERS (Quantity-based pricing)
// ============================================================================
// Volume discounts: different prices based on quantity purchased.
// Example: 1-9 units = $10, 10-49 units = $8, 50+ units = $6
export const priceTiers = pgTable(
  "price_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").notNull(), // e.g., 10
    maxQuantity: integer("max_quantity"), // e.g., 49 (null = unlimited, for "50+" tier)
    price: decimal("price", { precision: 12, scale: 2 }).notNull(), // Fixed price at this tier
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_tiers_product_idx").on(table.productId),
    uniqueIndex("price_tiers_product_min_qty_idx").on(
      table.productId,
      table.minQuantity
    ),
  ]
);

// ============================================================================
// CUSTOMER GROUPS (Per-tenant customer segmentation)
// ============================================================================
// Stores can create customer groups for tiered pricing (retail, wholesale, VIP).
export const customerGroups = pgTable(
  "customer_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // e.g., "Wholesale", "VIP Customers"
    type: customerGroupTypeEnum("type").default("retail").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").default(false).notNull(), // One default per tenant
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("customer_groups_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
    index("customer_groups_tenant_idx").on(table.tenantId),
  ]
);

// ============================================================================
// CUSTOMER GROUP MEMBERS (Junction: users belong to groups per tenant)
// ============================================================================
// A user can be in different customer groups at different stores.
export const customerGroupMembers = pgTable(
  "customer_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    customerGroupId: uuid("customer_group_id")
      .notNull()
      .references(() => customerGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One group per user per tenant
    uniqueIndex("customer_group_members_tenant_user_idx").on(
      table.tenantId,
      table.userId
    ),
    index("customer_group_members_group_idx").on(table.customerGroupId),
  ]
);

// ============================================================================
// CUSTOMER GROUP PRICES (Product pricing per customer group)
// ============================================================================
// Different prices for different customer groups (e.g., wholesale pricing).
export const customerGroupPrices = pgTable(
  "customer_group_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerGroupId: uuid("customer_group_id")
      .notNull()
      .references(() => customerGroups.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("customer_group_prices_product_group_idx").on(
      table.productId,
      table.customerGroupId
    ),
    index("customer_group_prices_group_idx").on(table.customerGroupId),
  ]
);

// ============================================================================
// SALE CAMPAIGNS (Event-based promotional discounts)
// ============================================================================
// Create named sale events (Black Friday, Eid Sale, Summer Sale) that apply
// automatic discounts to the entire store, specific categories, or products.
// Unlike coupons, these apply automatically without a code.

export const saleCampaignScopeEnum = pgEnum("sale_campaign_scope", [
  "store_wide", // Applies to all products
  "categories", // Applies to specific categories
  "products", // Applies to specific products
]);

export const saleCampaignDiscountTypeEnum = pgEnum(
  "sale_campaign_discount_type",
  [
    "percentage", // e.g., 20% off
    "fixed_amount", // e.g., 100 AFN off each item
  ]
);

export const saleCampaigns = pgTable(
  "sale_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Campaign details
    name: varchar("name", { length: 255 }).notNull(), // e.g., "Black Friday 2025"
    description: text("description"), // Internal notes
    slug: varchar("slug", { length: 255 }), // For landing page URL

    // Discount configuration
    discountType: saleCampaignDiscountTypeEnum("discount_type")
      .default("percentage")
      .notNull(),
    discountValue: decimal("discount_value", {
      precision: 12,
      scale: 2,
    }).notNull(), // 20 for 20%, or 100 for 100 AFN

    // Scope: what does this campaign apply to?
    scope: saleCampaignScopeEnum("scope").default("store_wide").notNull(),

    // When scope is 'categories', store category IDs here
    eligibleCategories: jsonb("eligible_categories").$type<string[]>(),

    // When scope is 'products', store product IDs here
    eligibleProducts: jsonb("eligible_products").$type<string[]>(),

    // Excluded products (always excluded even in store_wide campaigns)
    excludedProducts: jsonb("excluded_products").$type<string[]>(),

    // Validity period
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // Minimum purchase (optional)
    minimumOrderAmount: decimal("minimum_order_amount", {
      precision: 12,
      scale: 2,
    }),

    // Display settings
    showBadge: boolean("show_badge").default(true).notNull(), // Show "SALE" badge on products
    badgeText: varchar("badge_text", { length: 50 }), // Custom badge text, e.g., "50% OFF"
    bannerImage: varchar("banner_image", { length: 500 }), // Optional banner for landing page

    // Control
    isActive: boolean("is_active").default(true).notNull(),
    priority: integer("priority").default(0).notNull(), // Higher = takes precedence over other campaigns

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sale_campaigns_tenant_idx").on(table.tenantId),
    index("sale_campaigns_active_dates_idx").on(
      table.isActive,
      table.startsAt,
      table.endsAt
    ),
    index("sale_campaigns_scope_idx").on(table.scope),
    uniqueIndex("sale_campaigns_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ============================================================================
// SCHEDULED SALES (Time-based promotional pricing)
// ============================================================================
// Schedule sale prices with start and end dates (e.g., Black Friday sale).
// NOTE: This is for per-product fixed sale prices. For percentage-based
// event discounts, use sale_campaigns instead.
export const scheduledSales = pgTable(
  "scheduled_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }), // e.g., "Black Friday Sale", "Eid Special"
    salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    isActive: boolean("is_active").default(true).notNull(), // Can manually disable
    priority: integer("priority").default(0).notNull(), // Higher = takes precedence
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scheduled_sales_product_idx").on(table.productId),
    index("scheduled_sales_active_dates_idx").on(
      table.isActive,
      table.startsAt,
      table.endsAt
    ),
    index("scheduled_sales_tenant_idx").on(table.tenantId),
  ]
);

// ============================================================================
// INVENTORY LOCATIONS (Multi-location inventory support)
// ============================================================================
// Stores can have multiple inventory locations (warehouse, store, etc.)
export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }), // Internal reference code
    description: text("description"),

    // Address
    address: jsonb("address").$type<Address>(),

    // Settings
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    canFulfillOnline: boolean("can_fulfill_online").default(true).notNull(), // Can ship from here?

    // Contact
    contactName: varchar("contact_name", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    contactEmail: varchar("contact_email", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_locations_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
    index("inventory_locations_tenant_active_idx").on(
      table.tenantId,
      table.isActive
    ),
  ]
);

// ============================================================================
// INVENTORY LEVELS (Stock per product/variant per location)
// ============================================================================
// Tracks stock at each location. Replaces simple stock field on products/variants.
export const inventoryLevels = pgTable(
  "inventory_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),

    // Stock levels
    available: integer("available").default(0).notNull(), // Ready to sell
    reserved: integer("reserved").default(0).notNull(), // Reserved for pending orders
    incoming: integer("incoming").default(0).notNull(), // Expected from purchase orders
    damaged: integer("damaged").default(0).notNull(), // Damaged/unsellable

    // Reorder settings (per location)
    lowStockThreshold: integer("low_stock_threshold").default(5),
    reorderPoint: integer("reorder_point"), // When to reorder
    reorderQuantity: integer("reorder_quantity"), // How much to reorder

    // Bin/shelf location within the location
    binLocation: varchar("bin_location", { length: 100 }),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One record per product/variant per location
    uniqueIndex("inventory_levels_location_product_variant_idx").on(
      table.locationId,
      table.productId,
      table.variantId
    ),
    index("inventory_levels_product_id_idx").on(table.productId),
    index("inventory_levels_tenant_id_idx").on(table.tenantId),
  ]
);

// ============================================================================
// INVENTORY MOVEMENTS (Audit log for all stock changes)
// ============================================================================
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => inventoryLocations.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),

    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(), // Positive for additions, negative for reductions
    previousStock: integer("previous_stock").notNull(),
    newStock: integer("new_stock").notNull(),

    // Cost tracking for FIFO/LIFO
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }),
    totalCost: decimal("total_cost", { precision: 14, scale: 2 }),

    // References
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    purchaseOrderRef: varchar("purchase_order_ref", { length: 100 }), // External PO reference

    // Who made the change
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_movements_tenant_id_idx").on(table.tenantId),
    index("inventory_movements_product_id_idx").on(table.productId),
    index("inventory_movements_location_id_idx").on(table.locationId),
    index("inventory_movements_created_at_idx").on(table.createdAt),
  ]
);

// ============================================================================
// INVENTORY COUNTS (Stock take / cycle counts)
// ============================================================================
export const inventoryCounts = pgTable(
  "inventory_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),

    // Count metadata
    name: varchar("name", { length: 255 }).notNull(), // "Q1 2025 Full Count"
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, in_progress, completed, cancelled

    // Who performed the count
    countedById: text("counted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    verifiedById: text("verified_by_id").references(() => user.id, {
      onDelete: "set null",
    }),

    notes: text("notes"),

    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_counts_tenant_id_idx").on(table.tenantId),
    index("inventory_counts_location_id_idx").on(table.locationId),
  ]
);

// ============================================================================
// INVENTORY COUNT ITEMS (Individual items in a stock count)
// ============================================================================
export const inventoryCountItems = pgTable(
  "inventory_count_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countId: uuid("count_id")
      .notNull()
      .references(() => inventoryCounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),

    // Counts
    expectedQuantity: integer("expected_quantity").notNull(), // System's count
    countedQuantity: integer("counted_quantity"), // Actual count (null until counted)
    variance: integer("variance"), // countedQuantity - expectedQuantity

    // Status
    isCounted: boolean("is_counted").default(false).notNull(),
    isAdjusted: boolean("is_adjusted").default(false).notNull(), // Has variance been applied?

    notes: text("notes"),
    countedAt: timestamp("counted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("inventory_count_items_count_product_variant_idx").on(
      table.countId,
      table.productId,
      table.variantId
    ),
    index("inventory_count_items_count_id_idx").on(table.countId),
  ]
);

// ============================================================================
// CARTS (Tenant-isolated, linked to platform user)
// ============================================================================
// Each store has separate carts. User checks out one store at a time.
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Guest cart (before login) - uses signed session cookie
    sessionId: varchar("session_id", { length: 255 }),

    // Logged-in user cart - linked to platform user
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

    // Cart expiration (for cleanup jobs)
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Guest cart: one per session per store
    uniqueIndex("carts_tenant_session_idx").on(table.tenantId, table.sessionId),
    // Logged-in cart: one per user per store
    uniqueIndex("carts_tenant_user_idx").on(table.tenantId, table.userId),
    // Cleanup job index
    index("carts_expires_at_idx").on(table.expiresAt),
  ]
);

// ============================================================================
// CART ITEMS
// ============================================================================
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_variant_idx").on(
      table.cartId,
      table.productId,
      table.variantId
    ),
    check("cart_items_quantity_check", sql`quantity > 0`),
  ]
);

// ============================================================================
// ORDERS (Tenant-isolated) - Unified Commerce Model
// ============================================================================
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Human-readable order number (e.g., "KM-2025-000001")
    orderNumber: varchar("order_number", { length: 30 }).notNull(),

    // ========== CHANNEL & FULFILLMENT ==========
    // Where the order originated (online, pos, phone)
    channel: orderChannelEnum("channel").default("online").notNull(),
    // How the order is fulfilled (shipping, pickup, instant, local_delivery, curbside)
    fulfillmentType: fulfillmentTypeEnum("fulfillment_type")
      .default("shipping")
      .notNull(),

    // ========== CUSTOMER ==========
    // Link to platform user (nullable for guest checkout)
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // Optional link to store customer record (for store-specific data)
    storeCustomerId: uuid("store_customer_id").references(
      () => storeCustomers.id,
      {
        onDelete: "set null",
      }
    ),

    // Snapshot of customer info at time of order (immutable historical record)
    customerSnapshot: jsonb("customer_snapshot")
      .$type<CustomerSnapshot>()
      .notNull(),

    // ========== ADDRESSES ==========
    // Structured addresses (shippingAddress nullable for POS/instant sales)
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    billingAddress: jsonb("billing_address").$type<Address>(),

    // ========== FINANCIAL BREAKDOWN (Enhanced) ==========
    // Original item subtotal (before any discounts)
    subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),

    // Shipping & handling
    shippingTotal: decimal("shipping_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Tax
    taxTotal: decimal("tax_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Discount breakdown (for analytics and audit)
    itemDiscountsTotal: decimal("item_discounts_total", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    orderDiscountsTotal: decimal("order_discounts_total", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    shippingDiscountsTotal: decimal("shipping_discounts_total", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    manualDiscountsTotal: decimal("manual_discounts_total", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),

    // Legacy discount total (sum of all discounts, kept for compatibility)
    discountTotal: decimal("discount_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Surcharges (COD fee, handling, etc.)
    surchargesTotal: decimal("surcharges_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Gratuity (tip for delivery/service)
    tipAmount: decimal("tip_amount", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Final total (subtotal - discounts + shipping + tax + surcharges + tip)
    total: decimal("total", { precision: 14, scale: 2 }).notNull(),

    // Currency (ISO 4217 code) - store's base currency
    currencyCode: varchar("currency_code", { length: 3 })
      .default("AFN")
      .notNull(),

    // ========== MULTI-CURRENCY SUPPORT ==========
    // Customer's display/payment currency (if different from store currency)
    customerCurrency: varchar("customer_currency", { length: 3 }),
    // Amount in customer's currency (total converted)
    customerAmount: decimal("customer_amount", { precision: 14, scale: 2 }),
    // Exchange rate at time of order (1 store currency = X customer currency)
    exchangeRateUsed: decimal("exchange_rate_used", {
      precision: 18,
      scale: 10,
    }),
    // When the exchange rate was locked
    exchangeRateLockedAt: timestamp("exchange_rate_locked_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ========== PAYMENT TRACKING (Enhanced) ==========
    // Total amount paid so far
    amountPaid: decimal("amount_paid", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Total amount refunded
    amountRefunded: decimal("amount_refunded", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Computed: total - amountPaid + amountRefunded (stored for query performance)
    // Note: This needs to be maintained by application logic
    amountDue: decimal("amount_due", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Payment status (derived from amounts)
    paymentStatus: paymentStatusEnum("payment_status")
      .default("unpaid")
      .notNull(),

    // Legacy payment fields (kept for backward compatibility)
    paymentMethod: paymentMethodEnum("payment_method"),
    isPaid: boolean("is_paid").default(false).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),

    // ========== STATUS ==========
    status: orderStatusEnum("status").default("pending").notNull(),

    // ========== POS SPECIFIC ==========
    // POS terminal/register identifier
    registerId: varchar("register_id", { length: 50 }),
    // Staff member who processed the sale
    cashierId: text("cashier_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Receipt number for offline/POS sales (e.g., "RCP-2025-000001")
    receiptNumber: varchar("receipt_number", { length: 30 }),

    // ========== LIFECYCLE TIMESTAMPS ==========
    // When the order was placed (different from createdAt for draft orders)
    placedAt: timestamp("placed_at", { withTimezone: true, mode: "string" }),
    // When the order was confirmed
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "string",
    }),
    // When the order was completed/delivered
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    // When the order was cancelled
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ========== NOTES ==========
    customerNotes: text("customer_notes"),
    staffNotes: text("staff_notes"),
    cancellationReason: text("cancellation_reason"),

    // ========== METADATA & TRACKING ==========
    // Client IP for fraud detection
    sourceIp: varchar("source_ip", { length: 45 }), // IPv6 max length
    // User agent string
    userAgent: text("user_agent"),
    // Idempotency key for duplicate prevention
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    // Extensible metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    // ========== VERSIONING & SOFT DELETE ==========
    // Optimistic locking version
    version: integer("version").default(1).notNull(),
    // Soft delete timestamp
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),

    // ========== TIMESTAMPS ==========
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique order number per tenant
    uniqueIndex("orders_tenant_order_number_idx").on(
      table.tenantId,
      table.orderNumber
    ),
    // Idempotency key unique per tenant
    uniqueIndex("orders_tenant_idempotency_idx")
      .on(table.tenantId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
    // Order history queries
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    // Status filtering
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    // User order history (platform-wide)
    index("orders_user_id_idx").on(table.userId),
    // Store customer orders
    index("orders_store_customer_id_idx").on(table.storeCustomerId),
    // Channel filtering
    index("orders_tenant_channel_idx").on(table.tenantId, table.channel),
    // Payment status filtering
    index("orders_tenant_payment_status_idx").on(
      table.tenantId,
      table.paymentStatus
    ),
    // Placed date for reporting
    index("orders_tenant_placed_idx")
      .on(table.tenantId, table.placedAt)
      .where(sql`placed_at IS NOT NULL`),
    // Soft delete filtering
    index("orders_tenant_active_idx")
      .on(table.tenantId, table.status, table.createdAt)
      .where(sql`deleted_at IS NULL`),
    // Amount validation
    check("orders_amount_paid_positive", sql`amount_paid >= 0`),
    check(
      "orders_amount_refunded_valid",
      sql`amount_refunded >= 0 AND amount_refunded <= amount_paid`
    ),
    check("orders_total_positive", sql`total >= 0`),
  ]
);

// ============================================================================
// ORDER ITEMS (Enhanced with fulfillment tracking)
// ============================================================================

// Product snapshot structure for order items (immutable at time of purchase)
export type ProductSnapshot = {
  name: string;
  sku?: string;
  variantName?: string;
  imageUrl?: string;
  attributes?: Record<string, string>; // e.g., { "Size": "M", "Color": "Blue" }
  weight?: number; // Weight in grams
  weightUnit?: "g" | "kg" | "lb" | "oz";
};

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Product reference (nullable if product deleted, but snapshot preserved)
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),

    // ========== SNAPSHOT (Immutable at time of purchase) ==========
    // Full product snapshot as JSON (new, preferred)
    productSnapshot: jsonb("product_snapshot").$type<ProductSnapshot>(),

    // Legacy individual fields (kept for backward compatibility)
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 255 }),
    sku: varchar("sku", { length: 100 }),

    // ========== PRICING ==========
    // Unit price at time of purchase
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    // Original price before any discounts (for showing savings)
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }),
    // Quantity ordered
    quantity: integer("quantity").notNull(),

    // Legacy price field (kept for backward compatibility, same as unitPrice)
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),

    // ========== LINE TOTALS ==========
    // Line subtotal (unitPrice × quantity)
    lineSubtotal: decimal("line_subtotal", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Discount applied to this line item
    discountAmount: decimal("discount_amount", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Tax for this line item
    taxAmount: decimal("tax_amount", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Final line total (lineSubtotal - discountAmount + taxAmount)
    lineTotal: decimal("line_total", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // ========== TAX DETAILS ==========
    // Tax rate applied (e.g., 0.05 for 5%)
    taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).default("0"),
    // Tax code for reporting
    taxCode: varchar("tax_code", { length: 20 }),

    // ========== FULFILLMENT TRACKING ==========
    // How many units have been fulfilled/shipped
    quantityFulfilled: integer("quantity_fulfilled").default(0).notNull(),
    // How many units have been refunded
    quantityRefunded: integer("quantity_refunded").default(0).notNull(),
    // Fulfillment status for this line item
    fulfillmentStatus: varchar("fulfillment_status", { length: 20 })
      .default("unfulfilled")
      .notNull(), // unfulfilled, partial, fulfilled

    // ========== NOTES ==========
    // Special instructions for this item
    notes: text("notes"),

    // ========== METADATA ==========
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    index("order_items_variant_id_idx").on(table.variantId),
    check("order_items_quantity_check", sql`quantity > 0`),
    check(
      "order_items_fulfillment_valid",
      sql`quantity_fulfilled >= 0 AND quantity_fulfilled <= quantity`
    ),
    check(
      "order_items_refund_valid",
      sql`quantity_refunded >= 0 AND quantity_refunded <= quantity`
    ),
  ]
);

// ============================================================================
// ORDER PAYMENTS (Legacy - Track partial payments for credit/unpaid orders)
// NOTE: Use order_transactions for new implementations
// ============================================================================
export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Payment amount
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    // How the payment was made
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    // Optional notes (e.g., "Partial payment", "Final payment")
    notes: text("notes"),
    // Who recorded this payment (staff member)
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_payments_order_id_idx").on(table.orderId),
    check("order_payments_amount_check", sql`amount > 0`),
  ]
);

// ============================================================================
// ORDER TRANSACTIONS (Unified Commerce - Multi-tender payments, refunds, adjustments)
// ============================================================================
export const orderTransactions = pgTable(
  "order_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // ========== TRANSACTION TYPE & AMOUNT ==========
    // Type of transaction
    type: transactionTypeEnum("type").notNull(),
    // Amount (positive for payments, can be negative for adjustments)
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    // Currency
    currencyCode: varchar("currency_code", { length: 3 })
      .default("AFN")
      .notNull(),

    // ========== PAYMENT METHOD ==========
    paymentMethod: paymentMethodEnum("payment_method").notNull(),

    // ========== STATUS ==========
    status: transactionStatusEnum("status").default("pending").notNull(),

    // ========== GATEWAY DETAILS (for card/digital payments) ==========
    // Payment gateway used
    gateway: varchar("gateway", { length: 50 }),
    // Gateway's transaction ID
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 100 }),
    // Full gateway response (for debugging)
    gatewayResponse: jsonb("gateway_response").$type<Record<string, unknown>>(),

    // ========== CARD DETAILS (tokenized, no sensitive data) ==========
    cardLastFour: varchar("card_last_four", { length: 4 }),
    cardBrand: varchar("card_brand", { length: 20 }), // visa, mastercard, etc.

    // ========== REFUND SPECIFIC ==========
    // Link to original payment transaction (for refunds)
    parentTransactionId: uuid("parent_transaction_id"),
    // Link to refund record (if this is a refund transaction)
    refundId: uuid("refund_id"),

    // ========== CASH HANDLING ==========
    // Amount of cash received (for calculating change)
    cashReceived: decimal("cash_received", { precision: 14, scale: 2 }),
    // Change given back to customer
    cashChange: decimal("cash_change", { precision: 14, scale: 2 }),

    // ========== AUTHORIZATION ==========
    // Staff who recorded the transaction
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Manager who authorized (for large transactions)
    authorizedBy: text("authorized_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // ========== IDEMPOTENCY ==========
    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    // ========== TIMESTAMPS ==========
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ========== NOTES ==========
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // ========== METADATA ==========
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_transactions_order_id_idx").on(table.orderId),
    index("order_transactions_tenant_id_idx").on(table.tenantId),
    index("order_transactions_type_idx").on(table.type),
    index("order_transactions_status_idx").on(table.status),
    index("order_transactions_parent_idx").on(table.parentTransactionId),
    index("order_transactions_refund_idx").on(table.refundId),
    uniqueIndex("order_transactions_idempotency_idx")
      .on(table.tenantId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
  ]
);

// ============================================================================
// REFUNDS (Unified Commerce - Full refund workflow)
// ============================================================================
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // ========== REFUND NUMBER ==========
    // Human-readable refund number (e.g., "REF-2026-000001")
    refundNumber: varchar("refund_number", { length: 30 }).notNull(),

    // ========== TYPE & STATUS ==========
    type: refundTypeEnum("type").notNull(),
    status: refundStatusEnum("status").default("pending").notNull(),

    // ========== AMOUNTS ==========
    // Subtotal of items being refunded
    subtotal: decimal("subtotal", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Shipping refund amount
    shippingRefund: decimal("shipping_refund", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Tax refund amount
    taxRefund: decimal("tax_refund", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Restocking fee deducted
    restockingFee: decimal("restocking_fee", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // Total refund amount (subtotal + shipping + tax - restockingFee)
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
    // Currency
    currencyCode: varchar("currency_code", { length: 3 })
      .default("AFN")
      .notNull(),

    // ========== REFUND METHOD ==========
    // How the refund will be issued
    refundMethod: varchar("refund_method", { length: 30 }).notNull(), // original_payment, cash, store_credit, exchange

    // ========== REASON ==========
    reasonCode: refundReasonEnum("reason_code").notNull(),
    reasonDetails: text("reason_details"),

    // ========== CUSTOMER COMMUNICATION ==========
    customerNotes: text("customer_notes"),

    // ========== STAFF PROCESSING ==========
    // Who requested the refund (can be customer or staff)
    requestedBy: text("requested_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Manager who approved
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Staff who processed
    processedBy: text("processed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Staff who rejected
    rejectedBy: text("rejected_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // ========== TIMESTAMPS ==========
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ========== REJECTION ==========
    rejectionReason: text("rejection_reason"),

    // ========== STORE CREDIT ==========
    // If refund issued as store credit, link to the credit record
    storeCreditId: uuid("store_credit_id"),

    // ========== NOTES ==========
    internalNotes: text("internal_notes"),

    // ========== METADATA ==========
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("refunds_tenant_number_idx").on(
      table.tenantId,
      table.refundNumber
    ),
    index("refunds_order_id_idx").on(table.orderId),
    index("refunds_tenant_id_idx").on(table.tenantId),
    index("refunds_status_idx").on(table.status),
    index("refunds_requested_at_idx").on(table.requestedAt),
    check("refunds_total_positive", sql`total_amount >= 0`),
  ]
);

// ============================================================================
// REFUND ITEMS (Items included in a refund)
// ============================================================================
export const refundItems = pgTable(
  "refund_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),

    // ========== QUANTITIES ==========
    // How many units being refunded
    quantity: integer("quantity").notNull(),

    // ========== AMOUNTS ==========
    // Refund amount per unit
    unitRefundAmount: decimal("unit_refund_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Total refund for this line (unitRefundAmount × quantity)
    totalRefundAmount: decimal("total_refund_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // ========== ITEM CONDITION ==========
    // Condition of returned item
    condition: itemConditionEnum("condition").default("sellable").notNull(),

    // ========== INVENTORY ==========
    // Should this item go back to inventory?
    restock: boolean("restock").default(true).notNull(),
    // Specific location to restock to
    restockLocation: varchar("restock_location", { length: 100 }),
    // When the item was restocked
    restockedAt: timestamp("restocked_at", {
      withTimezone: true,
      mode: "string",
    }),

    // ========== NOTES ==========
    // Condition notes, damage description
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("refund_items_refund_id_idx").on(table.refundId),
    index("refund_items_order_item_id_idx").on(table.orderItemId),
    check("refund_items_quantity_positive", sql`quantity > 0`),
  ]
);

// ============================================================================
// COUPONS (Promo codes and discounts)
// ============================================================================
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // ========== CODE & NAME ==========
    // The coupon code (e.g., "SAVE20", "FREESHIP")
    code: varchar("code", { length: 50 }).notNull(),
    // Human-readable name
    name: varchar("name", { length: 100 }).notNull(),
    // Description
    description: text("description"),

    // ========== TYPE & VALUE ==========
    // How the discount is calculated
    type: discountTypeEnum("type").notNull(),
    // Discount value (percentage or fixed amount)
    value: decimal("value", { precision: 12, scale: 2 }).notNull(),

    // ========== SCOPE ==========
    // What the discount applies to
    scope: discountScopeEnum("scope").default("order").notNull(),

    // ========== LIMITS ==========
    // Minimum order amount to apply coupon
    minimumOrderAmount: decimal("minimum_order_amount", {
      precision: 14,
      scale: 2,
    }),
    // Maximum discount amount (cap)
    maximumDiscountAmount: decimal("maximum_discount_amount", {
      precision: 14,
      scale: 2,
    }),

    // ========== USAGE LIMITS ==========
    // Total uses allowed (null = unlimited)
    usageLimit: integer("usage_limit"),
    // Uses per customer (null = unlimited)
    usageLimitPerCustomer: integer("usage_limit_per_customer"),
    // Current usage count
    usageCount: integer("usage_count").default(0).notNull(),

    // ========== VALIDITY ==========
    // When the coupon becomes active
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    // When the coupon expires (null = never)
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),

    // ========== RESTRICTIONS ==========
    // Product IDs this coupon applies to (null = all)
    eligibleProducts: jsonb("eligible_products").$type<string[]>(),
    // Category IDs this coupon applies to (null = all)
    eligibleCategories: jsonb("eligible_categories").$type<string[]>(),
    // Customer group IDs this coupon applies to (null = all)
    eligibleCustomerGroups: jsonb("eligible_customer_groups").$type<string[]>(),
    // Products that cannot use this coupon
    excludedProducts: jsonb("excluded_products").$type<string[]>(),
    // Only for first-time customers
    firstOrderOnly: boolean("first_order_only").default(false).notNull(),

    // ========== COMBINATION RULES ==========
    // Can this coupon be combined with other coupons?
    combinable: boolean("combinable").default(false).notNull(),

    // ========== STATUS ==========
    isActive: boolean("is_active").default(true).notNull(),

    // ========== METADATA ==========
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("coupons_tenant_code_idx").on(table.tenantId, table.code),
    index("coupons_tenant_active_idx").on(
      table.tenantId,
      table.isActive,
      table.startsAt,
      table.expiresAt
    ),
    check("coupons_value_positive", sql`value > 0`),
  ]
);

// ============================================================================
// COUPON USAGES (Track coupon redemptions)
// ============================================================================
export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Customer who used the coupon (null for guest checkout)
    customerId: uuid("customer_id").references(() => storeCustomers.id, {
      onDelete: "set null",
    }),

    // Amount actually discounted
    discountAmount: decimal("discount_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coupon_usages_coupon_order_idx").on(
      table.couponId,
      table.orderId
    ),
    index("coupon_usages_coupon_id_idx").on(table.couponId),
    index("coupon_usages_customer_id_idx").on(table.customerId),
  ]
);

// ============================================================================
// ORDER DISCOUNTS (Applied discounts on orders - audit trail)
// ============================================================================
export const orderDiscounts = pgTable(
  "order_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // If discount applies to specific line item (null = order-level)
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "cascade",
    }),

    // ========== SOURCE ==========
    // Where the discount came from
    source: discountSourceEnum("source").notNull(),
    // Link to coupon if from coupon
    couponId: uuid("coupon_id").references(() => coupons.id, {
      onDelete: "set null",
    }),

    // ========== TYPE & SCOPE ==========
    type: discountTypeEnum("type").notNull(),
    scope: discountScopeEnum("scope").notNull(),

    // ========== VALUE ==========
    // Original value (percentage or fixed)
    value: decimal("value", { precision: 12, scale: 2 }).notNull(),
    // Actual amount discounted
    appliedAmount: decimal("applied_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // ========== DESCRIPTION ==========
    // Display title (e.g., "20% Off Coupon", "Manager Discount")
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description"),

    // ========== MANUAL DISCOUNT AUTHORIZATION ==========
    // Who authorized the discount (for manual discounts)
    authorizedBy: text("authorized_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Reason for the discount
    authorizationReason: text("authorization_reason"),

    // ========== METADATA ==========
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_discounts_order_id_idx").on(table.orderId),
    index("order_discounts_coupon_id_idx").on(table.couponId),
  ]
);

// ============================================================================
// ORDER EVENTS (Event sourcing / audit trail)
// ============================================================================
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // ========== EVENT TYPE ==========
    // Event type (e.g., "order.created", "payment.received", "refund.completed")
    eventType: varchar("event_type", { length: 50 }).notNull(),
    // Category for filtering
    eventCategory: orderEventCategoryEnum("event_category"),

    // ========== ACTOR ==========
    // Who/what triggered the event
    actorType: varchar("actor_type", { length: 20 }).notNull(), // customer, staff, system, webhook
    // User ID if applicable
    actorId: text("actor_id"),
    // Name snapshot for display
    actorName: varchar("actor_name", { length: 100 }),

    // ========== EVENT DATA ==========
    // Event-specific payload
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),

    // ========== STATE SNAPSHOTS ==========
    // State before the event (for reversibility)
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    // State after the event
    newState: jsonb("new_state").$type<Record<string, unknown>>(),

    // ========== IDEMPOTENCY ==========
    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    // ========== TIMESTAMP ==========
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_events_order_id_idx").on(table.orderId, table.occurredAt),
    index("order_events_tenant_idx").on(table.tenantId, table.occurredAt),
    index("order_events_type_idx").on(table.eventType),
    uniqueIndex("order_events_idempotency_idx")
      .on(table.orderId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
  ]
);

// ============================================================================
// ORDER INVOICE TOKENS (Shareable invoice links)
// ============================================================================
// Allows customers to share invoice links via WhatsApp, SMS, etc.
// Token-based access without requiring authentication.
export const orderInvoiceTokens = pgTable(
  "order_invoice_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Secure random token (256-bit, URL-safe base64)
    token: varchar("token", { length: 64 }).notNull().unique(),

    // Optional expiration (null = never expires)
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),

    // Access tracking
    accessCount: integer("access_count").default(0).notNull(),
    lastAccessedAt: timestamp("last_accessed_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Token metadata
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_invoice_tokens_order_id_idx").on(table.orderId),
    index("order_invoice_tokens_tenant_id_idx").on(table.tenantId),
    uniqueIndex("order_invoice_tokens_token_idx").on(table.token),
  ]
);

// ============================================================================
// INVENTORY RESERVATIONS (Prevent overselling)
// ============================================================================
export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // ========== PRODUCT ==========
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),

    // ========== RESERVATION DETAILS ==========
    // Quantity reserved
    quantity: integer("quantity").notNull(),

    // ========== SOURCE ==========
    // What created this reservation
    sourceType: varchar("source_type", { length: 20 }).notNull(), // cart, order, draft_order
    // ID of the source (cart ID, order ID, etc.)
    sourceId: uuid("source_id").notNull(),

    // ========== STATUS ==========
    status: reservationStatusEnum("status").default("active").notNull(),

    // ========== EXPIRATION ==========
    // When this reservation auto-releases
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // ========== TIMESTAMPS ==========
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    // When reservation was committed to order
    committedAt: timestamp("committed_at", {
      withTimezone: true,
      mode: "string",
    }),
    // When reservation was released
    releasedAt: timestamp("released_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("inventory_reservations_product_idx").on(
      table.productId,
      table.variantId
    ),
    index("inventory_reservations_source_idx").on(
      table.sourceType,
      table.sourceId
    ),
    index("inventory_reservations_expires_idx")
      .on(table.expiresAt)
      .where(sql`status = 'active'`),
    index("inventory_reservations_tenant_idx").on(table.tenantId),
    check("inventory_reservations_quantity_positive", sql`quantity > 0`),
  ]
);

// ============================================================================
// STORE CREDITS (Customer credit balances)
// ============================================================================
export const storeCredits = pgTable(
  "store_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => storeCustomers.id, { onDelete: "cascade" }),

    // ========== CODE ==========
    // Unique code (e.g., "SC-XXXXXX")
    code: varchar("code", { length: 20 }).notNull(),

    // ========== BALANCE ==========
    // Original amount issued
    originalAmount: decimal("original_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    // Current balance
    balance: decimal("balance", { precision: 14, scale: 2 }).notNull(),
    // Currency
    currencyCode: varchar("currency_code", { length: 3 })
      .default("AFN")
      .notNull(),

    // ========== SOURCE ==========
    // Where this credit came from
    sourceType: storeCreditSourceEnum("source_type").notNull(),
    // Link to source (refund ID, etc.)
    sourceId: uuid("source_id"),

    // ========== VALIDITY ==========
    // When the credit expires (null = never)
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),

    // ========== STATUS ==========
    isActive: boolean("is_active").default(true).notNull(),

    // ========== NOTES ==========
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("store_credits_tenant_code_idx").on(table.tenantId, table.code),
    index("store_credits_customer_idx").on(table.customerId),
    index("store_credits_tenant_idx").on(table.tenantId),
    check(
      "store_credits_balance_valid",
      sql`balance >= 0 AND balance <= original_amount`
    ),
  ]
);

// ============================================================================
// STORE CREDIT TRANSACTIONS (Credit usage ledger)
// ============================================================================
export const storeCreditTransactions = pgTable(
  "store_credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeCreditId: uuid("store_credit_id")
      .notNull()
      .references(() => storeCredits.id, { onDelete: "cascade" }),

    // ========== TRANSACTION TYPE ==========
    // credit = adding balance, debit = using balance
    type: varchar("type", { length: 20 }).notNull(), // credit, debit, refund, expiry

    // ========== AMOUNT ==========
    // Positive for credit, negative for debit
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),

    // ========== BALANCE AFTER ==========
    // Balance after this transaction
    balanceAfter: decimal("balance_after", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // ========== REFERENCE ==========
    // Link to order if used for purchase
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),

    // ========== NOTES ==========
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("store_credit_transactions_credit_id_idx").on(table.storeCreditId),
    index("store_credit_transactions_order_id_idx").on(table.orderId),
  ]
);

// ============================================================================
// SHIPPING ZONES (Geographic regions for shipping)
// ============================================================================
export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    countries: jsonb("countries").$type<string[]>(), // ["AF", "PK", "IR"]
    states: jsonb("states").$type<string[]>(),
    cities: jsonb("cities").$type<string[]>(),
    postalCodes: jsonb("postal_codes").$type<string[]>(),
    priority: integer("priority").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("shipping_zones_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
  ]
);

// ============================================================================
// DELIVERY ZONES (GPS-based circular delivery areas)
// ============================================================================
// Store owners define circular delivery zones around their location.
// Customers outside all zones cannot place orders.
// Multiple zones allow tiered pricing (e.g., 0-3km free, 3-7km 50 AFN, 7-15km 100 AFN).
// Zone matching uses smallest containing zone for best customer rate.
export const deliveryZoneTypeEnum = pgEnum("delivery_zone_type", [
  "circle", // Simple radius from center point
  "polygon", // Custom polygon shape (future)
]);

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Free Delivery", "Standard", "Extended"

    // Zone geometry
    zoneType: deliveryZoneTypeEnum("zone_type").default("circle").notNull(),

    // Circle parameters (when zoneType = 'circle')
    centerLat: decimal("center_lat", { precision: 10, scale: 8 }), // Latitude of center
    centerLng: decimal("center_lng", { precision: 11, scale: 8 }), // Longitude of center
    radiusMeters: integer("radius_meters"), // Radius in meters

    // Polygon parameters (when zoneType = 'polygon', for future use)
    // GeoJSON polygon coordinates: [[lng, lat], [lng, lat], ...]
    polygonCoordinates: jsonb("polygon_coordinates").$type<number[][]>(),

    // Delivery settings
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }), // Minimum order to deliver here
    freeShippingThreshold: decimal("free_shipping_threshold", {
      precision: 12,
      scale: 2,
    }), // Order amount above which delivery is free
    estimatedDeliveryTime: varchar("estimated_delivery_time", { length: 50 }), // "30-45 minutes"

    // Display & status
    displayOrder: integer("display_order").default(0).notNull(), // Lower = checked first (smaller zones first)
    isActive: boolean("is_active").default(true).notNull(),
    color: varchar("color", { length: 7 }).default("#3b82f6"), // Hex color for map display

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_zones_tenant_id_idx").on(table.tenantId),
    index("delivery_zones_active_idx").on(table.tenantId, table.isActive),
  ]
);

// ============================================================================
// SHIPPING METHODS (Delivery options per zone)
// ============================================================================
// Supports multiple rate models:
// - flat: Fixed baseRate regardless of order
// - per_item: baseRate + (perItemRate × quantity)
// - weight_based: baseRate + (perKgRate × totalWeightKg)
// - weight_tiered: Uses shippingWeightTiers for different weight ranges
// - price_based: Free if order > freeShippingThreshold, else baseRate
export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // Delivery time estimates
    minDeliveryDays: integer("min_delivery_days"),
    maxDeliveryDays: integer("max_delivery_days"),

    // Rate configuration
    rateType: shippingRateTypeEnum("rate_type").default("flat").notNull(),

    // Base/flat rate (used by all rate types)
    baseRate: decimal("base_rate", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),

    // Per-item rate (for per_item type)
    perItemRate: decimal("per_item_rate", { precision: 12, scale: 2 }),

    // Per-kg rate (for weight_based type)
    perKgRate: decimal("per_kg_rate", { precision: 12, scale: 2 }),

    // Free shipping threshold (for price_based type, also optional on others)
    freeShippingThreshold: decimal("free_shipping_threshold", {
      precision: 12,
      scale: 2,
    }),

    // Weight limits
    minWeight: decimal("min_weight_kg", { precision: 10, scale: 3 }), // Min weight for this method
    maxWeight: decimal("max_weight_kg", { precision: 10, scale: 3 }), // Max weight for this method

    // Handling fee (added on top of calculated rate)
    handlingFee: decimal("handling_fee", { precision: 12, scale: 2 }).default(
      "0"
    ),

    // Insurance
    includesInsurance: boolean("includes_insurance").default(false).notNull(),
    insuranceRate: decimal("insurance_rate", { precision: 5, scale: 2 }), // % of order value

    // Tracking
    includesTracking: boolean("includes_tracking").default(true).notNull(),

    // Display
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("shipping_methods_tenant_zone_name_idx").on(
      table.tenantId,
      table.zoneId,
      table.name
    ),
    index("shipping_methods_zone_id_idx").on(table.zoneId),
  ]
);

// ============================================================================
// SHIPPING WEIGHT TIERS (For weight_tiered shipping methods)
// ============================================================================
// Example: 0-5kg = $10, 5-10kg = $15, 10-20kg = $25, 20kg+ = $40
export const shippingWeightTiers = pgTable(
  "shipping_weight_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    methodId: uuid("method_id")
      .notNull()
      .references(() => shippingMethods.id, { onDelete: "cascade" }),

    // Weight range (in kg)
    minWeight: decimal("min_weight_kg", { precision: 10, scale: 3 }).notNull(),
    maxWeight: decimal("max_weight_kg", { precision: 10, scale: 3 }), // null = unlimited

    // Rate for this tier
    rate: decimal("rate", { precision: 12, scale: 2 }).notNull(),

    // Optional per-kg rate within tier (for incremental pricing within tier)
    perKgRateInTier: decimal("per_kg_rate_in_tier", {
      precision: 12,
      scale: 2,
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipping_weight_tiers_method_id_idx").on(table.methodId),
    // Order by min weight for tier lookup
    index("shipping_weight_tiers_method_weight_idx").on(
      table.methodId,
      table.minWeight
    ),
  ]
);

// ============================================================================
// SHIPMENTS (Actual shipments for orders)
// ============================================================================
export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shippingMethodId: uuid("shipping_method_id").references(
      () => shippingMethods.id,
      {
        onDelete: "set null",
      }
    ),
    carrierName: varchar("carrier_name", { length: 255 }),
    trackingNumber: varchar("tracking_number", { length: 255 }),
    trackingUrl: text("tracking_url"),
    shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    status: shipmentStatusEnum("status").default("pending").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "string" }),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "string",
    }),
    deliveryAddress: jsonb("delivery_address").$type<Address>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("shipments_order_id_idx").on(table.orderId)]
);

// ============================================================================
// SHIPMENT ITEMS (Junction: which order items are in which shipment)
// ============================================================================
export const shipmentItems = pgTable(
  "shipment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("shipment_items_shipment_order_item_idx").on(
      table.shipmentId,
      table.orderItemId
    ),
    index("shipment_items_order_item_id_idx").on(table.orderItemId),
    check("shipment_items_quantity_check", sql`quantity > 0`),
  ]
);

// ============================================================================
// SHIPMENT TRACKING EVENTS
// ============================================================================
export const shipmentTrackingEvents = pgTable(
  "shipment_tracking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: shipmentStatusEnum("status").notNull(),
    location: varchar("location", { length: 255 }),
    description: text("description"),
    eventTime: timestamp("event_time", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    isCarrierUpdate: boolean("is_carrier_update").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipment_tracking_events_shipment_id_idx").on(table.shipmentId),
  ]
);

// ============================================================================
// UNIFIED DELIVERY SYSTEM
// ============================================================================
// New unified system that combines local GPS zones + country shipping zones
// Supports: polygon, radius, postal, city, region, country, worldwide
// Uses zone specificity scoring for accurate delivery matching

export const unifiedZoneTypeEnum = pgEnum("unified_zone_type", [
  "polygon", // Custom drawn polygon
  "radius", // Circle around a point
  "postal", // Postal code patterns
  "city", // City name + country
  "region", // State/province
  "country", // Full country
  "worldwide", // Global fallback
]);

export const deliveryMethodTypeEnum = pgEnum("delivery_method_type", [
  "local_delivery", // Same-day/fast local delivery
  "standard", // Standard shipping (3-7 days)
  "express", // Express/priority shipping
  "pickup", // Store pickup / customer collects
  "custom", // Custom method
]);

export const rateCalculationTypeEnum = pgEnum("rate_calculation_type", [
  "flat", // Fixed rate
  "per_item", // Rate × quantity
  "weight_based", // Rate × weight
  "weight_tiered", // Different rates for weight ranges
  "price_based", // Rate based on order subtotal
  "free", // Always free
]);

export const unifiedDeliveryZones = pgTable(
  "unified_delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Kabul City", "Afghanistan", "Europe"

    // Zone type and specificity
    zoneType: unifiedZoneTypeEnum("zone_type").notNull(),
    // Higher = more specific = checked first (polygon: 600, radius: 500, postal: 400, city: 300, region: 200, country: 100, worldwide: 10)
    specificityScore: integer("specificity_score").notNull(),

    // Polygon zone data (when zoneType = 'polygon')
    polygonGeojson: jsonb("polygon_geojson").$type<Polygon>(),

    // Radius zone data (when zoneType = 'radius')
    centerLat: decimal("center_lat", { precision: 10, scale: 8 }),
    centerLng: decimal("center_lng", { precision: 11, scale: 8 }),
    radiusMeters: integer("radius_meters"),

    // Location-based zone data (when zoneType = 'postal', 'city', 'region', 'country')
    // Countries stored as ISO 3166-1 alpha-2 codes (e.g., ['AF', 'IR', 'PK'])
    countries: jsonb("countries").$type<string[]>().default([]),
    // Regions/states (e.g., ['CA', 'NY', 'TX'])
    regions: jsonb("regions").$type<string[]>().default([]),
    // Cities (e.g., ['Kabul', 'Mazar-i-Sharif'])
    cities: jsonb("cities").$type<string[]>().default([]),
    // Postal code patterns (e.g., ['10001', '100*', '1001-1005'])
    postalPatterns: jsonb("postal_patterns").$type<string[]>().default([]),

    // Display settings
    color: varchar("color", { length: 7 }).default("#3b82f6"),
    displayOrder: integer("display_order").default(0).notNull(),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("unified_zones_tenant_id_idx").on(table.tenantId),
    index("unified_zones_tenant_active_idx").on(table.tenantId, table.isActive),
    // Index for zone matching - sorted by specificity (highest first)
    index("unified_zones_tenant_specificity_idx").on(
      table.tenantId,
      table.specificityScore
    ),
  ]
);

export const unifiedDeliveryMethods = pgTable(
  "unified_delivery_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => unifiedDeliveryZones.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(), // "Standard Delivery", "Express", "Pickup"
    description: text("description"),

    // Method type
    methodType: deliveryMethodTypeEnum("method_type").notNull(),

    // Delivery time estimates
    minDeliveryDays: integer("min_delivery_days"),
    maxDeliveryDays: integer("max_delivery_days"),
    estimatedTime: varchar("estimated_time", { length: 50 }), // "30-45 minutes" for local

    // Rate calculation
    rateType: rateCalculationTypeEnum("rate_type").default("flat").notNull(),
    baseRate: decimal("base_rate", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    perItemRate: decimal("per_item_rate", { precision: 12, scale: 2 }),
    perKgRate: decimal("per_kg_rate", { precision: 12, scale: 2 }),

    // Thresholds
    freeShippingThreshold: decimal("free_shipping_threshold", {
      precision: 12,
      scale: 2,
    }),
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }),

    // Weight limits
    minWeight: decimal("min_weight_kg", { precision: 10, scale: 3 }),
    maxWeight: decimal("max_weight_kg", { precision: 10, scale: 3 }),

    // Handling and insurance
    handlingFee: decimal("handling_fee", { precision: 12, scale: 2 }).default(
      "0"
    ),
    includesInsurance: boolean("includes_insurance").default(false).notNull(),
    insuranceRate: decimal("insurance_rate", { precision: 5, scale: 2 }),
    includesTracking: boolean("includes_tracking").default(true).notNull(),

    // Pickup location (when methodType = 'pickup')
    pickupLocationName: varchar("pickup_location_name", { length: 255 }),
    pickupLocationAddress: text("pickup_location_address"),
    pickupLocationLat: decimal("pickup_location_lat", {
      precision: 10,
      scale: 8,
    }),
    pickupLocationLng: decimal("pickup_location_lng", {
      precision: 11,
      scale: 8,
    }),

    // Display settings
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("unified_methods_tenant_zone_name_idx").on(
      table.tenantId,
      table.zoneId,
      table.name
    ),
    index("unified_methods_zone_id_idx").on(table.zoneId),
    index("unified_methods_tenant_active_idx").on(
      table.tenantId,
      table.isActive
    ),
  ]
);

export const unifiedWeightTiers = pgTable(
  "unified_weight_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    methodId: uuid("method_id")
      .notNull()
      .references(() => unifiedDeliveryMethods.id, { onDelete: "cascade" }),

    // Weight range (in kg)
    minWeight: decimal("min_weight_kg", { precision: 10, scale: 3 }).notNull(),
    maxWeight: decimal("max_weight_kg", { precision: 10, scale: 3 }), // null = unlimited

    // Rate for this tier
    rate: decimal("rate", { precision: 12, scale: 2 }).notNull(),

    // Optional per-kg rate within tier (for incremental pricing)
    perKgRateInTier: decimal("per_kg_rate_in_tier", {
      precision: 12,
      scale: 2,
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("unified_weight_tiers_method_id_idx").on(table.methodId),
    index("unified_weight_tiers_method_weight_idx").on(
      table.methodId,
      table.minWeight
    ),
  ]
);

// ============================================================================
// REVIEWS (Product reviews by users)
// ============================================================================
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),

    // Link to platform user
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // Snapshot of reviewer info (immutable)
    customerSnapshot: jsonb("customer_snapshot")
      .$type<CustomerSnapshot>()
      .notNull(),

    // Review content
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    comment: text("comment"),

    // Store owner response
    replyContent: text("reply_content"),
    repliedAt: timestamp("replied_at", { withTimezone: true, mode: "string" }),

    // Verification
    isVerifiedPurchase: boolean("is_verified_purchase")
      .default(false)
      .notNull(),

    // Edit tracking
    isEdited: boolean("is_edited").default(false).notNull(),

    // Helpful votes (denormalized for performance)
    helpfulVotesUp: integer("helpful_votes_up").default(0).notNull(),
    helpfulVotesDown: integer("helpful_votes_down").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One review per product per order
    uniqueIndex("reviews_order_product_idx").on(table.orderId, table.productId),
    index("reviews_product_id_idx").on(table.productId),
    index("reviews_user_id_idx").on(table.userId),
    index("reviews_tenant_helpful_idx").on(
      table.tenantId,
      table.helpfulVotesUp
    ), // For "most helpful" sorting
    check("reviews_rating_check", sql`rating >= 1 AND rating <= 5`),
  ]
);

// ============================================================================
// REVIEW MEDIA (Customer-uploaded review images)
// ============================================================================
export const reviewMedia = pgTable(
  "review_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("review_media_tenant_review_media_idx").on(
      table.tenantId,
      table.reviewId,
      table.mediaId
    ),
  ]
);

// ============================================================================
// REVIEW VOTES (Track who voted on reviews - prevents duplicates)
// ============================================================================
export const reviewVotes = pgTable(
  "review_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Vote type: true = helpful (upvote), false = not helpful (downvote)
    isHelpful: boolean("is_helpful").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One vote per user per review
    uniqueIndex("review_votes_user_review_idx").on(
      table.userId,
      table.reviewId
    ),
    index("review_votes_review_id_idx").on(table.reviewId),
  ]
);

// ============================================================================
// REVIEW REQUESTS (Automated review solicitation tracking)
// ============================================================================
// Tracks automated emails sent to customers asking for reviews after delivery.
// Helps measure effectiveness and prevents spam (one request per order item).
export const reviewRequests = pgTable(
  "review_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Email tracking
    email: varchar("email", { length: 255 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    reminderSentAt: timestamp("reminder_sent_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Engagement tracking
    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    reviewId: uuid("review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),

    // Scheduling
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One request per order-product combination
    uniqueIndex("review_requests_order_product_idx").on(
      table.orderId,
      table.productId
    ),
    index("review_requests_tenant_scheduled_idx").on(
      table.tenantId,
      table.scheduledFor
    ),
    index("review_requests_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// COMMISSION TRANSACTIONS (Audit log for all commission changes)
// ============================================================================
export const commissionTransactions = pgTable(
  "commission_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: commissionTransactionTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", {
      precision: 14,
      scale: 2,
    }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    processedBy: text("processed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("commission_transactions_tenant_id_idx").on(table.tenantId)]
);

// ============================================================================
// COMMISSION RULES (Category/product-specific commission rates)
// ============================================================================
// Allows different commission rates for different categories or products.
export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Rule scope (one of these should be set, or none for store-wide)
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),

    // Commission rate (overrides tenant default)
    commissionRate: decimal("commission_rate", {
      precision: 5,
      scale: 2,
    }).notNull(),

    // Validity period (for promotional rates)
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "string" }),
    validUntil: timestamp("valid_until", {
      withTimezone: true,
      mode: "string",
    }),

    // Priority (higher = more specific, takes precedence)
    priority: integer("priority").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("commission_rules_tenant_id_idx").on(table.tenantId),
    index("commission_rules_category_id_idx").on(table.categoryId),
    index("commission_rules_product_id_idx").on(table.productId),
  ]
);

// ============================================================================
// COMMISSION TIERS (Volume-based commission discounts)
// ============================================================================
// Platform-level: Higher volume sellers get lower commission rates.
export const commissionTiers = pgTable(
  "commission_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: varchar("name", { length: 100 }).notNull(), // "Bronze", "Silver", "Gold", "Platinum"
    description: text("description"),

    // Qualification criteria
    minMonthlyRevenue: decimal("min_monthly_revenue", {
      precision: 14,
      scale: 2,
    }), // Min monthly sales
    minMonthlyOrders: integer("min_monthly_orders"), // Min orders per month
    minAccountAge: integer("min_account_age_days"), // Days since store creation

    // Benefits
    commissionRate: decimal("commission_rate", {
      precision: 5,
      scale: 2,
    }).notNull(),
    freeShippingCredits: decimal("free_shipping_credits", {
      precision: 12,
      scale: 2,
    }),
    prioritySupport: boolean("priority_support").default(false).notNull(),

    // Display
    badgeUrl: text("badge_url"),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("commission_tiers_name_idx").on(table.name)]
);

// ============================================================================
// SELLER BALANCES (Real-time balance tracking per store)
// ============================================================================
// Single source of truth for seller's financial state.
export const sellerBalances = pgTable(
  "seller_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Balance breakdown
    available: decimal("available", { precision: 14, scale: 2 })
      .default("0")
      .notNull(), // Ready for payout
    pending: decimal("pending", { precision: 14, scale: 2 })
      .default("0")
      .notNull(), // From recent orders (holding period)
    reserved: decimal("reserved", { precision: 14, scale: 2 })
      .default("0")
      .notNull(), // Held for disputes/refunds
    lifetimeEarnings: decimal("lifetime_earnings", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    lifetimePaidOut: decimal("lifetime_paid_out", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Commission tier
    currentTierId: uuid("current_tier_id").references(
      () => commissionTiers.id,
      { onDelete: "set null" }
    ),
    tierQualifiedAt: timestamp("tier_qualified_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Payout settings
    autoPayout: boolean("auto_payout").default(false).notNull(),
    autoPayoutThreshold: decimal("auto_payout_threshold", {
      precision: 12,
      scale: 2,
    }),
    payoutHoldDays: integer("payout_hold_days").default(7).notNull(), // Days before pending becomes available

    // Currency
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("seller_balances_tenant_id_idx").on(table.tenantId)]
);

// ============================================================================
// SELLER PAYOUT METHODS (How sellers receive money)
// ============================================================================
export const sellerPayoutMethods = pgTable(
  "seller_payout_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    type: payoutMethodTypeEnum("type").notNull(),
    label: varchar("label", { length: 100 }), // "My Bank Account", "Mobile Money"

    // Bank details (encrypted in production)
    bankName: varchar("bank_name", { length: 255 }),
    bankCode: varchar("bank_code", { length: 50 }),
    accountNumber: varchar("account_number", { length: 100 }),
    accountName: varchar("account_name", { length: 255 }),
    routingNumber: varchar("routing_number", { length: 50 }),
    swiftCode: varchar("swift_code", { length: 20 }),
    iban: varchar("iban", { length: 50 }),

    // Mobile money
    mobileNumber: varchar("mobile_number", { length: 50 }),
    mobileProvider: varchar("mobile_provider", { length: 100 }),

    // Other
    walletAddress: varchar("wallet_address", { length: 255 }), // For crypto
    additionalInfo: jsonb("additional_info").$type<Record<string, string>>(),

    // Status
    isDefault: boolean("is_default").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("seller_payout_methods_tenant_id_idx").on(table.tenantId)]
);

// ============================================================================
// SELLER TRANSACTIONS (Financial ledger for sellers)
// ============================================================================
// Every financial event is recorded here for accounting/auditing.
export const sellerTransactions = pgTable(
  "seller_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Transaction details
    type: sellerTransactionTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(), // Positive or negative
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Balance snapshot after this transaction
    availableAfter: decimal("available_after", {
      precision: 14,
      scale: 2,
    }).notNull(),
    pendingAfter: decimal("pending_after", {
      precision: 14,
      scale: 2,
    }).notNull(),
    reservedAfter: decimal("reserved_after", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // References
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    payoutId: uuid("payout_id"), // Forward reference - will link to sellerPayouts
    affiliateId: uuid("affiliate_id"), // Forward reference - will link to affiliates

    // Description
    description: text("description").notNull(),
    notes: text("notes"), // Internal notes

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("seller_transactions_tenant_id_idx").on(table.tenantId),
    index("seller_transactions_order_id_idx").on(table.orderId),
    index("seller_transactions_created_at_idx").on(table.createdAt),
    index("seller_transactions_type_idx").on(table.type),
  ]
);

// ============================================================================
// SELLER PAYOUTS (Money sent to sellers)
// ============================================================================
export const sellerPayouts = pgTable(
  "seller_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    payoutMethodId: uuid("payout_method_id").references(
      () => sellerPayoutMethods.id,
      { onDelete: "set null" }
    ),

    // Payout reference number
    payoutNumber: varchar("payout_number", { length: 50 }).notNull(),

    // Amount
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    fee: decimal("fee", { precision: 12, scale: 2 }).default("0").notNull(), // Transfer fee
    netAmount: decimal("net_amount", { precision: 14, scale: 2 }).notNull(), // amount - fee
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Status
    status: payoutStatusEnum("status").default("pending").notNull(),

    // Timing
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    // External reference
    externalReference: varchar("external_reference", { length: 255 }), // Bank reference, transaction ID, etc.
    failureReason: text("failure_reason"),

    // Crypto payout fields (for USDT payouts)
    cryptoNetwork: varchar("crypto_network", { length: 10 }), // trc20, erc20, bep20
    cryptoTxHash: varchar("crypto_tx_hash", { length: 100 }), // Transaction hash when admin sends
    cryptoSentAt: timestamp("crypto_sent_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Who processed
    processedById: text("processed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seller_payouts_payout_number_idx").on(table.payoutNumber),
    index("seller_payouts_tenant_id_idx").on(table.tenantId),
    index("seller_payouts_status_idx").on(table.status),
    index("seller_payouts_requested_at_idx").on(table.requestedAt),
  ]
);

// ============================================================================
// SELLER PAYOUT ITEMS (Individual transactions in a payout)
// ============================================================================
// Links transactions to payouts for reconciliation.
export const sellerPayoutItems = pgTable(
  "seller_payout_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => sellerPayouts.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => sellerTransactions.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seller_payout_items_payout_transaction_idx").on(
      table.payoutId,
      table.transactionId
    ),
    index("seller_payout_items_payout_id_idx").on(table.payoutId),
  ]
);

// ============================================================================
// ANALYTICS: DAILY STORE SNAPSHOTS
// ============================================================================
export const analyticsDailySnapshots = pgTable(
  "analytics_daily_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    // Revenue & Sales
    grossRevenue: decimal("gross_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    netRevenue: decimal("net_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    shippingRevenue: decimal("shipping_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    taxCollected: decimal("tax_collected", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    discountsGiven: decimal("discounts_given", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    refundsIssued: decimal("refunds_issued", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    commissionAccrued: decimal("commission_accrued", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),

    // Orders
    totalOrders: integer("total_orders").default(0).notNull(),
    completedOrders: integer("completed_orders").default(0).notNull(),
    cancelledOrders: integer("cancelled_orders").default(0).notNull(),
    pendingOrders: integer("pending_orders").default(0).notNull(),
    averageOrderValue: decimal("average_order_value", {
      precision: 12,
      scale: 2,
    })
      .default("0")
      .notNull(),

    // Products
    itemsSold: integer("items_sold").default(0).notNull(),
    uniqueProductsSold: integer("unique_products_sold").default(0).notNull(),

    // Traffic
    pageViews: integer("page_views").default(0).notNull(),
    uniqueVisitors: integer("unique_visitors").default(0).notNull(),
    newVisitors: integer("new_visitors").default(0).notNull(),
    returningVisitors: integer("returning_visitors").default(0).notNull(),

    // Conversion
    cartCreations: integer("cart_creations").default(0).notNull(),
    checkoutStarts: integer("checkout_starts").default(0).notNull(),
    checkoutCompletions: integer("checkout_completions").default(0).notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),

    // Customers
    newCustomers: integer("new_customers").default(0).notNull(),
    returningCustomers: integer("returning_customers").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_daily_snapshots_tenant_date_idx").on(
      table.tenantId,
      table.snapshotDate
    ),
  ]
);

// ============================================================================
// ANALYTICS: PRODUCT PERFORMANCE
// ============================================================================
export const analyticsProductPerformance = pgTable(
  "analytics_product_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    quantitySold: integer("quantity_sold").default(0).notNull(),
    revenue: decimal("revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(),
    productViews: integer("product_views").default(0).notNull(),
    addToCartCount: integer("add_to_cart_count").default(0).notNull(),
    viewToCartRate: decimal("view_to_cart_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    cartToPurchaseRate: decimal("cart_to_purchase_rate", {
      precision: 5,
      scale: 2,
    })
      .default("0")
      .notNull(),
    revenuePerView: decimal("revenue_per_view", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    reviewsReceived: integer("reviews_received").default(0).notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    stockAtEndOfDay: integer("stock_at_end_of_day").default(0).notNull(),
    stockStatus: stockStatusEnum("stock_status").default("in_stock").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_product_perf_tenant_product_date_idx").on(
      table.tenantId,
      table.productId,
      table.snapshotDate
    ),
  ]
);

// ============================================================================
// ANALYTICS: CATEGORY PERFORMANCE
// ============================================================================
export const analyticsCategoryPerformance = pgTable(
  "analytics_category_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    quantitySold: integer("quantity_sold").default(0).notNull(),
    revenue: decimal("revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(),
    uniqueProductsSold: integer("unique_products_sold").default(0).notNull(),
    categoryViews: integer("category_views").default(0).notNull(),
    productViewsInCategory: integer("product_views_in_category")
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_category_perf_tenant_cat_date_idx").on(
      table.tenantId,
      table.categoryId,
      table.snapshotDate
    ),
  ]
);

// ============================================================================
// ANALYTICS: TRAFFIC SOURCES
// ============================================================================
export const analyticsTrafficSources = pgTable(
  "analytics_traffic_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    source: varchar("source", { length: 100 }).notNull(),
    medium: varchar("medium", { length: 100 }),
    campaign: varchar("campaign", { length: 255 }),
    referrerDomain: varchar("referrer_domain", { length: 255 }),

    visitors: integer("visitors").default(0).notNull(),
    pageViews: integer("page_views").default(0).notNull(),
    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_traffic_tenant_date_source_idx").on(
      table.tenantId,
      table.snapshotDate,
      table.source,
      table.medium
    ),
  ]
);

// ============================================================================
// ANALYTICS: GEOGRAPHIC SALES
// ============================================================================
export const analyticsGeographicSales = pgTable(
  "analytics_geographic_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    countryCode: varchar("country_code", { length: 2 }).notNull(),
    state: varchar("state", { length: 100 }),
    city: varchar("city", { length: 100 }),

    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    itemsSold: integer("items_sold").default(0).notNull(),
    shippingRevenue: decimal("shipping_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    uniqueCustomers: integer("unique_customers").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_geo_tenant_date_location_idx").on(
      table.tenantId,
      table.snapshotDate,
      table.countryCode,
      table.state,
      table.city
    ),
  ]
);

// ============================================================================
// ANALYTICS: HOURLY METRICS (Real-time dashboards)
// ============================================================================
export const analyticsHourlyMetrics = pgTable(
  "analytics_hourly_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    hour: timestamp("hour", { withTimezone: true, mode: "string" }).notNull(),

    pageViews: integer("page_views").default(0).notNull(),
    uniqueVisitors: integer("unique_visitors").default(0).notNull(),
    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    cartCreations: integer("cart_creations").default(0).notNull(),
    checkoutStarts: integer("checkout_starts").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_hourly_tenant_hour_idx").on(
      table.tenantId,
      table.hour
    ),
  ]
);

// ============================================================================
// ANALYTICS: PAGE VIEWS (Raw events)
// ============================================================================
export const analyticsPageViews = pgTable(
  "analytics_page_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    sessionId: varchar("session_id", { length: 255 }).notNull(),
    visitorId: varchar("visitor_id", { length: 255 }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    pageType: varchar("page_type", { length: 50 }).notNull(),
    pagePath: varchar("page_path", { length: 500 }).notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    referrer: text("referrer"),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),

    deviceType: varchar("device_type", { length: 20 }),
    browser: varchar("browser", { length: 50 }),
    os: varchar("os", { length: 50 }),

    countryCode: varchar("country_code", { length: 2 }),
    city: varchar("city", { length: 100 }),

    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_page_views_tenant_id_idx").on(table.tenantId),
    index("analytics_page_views_viewed_at_idx").on(table.viewedAt),
  ]
);

// ============================================================================
// ANALYTICS: CONVERSION EVENTS
// ============================================================================
export const analyticsConversionEvents = pgTable(
  "analytics_conversion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    eventType: analyticsEventTypeEnum("event_type").notNull(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    visitorId: varchar("visitor_id", { length: 255 }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id").references(() => carts.id, {
      onDelete: "set null",
    }),

    quantity: integer("quantity"),
    value: decimal("value", { precision: 14, scale: 2 }),
    searchQuery: varchar("search_query", { length: 255 }),

    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_conversion_events_tenant_id_idx").on(table.tenantId),
    index("analytics_conversion_events_occurred_at_idx").on(table.occurredAt),
  ]
);

// ============================================================================
// AFFILIATE PROFILES (Platform-wide affiliate accounts)
// ============================================================================
// Users can become affiliates to promote stores and earn commissions.
// This is their portfolio/profile that builds reputation across stores.
export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Profile information
    displayName: varchar("display_name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull().unique(), // For public profile URL
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    websiteUrl: text("website_url"),

    // Social links for promotion
    socialLinks: jsonb("social_links").$type<SocialLinks>(),

    // Specialties/niches (e.g., ["fashion", "tech", "beauty"])
    niches: jsonb("niches").$type<string[]>().default([]),

    // Contact preferences
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),

    // Status
    status: affiliateStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspensionReason: text("suspension_reason"),

    // Verification & trust
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Aggregated stats (for portfolio display)
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalEarnings: decimal("total_earnings", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    totalPaidOut: decimal("total_paid_out", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    totalReviews: integer("total_reviews").default(0).notNull(),

    // Active store partnerships
    activePartnerships: integer("active_partnerships").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliates_user_id_idx").on(table.userId),
    index("affiliates_status_idx").on(table.status),
    uniqueIndex("affiliates_slug_idx").on(table.slug),
  ]
);

// ============================================================================
// AFFILIATE PAYOUT METHODS (How affiliates receive money)
// ============================================================================
export const affiliatePayoutMethods = pgTable(
  "affiliate_payout_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),

    type: payoutMethodTypeEnum("type").notNull(),
    label: varchar("label", { length: 100 }),

    // Same fields as sellerPayoutMethods
    bankName: varchar("bank_name", { length: 255 }),
    bankCode: varchar("bank_code", { length: 50 }),
    accountNumber: varchar("account_number", { length: 100 }),
    accountName: varchar("account_name", { length: 255 }),
    routingNumber: varchar("routing_number", { length: 50 }),
    swiftCode: varchar("swift_code", { length: 20 }),
    iban: varchar("iban", { length: 50 }),
    mobileNumber: varchar("mobile_number", { length: 50 }),
    mobileProvider: varchar("mobile_provider", { length: 100 }),
    walletAddress: varchar("wallet_address", { length: 255 }),
    additionalInfo: jsonb("additional_info").$type<Record<string, string>>(),

    isDefault: boolean("is_default").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliate_payout_methods_affiliate_id_idx").on(table.affiliateId),
  ]
);

// ============================================================================
// AFFILIATE TENANT PARTNERSHIPS (Which affiliates work with which stores)
// ============================================================================
// Stores can approve affiliates, set custom commission rates, etc.
export const affiliateTenantPartnerships = pgTable(
  "affiliate_tenant_partnerships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Status
    status: affiliateStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectionReason: text("rejection_reason"),

    // Custom commission for this affiliate-store pair (overrides store default)
    commissionType: affiliateCommissionTypeEnum("commission_type")
      .default("percentage")
      .notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // % or fixed amount
    commissionFixed: decimal("commission_fixed", { precision: 12, scale: 2 }), // For hybrid: base amount

    // Cookie duration (days the affiliate gets credit after click)
    cookieDurationDays: integer("cookie_duration_days").default(30).notNull(),

    // Partnership stats (for this store only)
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    totalCommissionEarned: decimal("total_commission_earned", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),

    // Notes from store owner
    internalNotes: text("internal_notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_tenant_partnerships_affiliate_tenant_idx").on(
      table.affiliateId,
      table.tenantId
    ),
    index("affiliate_tenant_partnerships_tenant_id_idx").on(table.tenantId),
    index("affiliate_tenant_partnerships_status_idx").on(table.status),
  ]
);

// ============================================================================
// AFFILIATE LINKS (Trackable referral links)
// ============================================================================
// Each link has a unique code for tracking clicks and conversions.
export const affiliateLinks = pgTable(
  "affiliate_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    partnershipId: uuid("partnership_id")
      .notNull()
      .references(() => affiliateTenantPartnerships.id, {
        onDelete: "cascade",
      }),

    // Unique tracking code (e.g., "abc123" -> /store/shop?ref=abc123)
    code: varchar("code", { length: 50 }).notNull().unique(),

    // What the link points to
    targetType: varchar("target_type", { length: 20 }).notNull(), // "store", "product", "category"
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),

    // Custom name for affiliate's reference
    name: varchar("name", { length: 255 }),

    // Stats
    totalClicks: integer("total_clicks").default(0).notNull(),
    uniqueClicks: integer("unique_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_links_code_idx").on(table.code),
    index("affiliate_links_affiliate_id_idx").on(table.affiliateId),
    index("affiliate_links_tenant_id_idx").on(table.tenantId),
  ]
);

// ============================================================================
// AFFILIATE CLICKS (Click tracking)
// ============================================================================
export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => affiliateLinks.id, { onDelete: "cascade" }),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Visitor info
    visitorId: varchar("visitor_id", { length: 255 }), // Fingerprint/cookie ID
    sessionId: varchar("session_id", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support

    // Source
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    deviceType: varchar("device_type", { length: 20 }),

    // Geo
    countryCode: varchar("country_code", { length: 2 }),
    city: varchar("city", { length: 100 }),

    // Conversion tracking
    isConverted: boolean("is_converted").default(false).notNull(),
    convertedAt: timestamp("converted_at", {
      withTimezone: true,
      mode: "string",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),

    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliate_clicks_link_id_idx").on(table.linkId),
    index("affiliate_clicks_affiliate_id_idx").on(table.affiliateId),
    index("affiliate_clicks_tenant_id_idx").on(table.tenantId),
    index("affiliate_clicks_clicked_at_idx").on(table.clickedAt),
    index("affiliate_clicks_visitor_id_idx").on(table.visitorId),
  ]
);

// ============================================================================
// AFFILIATE CONVERSIONS (Order attributions)
// ============================================================================
export const affiliateConversions = pgTable(
  "affiliate_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    partnershipId: uuid("partnership_id")
      .notNull()
      .references(() => affiliateTenantPartnerships.id, {
        onDelete: "cascade",
      }),
    linkId: uuid("link_id").references(() => affiliateLinks.id, {
      onDelete: "set null",
    }),
    clickId: uuid("click_id").references(() => affiliateClicks.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Order details at time of conversion
    orderTotal: decimal("order_total", { precision: 14, scale: 2 }).notNull(),
    orderCurrency: varchar("order_currency", { length: 3 })
      .default("AFN")
      .notNull(),

    // Commission calculation
    commissionType: affiliateCommissionTypeEnum("commission_type").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
    commissionFixed: decimal("commission_fixed", { precision: 12, scale: 2 }),
    commissionAmount: decimal("commission_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // Status
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected, paid
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectionReason: text("rejection_reason"),

    // Payment tracking
    payoutId: uuid("payout_id"), // Forward reference to affiliatePayouts
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),

    convertedAt: timestamp("converted_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_conversions_order_id_idx").on(table.orderId), // One conversion per order
    index("affiliate_conversions_affiliate_id_idx").on(table.affiliateId),
    index("affiliate_conversions_tenant_id_idx").on(table.tenantId),
    index("affiliate_conversions_status_idx").on(table.status),
    index("affiliate_conversions_converted_at_idx").on(table.convertedAt),
  ]
);

// ============================================================================
// AFFILIATE PAYOUTS (Money sent to affiliates)
// ============================================================================
export const affiliatePayouts = pgTable(
  "affiliate_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    payoutMethodId: uuid("payout_method_id").references(
      () => affiliatePayoutMethods.id,
      { onDelete: "set null" }
    ),

    // Payout reference
    payoutNumber: varchar("payout_number", { length: 50 }).notNull(),

    // Amount
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    fee: decimal("fee", { precision: 12, scale: 2 }).default("0").notNull(),
    netAmount: decimal("net_amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // How many conversions included
    conversionCount: integer("conversion_count").notNull(),

    // Status
    status: affiliatePayoutStatusEnum("status").default("pending").notNull(),

    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    externalReference: varchar("external_reference", { length: 255 }),
    failureReason: text("failure_reason"),
    processedById: text("processed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_payouts_payout_number_idx").on(table.payoutNumber),
    index("affiliate_payouts_affiliate_id_idx").on(table.affiliateId),
    index("affiliate_payouts_status_idx").on(table.status),
  ]
);

// ============================================================================
// AFFILIATE RATINGS (Store owners rate their affiliates)
// ============================================================================
// Builds affiliate reputation for their portfolio.
export const affiliateRatings = pgTable(
  "affiliate_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    partnershipId: uuid("partnership_id")
      .notNull()
      .references(() => affiliateTenantPartnerships.id, {
        onDelete: "cascade",
      }),

    // Who gave the rating
    ratedById: text("rated_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Rating
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    comment: text("comment"),

    // Categories
    communicationRating: integer("communication_rating"), // 1-5
    qualityRating: integer("quality_rating"), // 1-5
    professionalismRating: integer("professionalism_rating"), // 1-5

    // Display on portfolio?
    isPublic: boolean("is_public").default(true).notNull(),

    // Affiliate response
    response: text("response"),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One rating per partnership
    uniqueIndex("affiliate_ratings_partnership_idx").on(table.partnershipId),
    index("affiliate_ratings_affiliate_id_idx").on(table.affiliateId),
    check("affiliate_ratings_rating_check", sql`rating >= 1 AND rating <= 5`),
  ]
);

// ============================================================================
// PLATFORM AFFILIATES (Affiliates for Kaka Malem itself - merchant acquisition)
// ============================================================================

// Social links for platform affiliates
export type PlatformAffiliateSocialLinks = {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
};

// Payout details type for platform affiliates
export type PlatformAffiliatePayoutDetails = {
  // Bank transfer
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  // Mobile money
  mobileNumber?: string;
  mobileProvider?: string; // e.g., "m-paisa", "m-hawala"
  // Crypto (USDT)
  walletAddress?: string;
  network?: "trc20" | "erc20" | "bep20";
};

// Platform affiliates table - affiliates who promote Kaka Malem to acquire new stores
export const platformAffiliates = pgTable(
  "platform_affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Profile & Vanity URL
    slug: varchar("slug", { length: 63 }).notNull().unique(), // kakamalem.com/matee
    displayName: varchar("display_name", { length: 100 }).notNull(),
    bio: text("bio"),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links").$type<PlatformAffiliateSocialLinks>(),

    // Commission settings (can be customized per affiliate by admin)
    baseCommissionRate: decimal("base_commission_rate", {
      precision: 5,
      scale: 2,
    })
      .default("30.00")
      .notNull(),
    commissionDurationMonths: integer("commission_duration_months")
      .default(12)
      .notNull(),
    cookieDurationDays: integer("cookie_duration_days").default(90).notNull(),

    // Current tier (calculated from successfulReferrals)
    currentTier: platformAffiliateTierEnum("current_tier")
      .default("bronze")
      .notNull(),
    currentCommissionRate: decimal("current_commission_rate", {
      precision: 5,
      scale: 2,
    })
      .default("30.00")
      .notNull(),

    // Stats (denormalized for quick access)
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalSignups: integer("total_signups").default(0).notNull(),
    successfulReferrals: integer("successful_referrals").default(0).notNull(), // Passed 30-day retention
    totalEarned: decimal("total_earned", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    totalPending: decimal("total_pending", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    totalPaidOut: decimal("total_paid_out", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),

    // Status
    status: platformAffiliateStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    approvedBy: text("approved_by").references(() => user.id),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspensionReason: text("suspension_reason"),
    rejectionReason: text("rejection_reason"),

    // Payout preferences
    payoutMethod: varchar("payout_method", { length: 50 }), // bank_transfer, mobile_money
    payoutDetails:
      jsonb("payout_details").$type<PlatformAffiliatePayoutDetails>(),

    // Application info
    applicationNotes: text("application_notes"), // How they plan to promote

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("platform_affiliates_user_id_idx").on(table.userId),
    index("platform_affiliates_status_idx").on(table.status),
    uniqueIndex("platform_affiliates_slug_idx").on(table.slug),
    index("platform_affiliates_tier_idx").on(table.currentTier),
  ]
);

// Platform affiliate clicks - tracking when someone visits the affiliate link
export const platformAffiliateClicks = pgTable(
  "platform_affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => platformAffiliates.id, { onDelete: "cascade" }),

    // Visitor identification
    visitorId: varchar("visitor_id", { length: 100 }), // Generated unique ID in cookie
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    landingPage: text("landing_page"),

    // Geo-location (from Vercel headers or IP lookup)
    country: varchar("country", { length: 2 }), // ISO 3166-1 alpha-2 (e.g., "AF", "US")
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }), // State/province

    // Device info (parsed from User-Agent)
    deviceType: varchar("device_type", { length: 20 }), // mobile, tablet, desktop
    browser: varchar("browser", { length: 50 }), // Chrome, Safari, Firefox, etc.
    os: varchar("os", { length: 50 }), // Windows, macOS, iOS, Android, etc.

    // Bot detection
    isBot: boolean("is_bot").default(false).notNull(),

    // UTM tracking
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    utmContent: varchar("utm_content", { length: 100 }),

    // Conversion tracking
    converted: boolean("converted").default(false).notNull(),
    convertedAt: timestamp("converted_at", {
      withTimezone: true,
      mode: "string",
    }),
    referralId: uuid("referral_id"), // Links to platformAffiliateReferrals when converted

    // Cookie expiry
    cookieExpiresAt: timestamp("cookie_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("platform_affiliate_clicks_affiliate_id_idx").on(table.affiliateId),
    index("platform_affiliate_clicks_visitor_id_idx").on(table.visitorId),
    index("platform_affiliate_clicks_clicked_at_idx").on(table.clickedAt),
    index("platform_affiliate_clicks_country_idx").on(table.country),
    index("platform_affiliate_clicks_is_bot_idx").on(table.isBot),
    // Composite index for deduplication
    index("platform_affiliate_clicks_dedup_idx").on(
      table.affiliateId,
      table.visitorId,
      table.clickedAt
    ),
  ]
);

// Platform affiliate referrals - when someone signs up a new store
export const platformAffiliateReferrals = pgTable(
  "platform_affiliate_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => platformAffiliates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clickId: uuid("click_id").references(() => platformAffiliateClicks.id),

    // Signup details
    signedUpAt: timestamp("signed_up_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    // Commission tracking (locked at signup time based on affiliate's tier)
    commissionRate: decimal("commission_rate", {
      precision: 5,
      scale: 2,
    }).notNull(),
    commissionEndsAt: timestamp("commission_ends_at", {
      withTimezone: true,
      mode: "string",
    }), // 12 months from first paid subscription

    // Retention tracking
    firstPaidAt: timestamp("first_paid_at", {
      withTimezone: true,
      mode: "string",
    }), // When trial ended and first payment made
    retentionPassed: boolean("retention_passed").default(false).notNull(), // 30-day retention met?
    retentionCheckedAt: timestamp("retention_checked_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Status
    status: platformAffiliateReferralStatusEnum("status")
      .default("trial")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(), // Still within commission period

    // Aggregates
    totalSubscriptionPaid: decimal("total_subscription_paid", {
      precision: 14,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    totalCommissionEarned: decimal("total_commission_earned", {
      precision: 14,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    totalCommissionPaid: decimal("total_commission_paid", {
      precision: 14,
      scale: 2,
    })
      .default("0.00")
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("platform_affiliate_referrals_affiliate_id_idx").on(
      table.affiliateId
    ),
    index("platform_affiliate_referrals_tenant_id_idx").on(table.tenantId),
    index("platform_affiliate_referrals_status_idx").on(table.status),
  ]
);

// Platform affiliate commissions - individual commission records (created each subscription payment)
export const platformAffiliateCommissions = pgTable(
  "platform_affiliate_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => platformAffiliates.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => platformAffiliateReferrals.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Payment details
    subscriptionAmount: decimal("subscription_amount", {
      precision: 12,
      scale: 2,
    }).notNull(), // What store paid
    commissionRate: decimal("commission_rate", {
      precision: 5,
      scale: 2,
    }).notNull(), // Rate at time of this payment
    commissionAmount: decimal("commission_amount", {
      precision: 12,
      scale: 2,
    }).notNull(), // Calculated commission
    commissionMonth: integer("commission_month").notNull(), // Month 1-12 of the 12-month period
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Subscription period this commission covers
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    periodEnd: timestamp("period_end", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // Status
    status: platformAffiliateCommissionStatusEnum("status")
      .default("pending")
      .notNull(),
    availableAt: timestamp("available_at", {
      withTimezone: true,
      mode: "string",
    }), // When 30-day retention passes

    // Payout tracking
    payoutId: uuid("payout_id").references(() => platformAffiliatePayouts.id),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("platform_affiliate_commissions_affiliate_id_idx").on(
      table.affiliateId
    ),
    index("platform_affiliate_commissions_referral_id_idx").on(
      table.referralId
    ),
    index("platform_affiliate_commissions_status_idx").on(table.status),
    index("platform_affiliate_commissions_tenant_id_idx").on(table.tenantId),
  ]
);

// Platform affiliate payouts - payout requests and history
export const platformAffiliatePayouts = pgTable(
  "platform_affiliate_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => platformAffiliates.id, { onDelete: "cascade" }),

    // Payout details
    payoutNumber: varchar("payout_number", { length: 20 }).notNull().unique(), // PAF-0001
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Payout method snapshot (in case affiliate changes method later)
    payoutMethod: varchar("payout_method", { length: 50 }).notNull(),
    payoutDetails: jsonb("payout_details")
      .$type<PlatformAffiliatePayoutDetails>()
      .notNull(),

    // Status
    status: platformAffiliatePayoutStatusEnum("status")
      .default("pending")
      .notNull(),

    // Processing
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    processedBy: text("processed_by").references(() => user.id),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Notes
    adminNotes: text("admin_notes"),
    failureReason: text("failure_reason"),
    transactionReference: varchar("transaction_reference", { length: 255 }),

    // Crypto payout fields (for USDT payouts)
    cryptoTxHash: varchar("crypto_tx_hash", { length: 100 }), // Transaction hash when admin sends
    cryptoSentAt: timestamp("crypto_sent_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("platform_affiliate_payouts_payout_number_idx").on(
      table.payoutNumber
    ),
    index("platform_affiliate_payouts_affiliate_id_idx").on(table.affiliateId),
    index("platform_affiliate_payouts_status_idx").on(table.status),
  ]
);

// Reserved slugs - paths that can't be used as affiliate vanity URLs
export const reservedSlugs = pgTable("reserved_slugs", {
  slug: varchar("slug", { length: 63 }).primaryKey(),
  reason: varchar("reason", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ============================================================================
// DELIVERY PROVIDERS (Drivers/Companies for delivery)
// ============================================================================
// Platform-wide delivery provider profiles. Can be individual drivers or companies.
// Builds reputation and portfolio for future delivery work.
export const deliveryProviders = pgTable(
  "delivery_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Type
    type: deliveryProviderTypeEnum("type").default("individual").notNull(),

    // Profile information
    displayName: varchar("display_name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),

    // Company details (if type = company)
    companyName: varchar("company_name", { length: 255 }),
    companyLogo: text("company_logo"),
    businessLicense: varchar("business_license", { length: 100 }),

    // Contact
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
    whatsappNumber: varchar("whatsapp_number", { length: 50 }),

    // Address (base of operations)
    address: jsonb("address").$type<Address>(),

    // Vehicle information (for individual drivers)
    vehicleType: varchar("vehicle_type", { length: 50 }), // motorcycle, car, van, truck
    vehiclePlate: varchar("vehicle_plate", { length: 20 }),
    vehicleCapacityKg: decimal("vehicle_capacity_kg", {
      precision: 10,
      scale: 2,
    }),

    // Status
    status: deliveryProviderStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspensionReason: text("suspension_reason"),

    // Verification
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    idDocumentUrl: text("id_document_url"), // For verification
    licenseDocumentUrl: text("license_document_url"),

    // Operating hours
    operatingHours:
      jsonb("operating_hours").$type<
        Record<string, { start: string; end: string }>
      >(),
    isAvailable: boolean("is_available").default(true).notNull(),

    // Aggregated stats (for portfolio)
    totalDeliveries: integer("total_deliveries").default(0).notNull(),
    completedDeliveries: integer("completed_deliveries").default(0).notNull(),
    failedDeliveries: integer("failed_deliveries").default(0).notNull(),
    onTimeDeliveryRate: decimal("on_time_delivery_rate", {
      precision: 5,
      scale: 2,
    })
      .default("0")
      .notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    totalReviews: integer("total_reviews").default(0).notNull(),
    totalEarnings: decimal("total_earnings", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    totalPaidOut: decimal("total_paid_out", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Active partnerships
    activePartnerships: integer("active_partnerships").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_providers_user_id_idx").on(table.userId),
    index("delivery_providers_status_idx").on(table.status),
    uniqueIndex("delivery_providers_slug_idx").on(table.slug),
  ]
);

// ============================================================================
// DELIVERY PROVIDER PAYOUT METHODS
// ============================================================================
export const deliveryPayoutMethods = pgTable(
  "delivery_payout_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),

    type: payoutMethodTypeEnum("type").notNull(),
    label: varchar("label", { length: 100 }),

    bankName: varchar("bank_name", { length: 255 }),
    bankCode: varchar("bank_code", { length: 50 }),
    accountNumber: varchar("account_number", { length: 100 }),
    accountName: varchar("account_name", { length: 255 }),
    routingNumber: varchar("routing_number", { length: 50 }),
    swiftCode: varchar("swift_code", { length: 20 }),
    iban: varchar("iban", { length: 50 }),
    mobileNumber: varchar("mobile_number", { length: 50 }),
    mobileProvider: varchar("mobile_provider", { length: 100 }),
    walletAddress: varchar("wallet_address", { length: 255 }),
    additionalInfo: jsonb("additional_info").$type<Record<string, string>>(),

    isDefault: boolean("is_default").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_payout_methods_provider_id_idx").on(table.providerId),
  ]
);

// ============================================================================
// DELIVERY PROVIDER SERVICE ZONES
// ============================================================================
// Which areas the provider services
export const deliveryProviderZones = pgTable(
  "delivery_provider_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),

    // Zone definition
    name: varchar("name", { length: 255 }).notNull(), // "Kabul City", "Herat Province"
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    state: varchar("state", { length: 100 }),
    city: varchar("city", { length: 100 }),
    postalCodes: jsonb("postal_codes").$type<string[]>(),

    // Rates for this zone
    baseRate: decimal("base_rate", { precision: 12, scale: 2 }).notNull(),
    perKmRate: decimal("per_km_rate", { precision: 12, scale: 2 }),
    perKgRate: decimal("per_kg_rate", { precision: 12, scale: 2 }),

    // Delivery time
    minDeliveryHours: integer("min_delivery_hours"),
    maxDeliveryHours: integer("max_delivery_hours"),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_provider_zones_provider_id_idx").on(table.providerId),
    index("delivery_provider_zones_country_state_city_idx").on(
      table.countryCode,
      table.state,
      table.city
    ),
  ]
);

// ============================================================================
// DELIVERY TENANT PARTNERSHIPS (Which providers work with which stores)
// ============================================================================
export const deliveryTenantPartnerships = pgTable(
  "delivery_tenant_partnerships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Status
    status: deliveryProviderStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectionReason: text("rejection_reason"),

    // Custom rates for this partnership (overrides provider defaults)
    customBaseRate: decimal("custom_base_rate", { precision: 12, scale: 2 }),
    customPerKmRate: decimal("custom_per_km_rate", { precision: 12, scale: 2 }),
    customPerKgRate: decimal("custom_per_kg_rate", { precision: 12, scale: 2 }),

    // Priority (higher = preferred provider)
    priority: integer("priority").default(0).notNull(),

    // Stats for this partnership
    totalDeliveries: integer("total_deliveries").default(0).notNull(),
    completedDeliveries: integer("completed_deliveries").default(0).notNull(),
    failedDeliveries: integer("failed_deliveries").default(0).notNull(),
    totalEarned: decimal("total_earned", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    // Notes
    internalNotes: text("internal_notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_tenant_partnerships_provider_tenant_idx").on(
      table.providerId,
      table.tenantId
    ),
    index("delivery_tenant_partnerships_tenant_id_idx").on(table.tenantId),
    index("delivery_tenant_partnerships_status_idx").on(table.status),
  ]
);

// ============================================================================
// DELIVERY ASSIGNMENTS (Shipment -> Provider assignments)
// ============================================================================
export const deliveryAssignments = pgTable(
  "delivery_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),
    partnershipId: uuid("partnership_id").references(
      () => deliveryTenantPartnerships.id,
      { onDelete: "set null" }
    ),

    // Assignment reference number
    assignmentNumber: varchar("assignment_number", { length: 50 }).notNull(),

    // Status
    status: deliveryAssignmentStatusEnum("status").default("pending").notNull(),

    // Pickup details
    pickupAddress: jsonb("pickup_address").$type<Address>().notNull(),
    pickupInstructions: text("pickup_instructions"),
    scheduledPickupAt: timestamp("scheduled_pickup_at", {
      withTimezone: true,
      mode: "string",
    }),
    actualPickupAt: timestamp("actual_pickup_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Delivery details
    deliveryAddress: jsonb("delivery_address").$type<Address>().notNull(),
    deliveryInstructions: text("delivery_instructions"),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", {
      withTimezone: true,
      mode: "string",
    }),
    actualDeliveryAt: timestamp("actual_delivery_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Package details
    weightKg: decimal("weight_kg", { precision: 10, scale: 3 }),
    packageCount: integer("package_count").default(1).notNull(),
    description: text("description"),

    // Pricing
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    providerEarnings: decimal("provider_earnings", {
      precision: 12,
      scale: 2,
    }).notNull(),

    // Cash on delivery
    isCod: boolean("is_cod").default(false).notNull(), // Cash on delivery?
    codAmount: decimal("cod_amount", { precision: 14, scale: 2 }),
    codCollected: boolean("cod_collected").default(false).notNull(),
    codCollectedAt: timestamp("cod_collected_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Failure handling
    failureReason: text("failure_reason"),
    failedAttempts: integer("failed_attempts").default(0).notNull(),

    // Proof of delivery
    deliveryPhotoUrl: text("delivery_photo_url"),
    signatureUrl: text("signature_url"),
    recipientName: varchar("recipient_name", { length: 255 }),

    // Notes
    driverNotes: text("driver_notes"),
    customerNotes: text("customer_notes"),

    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_assignments_assignment_number_idx").on(
      table.assignmentNumber
    ),
    index("delivery_assignments_shipment_id_idx").on(table.shipmentId),
    index("delivery_assignments_provider_id_idx").on(table.providerId),
    index("delivery_assignments_tenant_id_idx").on(table.tenantId),
    index("delivery_assignments_status_idx").on(table.status),
  ]
);

// ============================================================================
// DELIVERY TRACKING EVENTS
// ============================================================================
export const deliveryTrackingEvents = pgTable(
  "delivery_tracking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => deliveryAssignments.id, { onDelete: "cascade" }),

    status: deliveryAssignmentStatusEnum("status").notNull(),
    description: text("description"),

    // Location at time of event
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    locationName: varchar("location_name", { length: 255 }),

    // Photo evidence
    photoUrl: text("photo_url"),

    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_tracking_events_assignment_id_idx").on(table.assignmentId),
    index("delivery_tracking_events_occurred_at_idx").on(table.occurredAt),
  ]
);

// ============================================================================
// DELIVERY RATINGS (Customers/stores rate delivery providers)
// ============================================================================
export const deliveryRatings = pgTable(
  "delivery_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => deliveryAssignments.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),

    // Who gave the rating
    ratedById: text("rated_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    raterType: varchar("rater_type", { length: 20 }).notNull(), // "customer", "store"

    // Rating
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    comment: text("comment"),

    // Categories
    punctualityRating: integer("punctuality_rating"), // 1-5
    handlingRating: integer("handling_rating"), // 1-5 (package handling)
    communicationRating: integer("communication_rating"), // 1-5

    // Display on portfolio?
    isPublic: boolean("is_public").default(true).notNull(),

    // Provider response
    response: text("response"),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_ratings_assignment_rater_idx").on(
      table.assignmentId,
      table.ratedById
    ),
    index("delivery_ratings_provider_id_idx").on(table.providerId),
    check("delivery_ratings_rating_check", sql`rating >= 1 AND rating <= 5`),
  ]
);

// ============================================================================
// DELIVERY PAYOUTS (Money sent to delivery providers)
// ============================================================================
export const deliveryPayouts = pgTable(
  "delivery_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => deliveryProviders.id, { onDelete: "cascade" }),
    payoutMethodId: uuid("payout_method_id").references(
      () => deliveryPayoutMethods.id,
      { onDelete: "set null" }
    ),

    payoutNumber: varchar("payout_number", { length: 50 }).notNull(),

    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    fee: decimal("fee", { precision: 12, scale: 2 }).default("0").notNull(),
    netAmount: decimal("net_amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // How many deliveries included
    deliveryCount: integer("delivery_count").notNull(),

    // COD amounts (if applicable)
    codCollected: decimal("cod_collected", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),

    status: deliveryPayoutStatusEnum("status").default("pending").notNull(),

    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    externalReference: varchar("external_reference", { length: 255 }),
    failureReason: text("failure_reason"),
    processedById: text("processed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_payouts_payout_number_idx").on(table.payoutNumber),
    index("delivery_payouts_provider_id_idx").on(table.providerId),
    index("delivery_payouts_status_idx").on(table.status),
  ]
);

// ============================================================================
// DELIVERY PAYOUT ITEMS (Individual assignments in a payout)
// ============================================================================
export const deliveryPayoutItems = pgTable(
  "delivery_payout_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => deliveryPayouts.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => deliveryAssignments.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    codAmount: decimal("cod_amount", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_payout_items_payout_assignment_idx").on(
      table.payoutId,
      table.assignmentId
    ),
    index("delivery_payout_items_payout_id_idx").on(table.payoutId),
  ]
);

// ============================================================================
// PLATFORM SETTINGS (Admin-configurable global settings)
// ============================================================================
// Single-row table for platform-wide configuration.
// Managed exclusively through /admin
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ==========================================================================
  // SUBSCRIPTION PRICING
  // ==========================================================================
  // Pro plan monthly price in AFN (changeable from admin panel)
  proPlanPriceAfn: decimal("pro_plan_price_afn", { precision: 10, scale: 2 })
    .default("1100")
    .notNull(),

  // Pro plan yearly price in AFN (admin-configurable, no fixed discount)
  proPlanYearlyPriceAfn: decimal("pro_plan_yearly_price_afn", {
    precision: 10,
    scale: 2,
  })
    .default("12000")
    .notNull(),

  // Free tier limits
  freeProductLimit: integer("free_product_limit").default(20).notNull(),

  // Trial settings
  trialDurationDays: integer("trial_duration_days").default(7).notNull(),

  // ==========================================================================
  // PLATFORM FEES (for future use)
  // ==========================================================================
  // Transaction fee percentage (0 = disabled)
  transactionFeePercent: decimal("transaction_fee_percent", {
    precision: 5,
    scale: 2,
  })
    .default("0")
    .notNull(),

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================
  // Days before trial ends to show warning
  trialWarningDays: integer("trial_warning_days").default(3).notNull(),

  // ==========================================================================
  // CRYPTO PAYMENTS (Self-hosted USDT)
  // ==========================================================================
  // USDT wallet configuration for self-hosted crypto payments
  usdtWalletConfig: jsonb("usdt_wallet_config").$type<UsdtWalletConfig>(),

  // ==========================================================================
  // METADATA
  // ==========================================================================
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

// ============================================================================
// ADMIN AUDIT LOG (Track admin actions)
// ============================================================================
// Records all admin actions for accountability
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: text("admin_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // What happened
    action: varchar("action", { length: 100 }).notNull(), // e.g., "store.suspend", "store.activate", "settings.update"
    targetType: varchar("target_type", { length: 50 }), // e.g., "tenant", "user", "settings"
    targetId: text("target_id"), // ID of affected resource

    // Details
    details: jsonb("details"), // Additional context (old/new values, reason, etc.)

    // Request metadata
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_audit_log_admin_id_idx").on(table.adminId),
    index("admin_audit_log_action_idx").on(table.action),
    index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
    index("admin_audit_log_created_at_idx").on(table.createdAt),
  ]
);

// ============================================================================
// BILLING TRANSACTIONS (Subscription payment history)
// ============================================================================
// Records all billing events for stores - payments, upgrades, refunds, etc.
export const billingTransactions = pgTable(
  "billing_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Transaction details
    type: billingTransactionTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Payment info (for subscription_payment type)
    paymentMethod: paymentMethodEnum("payment_method"),
    paymentReference: varchar("payment_reference", { length: 255 }), // Bank ref, mobile money ID

    // Subscription period covered (for subscription_payment type)
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "string" }),

    // Plan changes (for upgrade/downgrade types)
    fromPlan: subscriptionPlanEnum("from_plan"),
    toPlan: subscriptionPlanEnum("to_plan"),

    // Status tracking
    status: billingTransactionStatusEnum("status")
      .default("completed")
      .notNull(),

    // Invoice link (if generated)
    invoiceId: uuid("invoice_id"), // Will reference invoices table

    // Admin/processing info
    processedBy: text("processed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("billing_transactions_tenant_id_idx").on(table.tenantId),
    index("billing_transactions_type_idx").on(table.type),
    index("billing_transactions_status_idx").on(table.status),
    index("billing_transactions_created_at_idx").on(table.createdAt),
    index("billing_transactions_processed_by_idx").on(table.processedBy),
  ]
);

// ============================================================================
// INVOICES (Billing invoices for tax/accounting)
// ============================================================================
// Generated invoices for subscription payments
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Invoice identification (globally unique via nanoid)
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),

    // Amounts
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    tax: decimal("tax", { precision: 10, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Billing period
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "string" }),

    // Due date and status
    dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
    paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default(
      "0"
    ),

    // Invoice items (JSON for flexibility)
    // Structure: [{ description: string, quantity: number, unitPrice: number, total: number }]
    items: jsonb("items").$type<
      Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>
    >(),

    // Billing details snapshot (immutable at invoice time)
    billingName: varchar("billing_name", { length: 255 }),
    billingEmail: varchar("billing_email", { length: 255 }),
    billingPhone: varchar("billing_phone", { length: 50 }),
    billingAddress: text("billing_address"),

    // PDF storage (optional)
    pdfUrl: text("pdf_url"),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("invoices_tenant_id_idx").on(table.tenantId),
    index("invoices_status_idx").on(table.status),
    index("invoices_due_date_idx").on(table.dueDate),
    index("invoices_created_at_idx").on(table.createdAt),
  ]
);

// ============================================================================
// SUBSCRIPTION REFUNDS
// ============================================================================
// Tracks prorated refunds for cancelled/downgraded Pro subscriptions

export const subscriptionRefundReasonEnum = pgEnum(
  "subscription_refund_reason",
  [
    "cancellation", // User cancelled subscription
    "downgrade", // Downgraded to free plan
    "admin", // Admin-initiated refund
    "dispute", // Payment dispute/chargeback
    "service_issue", // Platform issue compensation
  ]
);

export const subscriptionRefundStatusEnum = pgEnum(
  "subscription_refund_status",
  [
    "pending", // Awaiting approval
    "approved", // Approved, awaiting processing
    "processing", // Being processed
    "completed", // Refund completed
    "rejected", // Refund rejected
  ]
);

export const subscriptionRefunds = pgTable(
  "subscription_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Refund calculation
    originalAmount: decimal("original_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    refundAmount: decimal("refund_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    daysUsed: integer("days_used").notNull(),
    daysRemaining: integer("days_remaining").notNull(),
    dailyRate: decimal("daily_rate", { precision: 14, scale: 4 }).notNull(),

    // Billing period being refunded
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    periodEnd: timestamp("period_end", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // Processing
    reason: text("reason").notNull(),
    reasonCode: subscriptionRefundReasonEnum("reason_code").notNull(),
    status: subscriptionRefundStatusEnum("status").default("pending").notNull(),

    // Payment method for refund
    refundMethod: varchar("refund_method", { length: 50 }), // 'original_payment' | 'store_credit' | 'manual'
    gatewayRefundId: varchar("gateway_refund_id", { length: 255 }), // Stripe refund ID if applicable

    // Audit trail (no FK - preserve audit even if user deleted)
    requestedBy: uuid("requested_by"),
    approvedBy: uuid("approved_by"),
    processedBy: uuid("processed_by"),

    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),

    adminNotes: text("admin_notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subscription_refunds_tenant_idx").on(table.tenantId),
    index("subscription_refunds_status_idx").on(table.status),
  ]
);

// ============================================================================
// PAYMENT GATEWAY CONFIGURATION
// ============================================================================
// Stores payment gateway credentials and settings per tenant.
// Supports multiple gateways: HesabPay, Stripe, COD, manual bank transfer, etc.

export const paymentGatewayEnum = pgEnum("payment_gateway", [
  "hesabpay", // HesabPay - Afghanistan primary
  "stripe", // Stripe Connect - International
  "cod", // Cash on Delivery
  "bank_transfer", // Manual bank transfer
  "mobile_money", // Mobile money (M-Paisa, M-Hawala)
  "crypto_usdt", // Self-hosted USDT crypto payments
]);

// Crypto payment status (for manual verification flow)
export const cryptoPaymentStatusEnum = pgEnum("crypto_payment_status", [
  "pending", // Waiting for customer to send payment
  "submitted", // Customer submitted transaction hash
  "verified", // Admin verified the transaction
  "expired", // Payment session expired
  "rejected", // Admin rejected the transaction
]);

// Crypto network types
export const cryptoNetworkEnum = pgEnum("crypto_network", [
  "trc20", // Tron (USDT-TRC20) - Low fees
  "erc20", // Ethereum (USDT-ERC20) - High fees but widely used
  "bep20", // BNB Smart Chain (USDT-BEP20) - Low fees
]);

export const paymentGatewayConfigs = pgTable(
  "payment_gateway_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Gateway type
    gateway: paymentGatewayEnum("gateway").notNull(),

    // Display settings
    displayName: varchar("display_name", { length: 100 }), // "Pay with Card", "Cash on Delivery"
    description: text("description"), // Instructions for customers
    displayOrder: integer("display_order").default(0).notNull(),

    // Credentials (encrypt sensitive fields in production)
    apiKey: text("api_key"), // HesabPay API key, Stripe publishable key
    secretKey: text("secret_key"), // HesabPay secret, Stripe secret key
    merchantId: varchar("merchant_id", { length: 100 }), // Merchant/account ID
    merchantPin: varchar("merchant_pin", { length: 50 }), // HesabPay PIN
    webhookSecret: text("webhook_secret"), // For verifying webhooks

    // For Stripe Connect
    stripeAccountId: varchar("stripe_account_id", { length: 100 }),

    // Mode and status
    isLive: boolean("is_live").default(false).notNull(), // Live vs sandbox
    isEnabled: boolean("is_enabled").default(true).notNull(),

    // Supported currencies (null = all tenant currencies)
    supportedCurrencies: jsonb("supported_currencies").$type<string[]>(),

    // Transaction limits
    minAmount: decimal("min_amount", { precision: 12, scale: 2 }),
    maxAmount: decimal("max_amount", { precision: 12, scale: 2 }),

    // Additional gateway-specific settings
    settings: jsonb("settings").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One config per gateway per tenant
    uniqueIndex("payment_gateway_configs_tenant_gateway_idx").on(
      table.tenantId,
      table.gateway
    ),
    index("payment_gateway_configs_tenant_id_idx").on(table.tenantId),
    index("payment_gateway_configs_enabled_idx").on(
      table.tenantId,
      table.isEnabled
    ),
  ]
);

// ============================================================================
// PAYMENT WEBHOOK EVENTS (Audit log for all incoming webhooks)
// ============================================================================
// Logs all payment gateway webhook events for debugging and reconciliation.

export const paymentWebhookStatusEnum = pgEnum("payment_webhook_status", [
  "received", // Webhook received, not yet processed
  "processing", // Currently being processed
  "processed", // Successfully processed
  "failed", // Processing failed
  "ignored", // Intentionally ignored (duplicate, irrelevant)
]);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),

    // Gateway info
    gateway: paymentGatewayEnum("gateway").notNull(),

    // Event identification
    eventId: varchar("event_id", { length: 255 }), // Gateway's event ID
    eventType: varchar("event_type", { length: 100 }).notNull(), // "payment.completed", etc.

    // Raw payload (for debugging)
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    headers: jsonb("headers").$type<Record<string, string>>(),

    // Processing status
    status: paymentWebhookStatusEnum("status").default("received").notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),

    // Linked entities (populated after processing)
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    transactionId: uuid("transaction_id").references(
      () => orderTransactions.id,
      {
        onDelete: "set null",
      }
    ),

    // IP for security auditing
    sourceIp: varchar("source_ip", { length: 45 }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Prevent duplicate event processing
    uniqueIndex("payment_webhook_events_gateway_event_idx")
      .on(table.gateway, table.eventId)
      .where(sql`event_id IS NOT NULL`),
    index("payment_webhook_events_tenant_id_idx").on(table.tenantId),
    index("payment_webhook_events_status_idx").on(table.status),
    index("payment_webhook_events_created_at_idx").on(table.createdAt),
    index("payment_webhook_events_order_id_idx").on(table.orderId),
  ]
);

// ============================================================================
// PAYMENT SESSIONS (Track payment attempts)
// ============================================================================
// Tracks payment sessions created with gateways (for abandoned payment recovery).

export const paymentSessionStatusEnum = pgEnum("payment_session_status", [
  "pending", // Session created, awaiting payment
  "processing", // Payment in progress
  "completed", // Payment successful
  "failed", // Payment failed
  "expired", // Session expired
  "cancelled", // Cancelled by user
]);

export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // What this payment is for
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),

    // Payment details
    gateway: paymentGatewayEnum("gateway").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Gateway session info
    gatewaySessionId: varchar("gateway_session_id", { length: 255 }), // HesabPay session ID
    gatewaySessionUrl: text("gateway_session_url"), // Redirect URL for payment
    gatewayResponse: jsonb("gateway_response").$type<Record<string, unknown>>(),

    // Status
    status: paymentSessionStatusEnum("status").default("pending").notNull(),

    // Expiry
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),

    // Customer info (for guest checkout)
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 50 }),

    // Callback URLs
    successUrl: text("success_url"),
    cancelUrl: text("cancel_url"),

    // Result
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),
    failureReason: text("failure_reason"),

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payment_sessions_tenant_id_idx").on(table.tenantId),
    index("payment_sessions_order_id_idx").on(table.orderId),
    index("payment_sessions_invoice_id_idx").on(table.invoiceId),
    index("payment_sessions_status_idx").on(table.status),
    index("payment_sessions_gateway_session_idx").on(table.gatewaySessionId),
    index("payment_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// ============================================================================
// CRYPTO PAYMENTS (Self-hosted USDT verification)
// ============================================================================
// Tracks crypto payment sessions and manual verification workflow.
// Customer sends USDT to platform wallet, submits tx hash, admin verifies.

export const cryptoPayments = pgTable(
  "crypto_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentSessionId: uuid("payment_session_id")
      .notNull()
      .references(() => paymentSessions.id, { onDelete: "cascade" }),

    // Purpose: 'order' for store checkout, 'subscription' for Pro plan
    purpose: varchar("purpose", { length: 20 }).default("order"),
    // Tenant ID for subscription payments (store upgrading to Pro)
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),

    // Network and wallet
    network: cryptoNetworkEnum("network").notNull(), // trc20, erc20, bep20
    walletAddress: varchar("wallet_address", { length: 100 }).notNull(),

    // Amount
    expectedAmount: decimal("expected_amount", {
      precision: 20,
      scale: 8,
    }).notNull(), // USDT amount with high precision
    currency: varchar("currency", { length: 10 }).default("USDT").notNull(),

    // Exchange rate at time of payment (AFN to USDT)
    exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }),
    originalAmountAfn: decimal("original_amount_afn", {
      precision: 14,
      scale: 2,
    }), // Original order amount in AFN

    // Verification
    transactionHash: varchar("transaction_hash", { length: 100 }),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }), // When customer submitted tx hash
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    verifiedBy: text("verified_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // Status
    status: cryptoPaymentStatusEnum("status").default("pending").notNull(),

    // Expiration
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    // Notes
    customerNotes: text("customer_notes"), // Notes from customer when submitting
    adminNotes: text("admin_notes"), // Notes from admin when verifying/rejecting
    rejectionReason: text("rejection_reason"), // Why payment was rejected

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("crypto_payments_session_idx").on(table.paymentSessionId),
    index("crypto_payments_status_idx").on(table.status),
    index("crypto_payments_hash_idx").on(table.transactionHash),
    index("crypto_payments_expires_idx").on(table.expiresAt),
    index("crypto_payments_tenant_idx").on(table.tenantId),
    index("crypto_payments_purpose_idx").on(table.purpose),
  ]
);

// ============================================================================
// EXCHANGE RATES (For multi-currency support)
// ============================================================================
// Caches exchange rates from external APIs (Fawaz Ahmed Currency API).
// Used to display prices in customer's local currency and record rates at checkout.

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Base currency (always AFN for this platform)
    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),

    // Target currency (EUR, USD, GBP, AED, etc.)
    targetCurrency: varchar("target_currency", { length: 3 }).notNull(),

    // Exchange rate (1 base = X target)
    // e.g., 1 AFN = 0.011 USD means rate = 0.011
    rate: decimal("rate", { precision: 18, scale: 10 }).notNull(),

    // Source of the rate
    source: varchar("source", { length: 50 }).default("fawazahmed0"),

    // When the rate was fetched
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One rate per currency pair
    uniqueIndex("exchange_rates_base_target_idx").on(
      table.baseCurrency,
      table.targetCurrency
    ),
    index("exchange_rates_fetched_at_idx").on(table.fetchedAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [user.id],
    references: [userProfiles.userId],
  }),
  sessions: many(session),
  accounts: many(account),
  addresses: many(userAddresses),
  ownedTenants: many(tenants),
  tenantMemberships: many(tenantMembers),
  affiliate: one(affiliates, {
    fields: [user.id],
    references: [affiliates.userId],
  }),
  platformAffiliate: one(platformAffiliates, {
    fields: [user.id],
    references: [platformAffiliates.userId],
  }),
  deliveryProvider: one(deliveryProviders, {
    fields: [user.id],
    references: [deliveryProviders.userId],
  }),
  wishlists: many(wishlists),
  orders: many(orders),
  reviews: many(reviews),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Admin Audit Log Relations
export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  admin: one(user, {
    fields: [adminAuditLog.adminId],
    references: [user.id],
  }),
}));

// Billing Transactions Relations
export const billingTransactionsRelations = relations(
  billingTransactions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [billingTransactions.tenantId],
      references: [tenants.id],
    }),
    invoice: one(invoices, {
      fields: [billingTransactions.invoiceId],
      references: [invoices.id],
    }),
    processedBy: one(user, {
      fields: [billingTransactions.processedBy],
      references: [user.id],
    }),
  })
);

// Invoices Relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  transactions: many(billingTransactions),
}));

// Platform Settings Relations
export const platformSettingsRelations = relations(
  platformSettings,
  ({ one }) => ({
    updater: one(user, {
      fields: [platformSettings.updatedBy],
      references: [user.id],
    }),
  })
);

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(user, {
    fields: [userAddresses.userId],
    references: [user.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(user, {
    fields: [tenants.ownerId],
    references: [user.id],
  }),
  members: many(tenantMembers),
  storeCustomers: many(storeCustomers),
  media: many(media),
  products: many(products),
  categories: many(categories),
  orders: many(orders),
  carts: many(carts),
  wishlists: many(wishlists),
  wishlistItems: many(wishlistItems),
  // Variants
  variantOptions: many(variantOptions),
  variantOptionValues: many(variantOptionValues),
  productVariants: many(productVariants),
  productVariantOptions: many(productVariantOptions),
  productVariantImages: many(productVariantImages),
  optionValueImages: many(optionValueImages),
  // Pricing
  priceTiers: many(priceTiers),
  customerGroups: many(customerGroups),
  customerGroupMembers: many(customerGroupMembers),
  customerGroupPrices: many(customerGroupPrices),
  scheduledSales: many(scheduledSales),
  saleCampaigns: many(saleCampaigns),
  // Inventory
  inventoryLocations: many(inventoryLocations),
  inventoryLevels: many(inventoryLevels),
  inventoryCounts: many(inventoryCounts),
  inventoryMovements: many(inventoryMovements),
  // Shipping
  shippingZones: many(shippingZones),
  shippingMethods: many(shippingMethods),
  deliveryZones: many(deliveryZones),
  shippingWeightTiers: many(shippingWeightTiers),
  shipments: many(shipments),
  // Commission & Finance
  commissionTransactions: many(commissionTransactions),
  commissionRules: many(commissionRules),
  sellerPayoutMethods: many(sellerPayoutMethods),
  sellerTransactions: many(sellerTransactions),
  sellerPayouts: many(sellerPayouts),
  // Billing
  billingTransactions: many(billingTransactions),
  invoices: many(invoices),
  // Reviews
  reviews: many(reviews),
  reviewMedia: many(reviewMedia),
  // Affiliates
  affiliateTenantPartnerships: many(affiliateTenantPartnerships),
  affiliateLinks: many(affiliateLinks),
  affiliateClicks: many(affiliateClicks),
  affiliateConversions: many(affiliateConversions),
  affiliateRatings: many(affiliateRatings),
  // Delivery
  deliveryTenantPartnerships: many(deliveryTenantPartnerships),
  deliveryAssignments: many(deliveryAssignments),
  deliveryRatings: many(deliveryRatings),
  // Analytics
  dailySnapshots: many(analyticsDailySnapshots),
  hourlyMetrics: many(analyticsHourlyMetrics),
  pageViews: many(analyticsPageViews),
  conversionEvents: many(analyticsConversionEvents),
  productPerformance: many(analyticsProductPerformance),
  categoryPerformance: many(analyticsCategoryPerformance),
  trafficSources: many(analyticsTrafficSources),
  geographicSales: many(analyticsGeographicSales),
  // Store Locations
  storeLocations: many(storeLocations),
  // Platform Affiliate
  platformAffiliateReferral: one(platformAffiliateReferrals, {
    fields: [tenants.id],
    references: [platformAffiliateReferrals.tenantId],
  }),
}));

export const storeLocationsRelations = relations(storeLocations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [storeLocations.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [tenantMembers.userId],
    references: [user.id],
  }),
}));

export const storeTransferRequestsRelations = relations(
  storeTransferRequests,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [storeTransferRequests.tenantId],
      references: [tenants.id],
    }),
    fromUser: one(user, {
      fields: [storeTransferRequests.fromUserId],
      references: [user.id],
      relationName: "transferFromUser",
    }),
    toUser: one(user, {
      fields: [storeTransferRequests.toUserId],
      references: [user.id],
      relationName: "transferToUser",
    }),
  })
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [pushSubscriptions.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [pushSubscriptions.userId],
      references: [user.id],
    }),
  })
);

export const userNotificationPreferencesRelations = relations(
  userNotificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [userNotificationPreferences.userId],
      references: [user.id],
    }),
  })
);

export const storeNotificationPreferencesRelations = relations(
  storeNotificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [storeNotificationPreferences.userId],
      references: [user.id],
    }),
    tenant: one(tenants, {
      fields: [storeNotificationPreferences.tenantId],
      references: [tenants.id],
    }),
  })
);

export const customerNotificationPreferencesRelations = relations(
  customerNotificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [customerNotificationPreferences.userId],
      references: [user.id],
    }),
    tenant: one(tenants, {
      fields: [customerNotificationPreferences.tenantId],
      references: [tenants.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
}));

export const storeCustomersRelations = relations(
  storeCustomers,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [storeCustomers.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [storeCustomers.userId],
      references: [user.id],
    }),
    orders: many(orders),
  })
);

export const wishlistsRelations = relations(wishlists, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [wishlists.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [wishlists.userId],
    references: [user.id],
  }),
  items: many(wishlistItems),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [wishlistItems.tenantId],
    references: [tenants.id],
  }),
  wishlist: one(wishlists, {
    fields: [wishlistItems.wishlistId],
    references: [wishlists.id],
  }),
  product: one(products, {
    fields: [wishlistItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [wishlistItems.variantId],
    references: [productVariants.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  image: one(media, {
    fields: [categories.imageId],
    references: [media.id],
  }),
  products: many(products),
  productCategories: many(productCategories),
  commissionRules: many(commissionRules),
  affiliateLinks: many(affiliateLinks),
  // Analytics
  categoryPerformance: many(analyticsCategoryPerformance),
  pageViews: many(analyticsPageViews),
  conversionEvents: many(analyticsConversionEvents),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  productCategories: many(productCategories),
  images: many(productImages),
  variants: many(productVariants),
  optionValueImages: many(optionValueImages),
  inventoryLevels: many(inventoryLevels),
  inventoryMovements: many(inventoryMovements),
  inventoryCountItems: many(inventoryCountItems),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  reviews: many(reviews),
  wishlistItems: many(wishlistItems),
  commissionRules: many(commissionRules),
  affiliateLinks: many(affiliateLinks),
  // Pricing
  priceTiers: many(priceTiers),
  customerGroupPrices: many(customerGroupPrices),
  scheduledSales: many(scheduledSales),
  // Analytics
  productPerformance: many(analyticsProductPerformance),
  pageViews: many(analyticsPageViews),
  conversionEvents: many(analyticsConversionEvents),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [media.tenantId],
    references: [tenants.id],
  }),
  uploadedBy: one(user, {
    fields: [media.uploadedById],
    references: [user.id],
  }),
  productImages: many(productImages),
  productVariants: many(productVariants),
  productVariantImages: many(productVariantImages),
  optionValueImages: many(optionValueImages),
  categories: many(categories),
  reviewMedia: many(reviewMedia),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  media: one(media, {
    fields: [productImages.mediaId],
    references: [media.id],
  }),
}));

export const productCategoriesRelations = relations(
  productCategories,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategories.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategories.categoryId],
      references: [categories.id],
    }),
  })
);

export const variantOptionsRelations = relations(
  variantOptions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [variantOptions.tenantId],
      references: [tenants.id],
    }),
    values: many(variantOptionValues),
  })
);

export const variantOptionValuesRelations = relations(
  variantOptionValues,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [variantOptionValues.tenantId],
      references: [tenants.id],
    }),
    option: one(variantOptions, {
      fields: [variantOptionValues.optionId],
      references: [variantOptions.id],
    }),
    productVariantOptions: many(productVariantOptions),
    optionValueImages: many(optionValueImages),
  })
);

export const optionValueImagesRelations = relations(
  optionValueImages,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [optionValueImages.tenantId],
      references: [tenants.id],
    }),
    product: one(products, {
      fields: [optionValueImages.productId],
      references: [products.id],
    }),
    optionValue: one(variantOptionValues, {
      fields: [optionValueImages.optionValueId],
      references: [variantOptionValues.id],
    }),
    media: one(media, {
      fields: [optionValueImages.mediaId],
      references: [media.id],
    }),
  })
);

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [productVariants.tenantId],
      references: [tenants.id],
    }),
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    image: one(media, {
      fields: [productVariants.imageId],
      references: [media.id],
    }),
    images: many(productVariantImages),
    options: many(productVariantOptions),
    inventoryLevels: many(inventoryLevels),
    inventoryMovements: many(inventoryMovements),
    inventoryCountItems: many(inventoryCountItems),
    cartItems: many(cartItems),
    orderItems: many(orderItems),
    wishlistItems: many(wishlistItems),
    reviews: many(reviews),
    conversionEvents: many(analyticsConversionEvents),
  })
);

export const productVariantImagesRelations = relations(
  productVariantImages,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [productVariantImages.tenantId],
      references: [tenants.id],
    }),
    variant: one(productVariants, {
      fields: [productVariantImages.variantId],
      references: [productVariants.id],
    }),
    media: one(media, {
      fields: [productVariantImages.mediaId],
      references: [media.id],
    }),
  })
);

export const productVariantOptionsRelations = relations(
  productVariantOptions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [productVariantOptions.tenantId],
      references: [tenants.id],
    }),
    variant: one(productVariants, {
      fields: [productVariantOptions.variantId],
      references: [productVariants.id],
    }),
    optionValue: one(variantOptionValues, {
      fields: [productVariantOptions.optionValueId],
      references: [variantOptionValues.id],
    }),
  })
);

// ============================================================================
// PRICING RELATIONS
// ============================================================================

export const priceTiersRelations = relations(priceTiers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [priceTiers.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [priceTiers.productId],
    references: [products.id],
  }),
}));

export const customerGroupsRelations = relations(
  customerGroups,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [customerGroups.tenantId],
      references: [tenants.id],
    }),
    members: many(customerGroupMembers),
    prices: many(customerGroupPrices),
  })
);

export const customerGroupMembersRelations = relations(
  customerGroupMembers,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [customerGroupMembers.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [customerGroupMembers.userId],
      references: [user.id],
    }),
    customerGroup: one(customerGroups, {
      fields: [customerGroupMembers.customerGroupId],
      references: [customerGroups.id],
    }),
  })
);

export const customerGroupPricesRelations = relations(
  customerGroupPrices,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [customerGroupPrices.tenantId],
      references: [tenants.id],
    }),
    product: one(products, {
      fields: [customerGroupPrices.productId],
      references: [products.id],
    }),
    customerGroup: one(customerGroups, {
      fields: [customerGroupPrices.customerGroupId],
      references: [customerGroups.id],
    }),
  })
);

export const saleCampaignsRelations = relations(saleCampaigns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [saleCampaigns.tenantId],
    references: [tenants.id],
  }),
}));

export const scheduledSalesRelations = relations(scheduledSales, ({ one }) => ({
  tenant: one(tenants, {
    fields: [scheduledSales.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [scheduledSales.productId],
    references: [products.id],
  }),
}));

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [inventoryMovements.tenantId],
      references: [tenants.id],
    }),
    location: one(inventoryLocations, {
      fields: [inventoryMovements.locationId],
      references: [inventoryLocations.id],
    }),
    product: one(products, {
      fields: [inventoryMovements.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [inventoryMovements.variantId],
      references: [productVariants.id],
    }),
    order: one(orders, {
      fields: [inventoryMovements.orderId],
      references: [orders.id],
    }),
    shipment: one(shipments, {
      fields: [inventoryMovements.shipmentId],
      references: [shipments.id],
    }),
    user: one(user, {
      fields: [inventoryMovements.userId],
      references: [user.id],
    }),
  })
);

export const cartsRelations = relations(carts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [carts.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [carts.userId],
    references: [user.id],
  }),
  items: many(cartItems),
  conversionEvents: many(analyticsConversionEvents),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [orders.userId],
    references: [user.id],
  }),
  storeCustomer: one(storeCustomers, {
    fields: [orders.storeCustomerId],
    references: [storeCustomers.id],
  }),
  cashier: one(user, {
    fields: [orders.cashierId],
    references: [user.id],
    relationName: "orderCashier",
  }),
  items: many(orderItems),
  payments: many(orderPayments),
  transactions: many(orderTransactions),
  refunds: many(refunds),
  discounts: many(orderDiscounts),
  events: many(orderEvents),
  couponUsages: many(couponUsages),
  shipments: many(shipments),
  reviews: many(reviews),
  inventoryMovements: many(inventoryMovements),
  commissionTransactions: many(commissionTransactions),
  sellerTransactions: many(sellerTransactions),
  affiliateClicks: many(affiliateClicks),
  affiliateConversions: many(affiliateConversions),
  conversionEvents: many(analyticsConversionEvents),
  storeCreditTransactions: many(storeCreditTransactions),
  invoiceTokens: many(orderInvoiceTokens),
}));

export const orderInvoiceTokensRelations = relations(
  orderInvoiceTokens,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderInvoiceTokens.orderId],
      references: [orders.id],
    }),
    tenant: one(tenants, {
      fields: [orderInvoiceTokens.tenantId],
      references: [tenants.id],
    }),
    createdByUser: one(user, {
      fields: [orderInvoiceTokens.createdBy],
      references: [user.id],
    }),
  })
);

export const orderPaymentsRelations = relations(orderPayments, ({ one }) => ({
  order: one(orders, {
    fields: [orderPayments.orderId],
    references: [orders.id],
  }),
  recordedByUser: one(user, {
    fields: [orderPayments.recordedBy],
    references: [user.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  shipmentItems: many(shipmentItems),
  sellerTransactions: many(sellerTransactions),
  refundItems: many(refundItems),
  discounts: many(orderDiscounts),
}));

export const shippingZonesRelations = relations(
  shippingZones,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [shippingZones.tenantId],
      references: [tenants.id],
    }),
    methods: many(shippingMethods),
  })
);

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  tenant: one(tenants, {
    fields: [deliveryZones.tenantId],
    references: [tenants.id],
  }),
}));

export const shippingMethodsRelations = relations(
  shippingMethods,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [shippingMethods.tenantId],
      references: [tenants.id],
    }),
    zone: one(shippingZones, {
      fields: [shippingMethods.zoneId],
      references: [shippingZones.id],
    }),
    weightTiers: many(shippingWeightTiers),
    shipments: many(shipments),
  })
);

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shipments.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [shipments.orderId],
    references: [orders.id],
  }),
  shippingMethod: one(shippingMethods, {
    fields: [shipments.shippingMethodId],
    references: [shippingMethods.id],
  }),
  items: many(shipmentItems),
  trackingEvents: many(shipmentTrackingEvents),
  inventoryMovements: many(inventoryMovements),
  deliveryAssignments: many(deliveryAssignments),
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentItems.shipmentId],
    references: [shipments.id],
  }),
  orderItem: one(orderItems, {
    fields: [shipmentItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export const shipmentTrackingEventsRelations = relations(
  shipmentTrackingEvents,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentTrackingEvents.shipmentId],
      references: [shipments.id],
    }),
  })
);

// ============================================================================
// UNIFIED DELIVERY SYSTEM RELATIONS
// ============================================================================

export const unifiedDeliveryZonesRelations = relations(
  unifiedDeliveryZones,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [unifiedDeliveryZones.tenantId],
      references: [tenants.id],
    }),
    methods: many(unifiedDeliveryMethods),
  })
);

export const unifiedDeliveryMethodsRelations = relations(
  unifiedDeliveryMethods,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [unifiedDeliveryMethods.tenantId],
      references: [tenants.id],
    }),
    zone: one(unifiedDeliveryZones, {
      fields: [unifiedDeliveryMethods.zoneId],
      references: [unifiedDeliveryZones.id],
    }),
    weightTiers: many(unifiedWeightTiers),
  })
);

export const unifiedWeightTiersRelations = relations(
  unifiedWeightTiers,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [unifiedWeightTiers.tenantId],
      references: [tenants.id],
    }),
    method: one(unifiedDeliveryMethods, {
      fields: [unifiedWeightTiers.methodId],
      references: [unifiedDeliveryMethods.id],
    }),
  })
);

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [reviews.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [reviews.variantId],
    references: [productVariants.id],
  }),
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id],
  }),
  user: one(user, {
    fields: [reviews.userId],
    references: [user.id],
  }),
  images: many(reviewMedia),
  votes: many(reviewVotes),
}));

export const reviewMediaRelations = relations(reviewMedia, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviewMedia.tenantId],
    references: [tenants.id],
  }),
  review: one(reviews, {
    fields: [reviewMedia.reviewId],
    references: [reviews.id],
  }),
  media: one(media, {
    fields: [reviewMedia.mediaId],
    references: [media.id],
  }),
}));

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviewVotes.tenantId],
    references: [tenants.id],
  }),
  review: one(reviews, {
    fields: [reviewVotes.reviewId],
    references: [reviews.id],
  }),
  user: one(user, {
    fields: [reviewVotes.userId],
    references: [user.id],
  }),
}));

export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviewRequests.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [reviewRequests.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [reviewRequests.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [reviewRequests.userId],
    references: [user.id],
  }),
  review: one(reviews, {
    fields: [reviewRequests.reviewId],
    references: [reviews.id],
  }),
}));

export const commissionTransactionsRelations = relations(
  commissionTransactions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [commissionTransactions.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [commissionTransactions.orderId],
      references: [orders.id],
    }),
    processedByUser: one(user, {
      fields: [commissionTransactions.processedBy],
      references: [user.id],
    }),
  })
);

// Analytics Relations
export const analyticsDailySnapshotsRelations = relations(
  analyticsDailySnapshots,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsDailySnapshots.tenantId],
      references: [tenants.id],
    }),
  })
);

export const analyticsProductPerformanceRelations = relations(
  analyticsProductPerformance,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsProductPerformance.tenantId],
      references: [tenants.id],
    }),
    product: one(products, {
      fields: [analyticsProductPerformance.productId],
      references: [products.id],
    }),
  })
);

export const analyticsCategoryPerformanceRelations = relations(
  analyticsCategoryPerformance,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsCategoryPerformance.tenantId],
      references: [tenants.id],
    }),
    category: one(categories, {
      fields: [analyticsCategoryPerformance.categoryId],
      references: [categories.id],
    }),
  })
);

export const analyticsTrafficSourcesRelations = relations(
  analyticsTrafficSources,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsTrafficSources.tenantId],
      references: [tenants.id],
    }),
  })
);

export const analyticsGeographicSalesRelations = relations(
  analyticsGeographicSales,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsGeographicSales.tenantId],
      references: [tenants.id],
    }),
  })
);

export const analyticsHourlyMetricsRelations = relations(
  analyticsHourlyMetrics,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsHourlyMetrics.tenantId],
      references: [tenants.id],
    }),
  })
);

export const analyticsPageViewsRelations = relations(
  analyticsPageViews,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsPageViews.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [analyticsPageViews.userId],
      references: [user.id],
    }),
    product: one(products, {
      fields: [analyticsPageViews.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [analyticsPageViews.categoryId],
      references: [categories.id],
    }),
  })
);

export const analyticsConversionEventsRelations = relations(
  analyticsConversionEvents,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [analyticsConversionEvents.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [analyticsConversionEvents.userId],
      references: [user.id],
    }),
    product: one(products, {
      fields: [analyticsConversionEvents.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [analyticsConversionEvents.variantId],
      references: [productVariants.id],
    }),
    category: one(categories, {
      fields: [analyticsConversionEvents.categoryId],
      references: [categories.id],
    }),
    order: one(orders, {
      fields: [analyticsConversionEvents.orderId],
      references: [orders.id],
    }),
    cart: one(carts, {
      fields: [analyticsConversionEvents.cartId],
      references: [carts.id],
    }),
  })
);

// Inventory Relations
export const inventoryLocationsRelations = relations(
  inventoryLocations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [inventoryLocations.tenantId],
      references: [tenants.id],
    }),
    levels: many(inventoryLevels),
    movements: many(inventoryMovements),
    counts: many(inventoryCounts),
  })
);

export const inventoryLevelsRelations = relations(
  inventoryLevels,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [inventoryLevels.tenantId],
      references: [tenants.id],
    }),
    location: one(inventoryLocations, {
      fields: [inventoryLevels.locationId],
      references: [inventoryLocations.id],
    }),
    product: one(products, {
      fields: [inventoryLevels.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [inventoryLevels.variantId],
      references: [productVariants.id],
    }),
  })
);

export const inventoryCountsRelations = relations(
  inventoryCounts,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [inventoryCounts.tenantId],
      references: [tenants.id],
    }),
    location: one(inventoryLocations, {
      fields: [inventoryCounts.locationId],
      references: [inventoryLocations.id],
    }),
    countedBy: one(user, {
      fields: [inventoryCounts.countedById],
      references: [user.id],
    }),
    verifiedBy: one(user, {
      fields: [inventoryCounts.verifiedById],
      references: [user.id],
    }),
    items: many(inventoryCountItems),
  })
);

export const inventoryCountItemsRelations = relations(
  inventoryCountItems,
  ({ one }) => ({
    count: one(inventoryCounts, {
      fields: [inventoryCountItems.countId],
      references: [inventoryCounts.id],
    }),
    product: one(products, {
      fields: [inventoryCountItems.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [inventoryCountItems.variantId],
      references: [productVariants.id],
    }),
  })
);

// Shipping Weight Tiers Relations
export const shippingWeightTiersRelations = relations(
  shippingWeightTiers,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [shippingWeightTiers.tenantId],
      references: [tenants.id],
    }),
    method: one(shippingMethods, {
      fields: [shippingWeightTiers.methodId],
      references: [shippingMethods.id],
    }),
  })
);

// Commission Relations
export const commissionRulesRelations = relations(
  commissionRules,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [commissionRules.tenantId],
      references: [tenants.id],
    }),
    category: one(categories, {
      fields: [commissionRules.categoryId],
      references: [categories.id],
    }),
    product: one(products, {
      fields: [commissionRules.productId],
      references: [products.id],
    }),
  })
);

export const commissionTiersRelations = relations(
  commissionTiers,
  ({ many }) => ({
    sellerBalances: many(sellerBalances),
  })
);

// Seller Finance Relations
export const sellerBalancesRelations = relations(sellerBalances, ({ one }) => ({
  tenant: one(tenants, {
    fields: [sellerBalances.tenantId],
    references: [tenants.id],
  }),
  currentTier: one(commissionTiers, {
    fields: [sellerBalances.currentTierId],
    references: [commissionTiers.id],
  }),
}));

export const sellerPayoutMethodsRelations = relations(
  sellerPayoutMethods,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [sellerPayoutMethods.tenantId],
      references: [tenants.id],
    }),
    payouts: many(sellerPayouts),
  })
);

export const sellerTransactionsRelations = relations(
  sellerTransactions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [sellerTransactions.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [sellerTransactions.orderId],
      references: [orders.id],
    }),
    orderItem: one(orderItems, {
      fields: [sellerTransactions.orderItemId],
      references: [orderItems.id],
    }),
    payoutItems: many(sellerPayoutItems),
  })
);

export const sellerPayoutsRelations = relations(
  sellerPayouts,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [sellerPayouts.tenantId],
      references: [tenants.id],
    }),
    payoutMethod: one(sellerPayoutMethods, {
      fields: [sellerPayouts.payoutMethodId],
      references: [sellerPayoutMethods.id],
    }),
    processedBy: one(user, {
      fields: [sellerPayouts.processedById],
      references: [user.id],
    }),
    items: many(sellerPayoutItems),
  })
);

export const sellerPayoutItemsRelations = relations(
  sellerPayoutItems,
  ({ one }) => ({
    payout: one(sellerPayouts, {
      fields: [sellerPayoutItems.payoutId],
      references: [sellerPayouts.id],
    }),
    transaction: one(sellerTransactions, {
      fields: [sellerPayoutItems.transactionId],
      references: [sellerTransactions.id],
    }),
  })
);

// Affiliate Relations
export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  user: one(user, {
    fields: [affiliates.userId],
    references: [user.id],
  }),
  payoutMethods: many(affiliatePayoutMethods),
  partnerships: many(affiliateTenantPartnerships),
  links: many(affiliateLinks),
  clicks: many(affiliateClicks),
  conversions: many(affiliateConversions),
  payouts: many(affiliatePayouts),
  ratings: many(affiliateRatings),
}));

export const affiliatePayoutMethodsRelations = relations(
  affiliatePayoutMethods,
  ({ one, many }) => ({
    affiliate: one(affiliates, {
      fields: [affiliatePayoutMethods.affiliateId],
      references: [affiliates.id],
    }),
    payouts: many(affiliatePayouts),
  })
);

export const affiliateTenantPartnershipsRelations = relations(
  affiliateTenantPartnerships,
  ({ one, many }) => ({
    affiliate: one(affiliates, {
      fields: [affiliateTenantPartnerships.affiliateId],
      references: [affiliates.id],
    }),
    tenant: one(tenants, {
      fields: [affiliateTenantPartnerships.tenantId],
      references: [tenants.id],
    }),
    links: many(affiliateLinks),
    conversions: many(affiliateConversions),
    ratings: many(affiliateRatings),
  })
);

export const affiliateLinksRelations = relations(
  affiliateLinks,
  ({ one, many }) => ({
    affiliate: one(affiliates, {
      fields: [affiliateLinks.affiliateId],
      references: [affiliates.id],
    }),
    tenant: one(tenants, {
      fields: [affiliateLinks.tenantId],
      references: [tenants.id],
    }),
    partnership: one(affiliateTenantPartnerships, {
      fields: [affiliateLinks.partnershipId],
      references: [affiliateTenantPartnerships.id],
    }),
    product: one(products, {
      fields: [affiliateLinks.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [affiliateLinks.categoryId],
      references: [categories.id],
    }),
    clicks: many(affiliateClicks),
    conversions: many(affiliateConversions),
  })
);

export const affiliateClicksRelations = relations(
  affiliateClicks,
  ({ one }) => ({
    link: one(affiliateLinks, {
      fields: [affiliateClicks.linkId],
      references: [affiliateLinks.id],
    }),
    affiliate: one(affiliates, {
      fields: [affiliateClicks.affiliateId],
      references: [affiliates.id],
    }),
    tenant: one(tenants, {
      fields: [affiliateClicks.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [affiliateClicks.orderId],
      references: [orders.id],
    }),
  })
);

export const affiliateConversionsRelations = relations(
  affiliateConversions,
  ({ one }) => ({
    affiliate: one(affiliates, {
      fields: [affiliateConversions.affiliateId],
      references: [affiliates.id],
    }),
    tenant: one(tenants, {
      fields: [affiliateConversions.tenantId],
      references: [tenants.id],
    }),
    partnership: one(affiliateTenantPartnerships, {
      fields: [affiliateConversions.partnershipId],
      references: [affiliateTenantPartnerships.id],
    }),
    link: one(affiliateLinks, {
      fields: [affiliateConversions.linkId],
      references: [affiliateLinks.id],
    }),
    click: one(affiliateClicks, {
      fields: [affiliateConversions.clickId],
      references: [affiliateClicks.id],
    }),
    order: one(orders, {
      fields: [affiliateConversions.orderId],
      references: [orders.id],
    }),
  })
);

export const affiliatePayoutsRelations = relations(
  affiliatePayouts,
  ({ one }) => ({
    affiliate: one(affiliates, {
      fields: [affiliatePayouts.affiliateId],
      references: [affiliates.id],
    }),
    payoutMethod: one(affiliatePayoutMethods, {
      fields: [affiliatePayouts.payoutMethodId],
      references: [affiliatePayoutMethods.id],
    }),
    processedBy: one(user, {
      fields: [affiliatePayouts.processedById],
      references: [user.id],
    }),
  })
);

export const affiliateRatingsRelations = relations(
  affiliateRatings,
  ({ one }) => ({
    affiliate: one(affiliates, {
      fields: [affiliateRatings.affiliateId],
      references: [affiliates.id],
    }),
    tenant: one(tenants, {
      fields: [affiliateRatings.tenantId],
      references: [tenants.id],
    }),
    partnership: one(affiliateTenantPartnerships, {
      fields: [affiliateRatings.partnershipId],
      references: [affiliateTenantPartnerships.id],
    }),
    ratedBy: one(user, {
      fields: [affiliateRatings.ratedById],
      references: [user.id],
    }),
  })
);

// Platform Affiliate Relations
export const platformAffiliatesRelations = relations(
  platformAffiliates,
  ({ one, many }) => ({
    user: one(user, {
      fields: [platformAffiliates.userId],
      references: [user.id],
    }),
    approvedByUser: one(user, {
      fields: [platformAffiliates.approvedBy],
      references: [user.id],
    }),
    clicks: many(platformAffiliateClicks),
    referrals: many(platformAffiliateReferrals),
    commissions: many(platformAffiliateCommissions),
    payouts: many(platformAffiliatePayouts),
  })
);

export const platformAffiliateClicksRelations = relations(
  platformAffiliateClicks,
  ({ one }) => ({
    affiliate: one(platformAffiliates, {
      fields: [platformAffiliateClicks.affiliateId],
      references: [platformAffiliates.id],
    }),
    referral: one(platformAffiliateReferrals, {
      fields: [platformAffiliateClicks.referralId],
      references: [platformAffiliateReferrals.id],
    }),
  })
);

export const platformAffiliateReferralsRelations = relations(
  platformAffiliateReferrals,
  ({ one, many }) => ({
    affiliate: one(platformAffiliates, {
      fields: [platformAffiliateReferrals.affiliateId],
      references: [platformAffiliates.id],
    }),
    tenant: one(tenants, {
      fields: [platformAffiliateReferrals.tenantId],
      references: [tenants.id],
    }),
    click: one(platformAffiliateClicks, {
      fields: [platformAffiliateReferrals.clickId],
      references: [platformAffiliateClicks.id],
    }),
    commissions: many(platformAffiliateCommissions),
  })
);

export const platformAffiliateCommissionsRelations = relations(
  platformAffiliateCommissions,
  ({ one }) => ({
    affiliate: one(platformAffiliates, {
      fields: [platformAffiliateCommissions.affiliateId],
      references: [platformAffiliates.id],
    }),
    referral: one(platformAffiliateReferrals, {
      fields: [platformAffiliateCommissions.referralId],
      references: [platformAffiliateReferrals.id],
    }),
    tenant: one(tenants, {
      fields: [platformAffiliateCommissions.tenantId],
      references: [tenants.id],
    }),
    payout: one(platformAffiliatePayouts, {
      fields: [platformAffiliateCommissions.payoutId],
      references: [platformAffiliatePayouts.id],
    }),
  })
);

export const platformAffiliatePayoutsRelations = relations(
  platformAffiliatePayouts,
  ({ one, many }) => ({
    affiliate: one(platformAffiliates, {
      fields: [platformAffiliatePayouts.affiliateId],
      references: [platformAffiliates.id],
    }),
    processedByUser: one(user, {
      fields: [platformAffiliatePayouts.processedBy],
      references: [user.id],
    }),
    commissions: many(platformAffiliateCommissions),
  })
);

// Delivery Provider Relations
export const deliveryProvidersRelations = relations(
  deliveryProviders,
  ({ one, many }) => ({
    user: one(user, {
      fields: [deliveryProviders.userId],
      references: [user.id],
    }),
    payoutMethods: many(deliveryPayoutMethods),
    zones: many(deliveryProviderZones),
    partnerships: many(deliveryTenantPartnerships),
    assignments: many(deliveryAssignments),
    ratings: many(deliveryRatings),
    payouts: many(deliveryPayouts),
  })
);

export const deliveryPayoutMethodsRelations = relations(
  deliveryPayoutMethods,
  ({ one, many }) => ({
    provider: one(deliveryProviders, {
      fields: [deliveryPayoutMethods.providerId],
      references: [deliveryProviders.id],
    }),
    payouts: many(deliveryPayouts),
  })
);

export const deliveryProviderZonesRelations = relations(
  deliveryProviderZones,
  ({ one }) => ({
    provider: one(deliveryProviders, {
      fields: [deliveryProviderZones.providerId],
      references: [deliveryProviders.id],
    }),
  })
);

export const deliveryTenantPartnershipsRelations = relations(
  deliveryTenantPartnerships,
  ({ one, many }) => ({
    provider: one(deliveryProviders, {
      fields: [deliveryTenantPartnerships.providerId],
      references: [deliveryProviders.id],
    }),
    tenant: one(tenants, {
      fields: [deliveryTenantPartnerships.tenantId],
      references: [tenants.id],
    }),
    assignments: many(deliveryAssignments),
  })
);

export const deliveryAssignmentsRelations = relations(
  deliveryAssignments,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [deliveryAssignments.tenantId],
      references: [tenants.id],
    }),
    shipment: one(shipments, {
      fields: [deliveryAssignments.shipmentId],
      references: [shipments.id],
    }),
    provider: one(deliveryProviders, {
      fields: [deliveryAssignments.providerId],
      references: [deliveryProviders.id],
    }),
    partnership: one(deliveryTenantPartnerships, {
      fields: [deliveryAssignments.partnershipId],
      references: [deliveryTenantPartnerships.id],
    }),
    trackingEvents: many(deliveryTrackingEvents),
    ratings: many(deliveryRatings),
    payoutItems: many(deliveryPayoutItems),
  })
);

export const deliveryTrackingEventsRelations = relations(
  deliveryTrackingEvents,
  ({ one }) => ({
    assignment: one(deliveryAssignments, {
      fields: [deliveryTrackingEvents.assignmentId],
      references: [deliveryAssignments.id],
    }),
  })
);

export const deliveryRatingsRelations = relations(
  deliveryRatings,
  ({ one }) => ({
    provider: one(deliveryProviders, {
      fields: [deliveryRatings.providerId],
      references: [deliveryProviders.id],
    }),
    assignment: one(deliveryAssignments, {
      fields: [deliveryRatings.assignmentId],
      references: [deliveryAssignments.id],
    }),
    tenant: one(tenants, {
      fields: [deliveryRatings.tenantId],
      references: [tenants.id],
    }),
    ratedBy: one(user, {
      fields: [deliveryRatings.ratedById],
      references: [user.id],
    }),
  })
);

export const deliveryPayoutsRelations = relations(
  deliveryPayouts,
  ({ one, many }) => ({
    provider: one(deliveryProviders, {
      fields: [deliveryPayouts.providerId],
      references: [deliveryProviders.id],
    }),
    payoutMethod: one(deliveryPayoutMethods, {
      fields: [deliveryPayouts.payoutMethodId],
      references: [deliveryPayoutMethods.id],
    }),
    processedBy: one(user, {
      fields: [deliveryPayouts.processedById],
      references: [user.id],
    }),
    items: many(deliveryPayoutItems),
  })
);

export const deliveryPayoutItemsRelations = relations(
  deliveryPayoutItems,
  ({ one }) => ({
    payout: one(deliveryPayouts, {
      fields: [deliveryPayoutItems.payoutId],
      references: [deliveryPayouts.id],
    }),
    assignment: one(deliveryAssignments, {
      fields: [deliveryPayoutItems.assignmentId],
      references: [deliveryAssignments.id],
    }),
  })
);

// ============================================================================
// UNIFIED COMMERCE RELATIONS
// ============================================================================

export const orderTransactionsRelations = relations(
  orderTransactions,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderTransactions.orderId],
      references: [orders.id],
    }),
    tenant: one(tenants, {
      fields: [orderTransactions.tenantId],
      references: [tenants.id],
    }),
    recordedByUser: one(user, {
      fields: [orderTransactions.recordedBy],
      references: [user.id],
      relationName: "transactionRecordedBy",
    }),
    authorizedByUser: one(user, {
      fields: [orderTransactions.authorizedBy],
      references: [user.id],
      relationName: "transactionAuthorizedBy",
    }),
    parentTransaction: one(orderTransactions, {
      fields: [orderTransactions.parentTransactionId],
      references: [orderTransactions.id],
      relationName: "transactionParent",
    }),
    refund: one(refunds, {
      fields: [orderTransactions.refundId],
      references: [refunds.id],
    }),
  })
);

export const cryptoPaymentsRelations = relations(cryptoPayments, ({ one }) => ({
  paymentSession: one(paymentSessions, {
    fields: [cryptoPayments.paymentSessionId],
    references: [paymentSessions.id],
  }),
  verifier: one(user, {
    fields: [cryptoPayments.verifiedBy],
    references: [user.id],
  }),
  tenant: one(tenants, {
    fields: [cryptoPayments.tenantId],
    references: [tenants.id],
  }),
}));

export const refundsRelations = relations(refunds, ({ one, many }) => ({
  order: one(orders, {
    fields: [refunds.orderId],
    references: [orders.id],
  }),
  tenant: one(tenants, {
    fields: [refunds.tenantId],
    references: [tenants.id],
  }),
  requestedByUser: one(user, {
    fields: [refunds.requestedBy],
    references: [user.id],
    relationName: "refundRequestedBy",
  }),
  approvedByUser: one(user, {
    fields: [refunds.approvedBy],
    references: [user.id],
    relationName: "refundApprovedBy",
  }),
  processedByUser: one(user, {
    fields: [refunds.processedBy],
    references: [user.id],
    relationName: "refundProcessedBy",
  }),
  rejectedByUser: one(user, {
    fields: [refunds.rejectedBy],
    references: [user.id],
    relationName: "refundRejectedBy",
  }),
  items: many(refundItems),
  transactions: many(orderTransactions),
  storeCredit: one(storeCredits, {
    fields: [refunds.storeCreditId],
    references: [storeCredits.id],
  }),
}));

export const refundItemsRelations = relations(refundItems, ({ one }) => ({
  refund: one(refunds, {
    fields: [refundItems.refundId],
    references: [refunds.id],
  }),
  orderItem: one(orderItems, {
    fields: [refundItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [coupons.tenantId],
    references: [tenants.id],
  }),
  usages: many(couponUsages),
  orderDiscounts: many(orderDiscounts),
}));

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsages.couponId],
    references: [coupons.id],
  }),
  order: one(orders, {
    fields: [couponUsages.orderId],
    references: [orders.id],
  }),
  customer: one(storeCustomers, {
    fields: [couponUsages.customerId],
    references: [storeCustomers.id],
  }),
}));

export const orderDiscountsRelations = relations(orderDiscounts, ({ one }) => ({
  order: one(orders, {
    fields: [orderDiscounts.orderId],
    references: [orders.id],
  }),
  orderItem: one(orderItems, {
    fields: [orderDiscounts.orderItemId],
    references: [orderItems.id],
  }),
  coupon: one(coupons, {
    fields: [orderDiscounts.couponId],
    references: [coupons.id],
  }),
  authorizedByUser: one(user, {
    fields: [orderDiscounts.authorizedBy],
    references: [user.id],
  }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderEvents.orderId],
    references: [orders.id],
  }),
  tenant: one(tenants, {
    fields: [orderEvents.tenantId],
    references: [tenants.id],
  }),
}));

export const inventoryReservationsRelations = relations(
  inventoryReservations,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [inventoryReservations.tenantId],
      references: [tenants.id],
    }),
    product: one(products, {
      fields: [inventoryReservations.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [inventoryReservations.variantId],
      references: [productVariants.id],
    }),
  })
);

export const storeCreditsRelations = relations(
  storeCredits,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [storeCredits.tenantId],
      references: [tenants.id],
    }),
    customer: one(storeCustomers, {
      fields: [storeCredits.customerId],
      references: [storeCustomers.id],
    }),
    transactions: many(storeCreditTransactions),
    refunds: many(refunds),
  })
);

export const storeCreditTransactionsRelations = relations(
  storeCreditTransactions,
  ({ one }) => ({
    storeCredit: one(storeCredits, {
      fields: [storeCreditTransactions.storeCreditId],
      references: [storeCredits.id],
    }),
    order: one(orders, {
      fields: [storeCreditTransactions.orderId],
      references: [orders.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Better Auth types (reference only)
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

// User profile types
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type PlatformRole = (typeof platformRoleEnum.enumValues)[number];

// User address types
export type UserAddress = typeof userAddresses.$inferSelect;
export type NewUserAddress = typeof userAddresses.$inferInsert;

// Tenant types
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];
export type BillingStatus = (typeof billingStatusEnum.enumValues)[number];
export type SubscriptionPlan = (typeof subscriptionPlanEnum.enumValues)[number];
export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type StoreMode = (typeof storeModeEnum.enumValues)[number];

// Tenant member types
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
export type TenantMemberRole = (typeof tenantMemberRoleEnum.enumValues)[number];

// Onboarding checklist types
export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type NewOnboardingChecklist = typeof onboardingChecklists.$inferInsert;

// Store customer types
export type StoreCustomer = typeof storeCustomers.$inferSelect;
export type NewStoreCustomer = typeof storeCustomers.$inferInsert;

// Wishlist types
export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type NewWishlistItem = typeof wishlistItems.$inferInsert;

// Category types
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// Product types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Media types
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;

// Variant types
export type VariantOption = typeof variantOptions.$inferSelect;
export type NewVariantOption = typeof variantOptions.$inferInsert;
export type VariantOptionValue = typeof variantOptionValues.$inferSelect;
export type NewVariantOptionValue = typeof variantOptionValues.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ProductVariantOption = typeof productVariantOptions.$inferSelect;
export type NewProductVariantOption = typeof productVariantOptions.$inferInsert;
export type ProductVariantImage = typeof productVariantImages.$inferSelect;
export type NewProductVariantImage = typeof productVariantImages.$inferInsert;
export type OptionValueImage = typeof optionValueImages.$inferSelect;
export type NewOptionValueImage = typeof optionValueImages.$inferInsert;
export type StockStatus = (typeof stockStatusEnum.enumValues)[number];
export type SwatchType = (typeof swatchTypeEnum.enumValues)[number];
export type SwatchSize = (typeof swatchSizeEnum.enumValues)[number];
export type SwatchShape = (typeof swatchShapeEnum.enumValues)[number];

// Pricing types
export type PriceTier = typeof priceTiers.$inferSelect;
export type NewPriceTier = typeof priceTiers.$inferInsert;
export type CustomerGroup = typeof customerGroups.$inferSelect;
export type NewCustomerGroup = typeof customerGroups.$inferInsert;
export type CustomerGroupType =
  (typeof customerGroupTypeEnum.enumValues)[number];
export type CustomerGroupMember = typeof customerGroupMembers.$inferSelect;
export type NewCustomerGroupMember = typeof customerGroupMembers.$inferInsert;
export type CustomerGroupPrice = typeof customerGroupPrices.$inferSelect;
export type NewCustomerGroupPrice = typeof customerGroupPrices.$inferInsert;
export type ScheduledSale = typeof scheduledSales.$inferSelect;
export type NewScheduledSale = typeof scheduledSales.$inferInsert;
export type SaleCampaign = typeof saleCampaigns.$inferSelect;
export type NewSaleCampaign = typeof saleCampaigns.$inferInsert;
export type SaleCampaignScope =
  (typeof saleCampaignScopeEnum.enumValues)[number];
export type SaleCampaignDiscountType =
  (typeof saleCampaignDiscountTypeEnum.enumValues)[number];

// Inventory types
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventoryMovementType =
  (typeof inventoryMovementTypeEnum.enumValues)[number];

// Cart types
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;

// Order types
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// Shipping types
export type ShippingZone = typeof shippingZones.$inferSelect;
export type NewShippingZone = typeof shippingZones.$inferInsert;
export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type ShippingRateType = (typeof shippingRateTypeEnum.enumValues)[number];
export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type NewShipmentItem = typeof shipmentItems.$inferInsert;
export type ShipmentStatus = (typeof shipmentStatusEnum.enumValues)[number];
export type ShipmentTrackingEvent = typeof shipmentTrackingEvents.$inferSelect;
export type NewShipmentTrackingEvent =
  typeof shipmentTrackingEvents.$inferInsert;

// Delivery zone types
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type NewDeliveryZone = typeof deliveryZones.$inferInsert;
export type DeliveryZoneType = (typeof deliveryZoneTypeEnum.enumValues)[number];

// Review types
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReviewMedia = typeof reviewMedia.$inferSelect;
export type NewReviewMedia = typeof reviewMedia.$inferInsert;
export type ReviewVote = typeof reviewVotes.$inferSelect;
export type NewReviewVote = typeof reviewVotes.$inferInsert;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type NewReviewRequest = typeof reviewRequests.$inferInsert;

// Commission types
export type CommissionTransactionType =
  (typeof commissionTransactionTypeEnum.enumValues)[number];
export type CommissionTransaction = typeof commissionTransactions.$inferSelect;
export type NewCommissionTransaction =
  typeof commissionTransactions.$inferInsert;

// Analytics types
export type AnalyticsDailySnapshot =
  typeof analyticsDailySnapshots.$inferSelect;
export type NewAnalyticsDailySnapshot =
  typeof analyticsDailySnapshots.$inferInsert;
export type AnalyticsProductPerformance =
  typeof analyticsProductPerformance.$inferSelect;
export type NewAnalyticsProductPerformance =
  typeof analyticsProductPerformance.$inferInsert;
export type AnalyticsCategoryPerformance =
  typeof analyticsCategoryPerformance.$inferSelect;
export type NewAnalyticsCategoryPerformance =
  typeof analyticsCategoryPerformance.$inferInsert;
export type AnalyticsTrafficSource =
  typeof analyticsTrafficSources.$inferSelect;
export type NewAnalyticsTrafficSource =
  typeof analyticsTrafficSources.$inferInsert;
export type AnalyticsGeographicSales =
  typeof analyticsGeographicSales.$inferSelect;
export type NewAnalyticsGeographicSales =
  typeof analyticsGeographicSales.$inferInsert;
export type AnalyticsHourlyMetrics = typeof analyticsHourlyMetrics.$inferSelect;
export type NewAnalyticsHourlyMetrics =
  typeof analyticsHourlyMetrics.$inferInsert;
export type AnalyticsPageView = typeof analyticsPageViews.$inferSelect;
export type NewAnalyticsPageView = typeof analyticsPageViews.$inferInsert;
export type AnalyticsEventType =
  (typeof analyticsEventTypeEnum.enumValues)[number];
export type AnalyticsConversionEvent =
  typeof analyticsConversionEvents.$inferSelect;
export type NewAnalyticsConversionEvent =
  typeof analyticsConversionEvents.$inferInsert;

// Product status types
export type ProductStatus = (typeof productStatusEnum.enumValues)[number];

// Inventory location types
export type InventoryLocation = typeof inventoryLocations.$inferSelect;
export type NewInventoryLocation = typeof inventoryLocations.$inferInsert;
export type InventoryLevel = typeof inventoryLevels.$inferSelect;
export type NewInventoryLevel = typeof inventoryLevels.$inferInsert;
export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type NewInventoryCount = typeof inventoryCounts.$inferInsert;
export type InventoryCountItem = typeof inventoryCountItems.$inferSelect;
export type NewInventoryCountItem = typeof inventoryCountItems.$inferInsert;

// Shipping weight tier types
export type ShippingWeightTier = typeof shippingWeightTiers.$inferSelect;
export type NewShippingWeightTier = typeof shippingWeightTiers.$inferInsert;

// Commission types (extended)
export type CommissionRule = typeof commissionRules.$inferSelect;
export type NewCommissionRule = typeof commissionRules.$inferInsert;
export type CommissionTier = typeof commissionTiers.$inferSelect;
export type NewCommissionTier = typeof commissionTiers.$inferInsert;

// Seller finance types
export type SellerTransactionType =
  (typeof sellerTransactionTypeEnum.enumValues)[number];
export type PayoutStatus = (typeof payoutStatusEnum.enumValues)[number];
export type PayoutMethodType = (typeof payoutMethodTypeEnum.enumValues)[number];
export type SellerBalance = typeof sellerBalances.$inferSelect;
export type NewSellerBalance = typeof sellerBalances.$inferInsert;
export type SellerPayoutMethod = typeof sellerPayoutMethods.$inferSelect;
export type NewSellerPayoutMethod = typeof sellerPayoutMethods.$inferInsert;
export type SellerTransaction = typeof sellerTransactions.$inferSelect;
export type NewSellerTransaction = typeof sellerTransactions.$inferInsert;
export type SellerPayout = typeof sellerPayouts.$inferSelect;
export type NewSellerPayout = typeof sellerPayouts.$inferInsert;
export type SellerPayoutItem = typeof sellerPayoutItems.$inferSelect;
export type NewSellerPayoutItem = typeof sellerPayoutItems.$inferInsert;

// Affiliate types
export type AffiliateStatus = (typeof affiliateStatusEnum.enumValues)[number];
export type AffiliateCommissionType =
  (typeof affiliateCommissionTypeEnum.enumValues)[number];
export type AffiliatePayoutStatus =
  (typeof affiliatePayoutStatusEnum.enumValues)[number];
export type Affiliate = typeof affiliates.$inferSelect;
export type NewAffiliate = typeof affiliates.$inferInsert;
export type AffiliatePayoutMethod = typeof affiliatePayoutMethods.$inferSelect;
export type NewAffiliatePayoutMethod =
  typeof affiliatePayoutMethods.$inferInsert;
export type AffiliateTenantPartnership =
  typeof affiliateTenantPartnerships.$inferSelect;
export type NewAffiliateTenantPartnership =
  typeof affiliateTenantPartnerships.$inferInsert;
export type AffiliateLink = typeof affiliateLinks.$inferSelect;
export type NewAffiliateLink = typeof affiliateLinks.$inferInsert;
export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type NewAffiliateClick = typeof affiliateClicks.$inferInsert;
export type AffiliateConversion = typeof affiliateConversions.$inferSelect;
export type NewAffiliateConversion = typeof affiliateConversions.$inferInsert;
export type AffiliatePayout = typeof affiliatePayouts.$inferSelect;
export type NewAffiliatePayout = typeof affiliatePayouts.$inferInsert;
export type AffiliateRating = typeof affiliateRatings.$inferSelect;
export type NewAffiliateRating = typeof affiliateRatings.$inferInsert;

// Platform affiliate types
export type PlatformAffiliateStatus =
  (typeof platformAffiliateStatusEnum.enumValues)[number];
export type PlatformAffiliateTier =
  (typeof platformAffiliateTierEnum.enumValues)[number];
export type PlatformAffiliateReferralStatus =
  (typeof platformAffiliateReferralStatusEnum.enumValues)[number];
export type PlatformAffiliateCommissionStatus =
  (typeof platformAffiliateCommissionStatusEnum.enumValues)[number];
export type PlatformAffiliatePayoutStatus =
  (typeof platformAffiliatePayoutStatusEnum.enumValues)[number];
export type PlatformAffiliate = typeof platformAffiliates.$inferSelect;
export type NewPlatformAffiliate = typeof platformAffiliates.$inferInsert;
export type PlatformAffiliateClick =
  typeof platformAffiliateClicks.$inferSelect;
export type NewPlatformAffiliateClick =
  typeof platformAffiliateClicks.$inferInsert;
export type PlatformAffiliateReferral =
  typeof platformAffiliateReferrals.$inferSelect;
export type NewPlatformAffiliateReferral =
  typeof platformAffiliateReferrals.$inferInsert;
export type PlatformAffiliateCommission =
  typeof platformAffiliateCommissions.$inferSelect;
export type NewPlatformAffiliateCommission =
  typeof platformAffiliateCommissions.$inferInsert;
export type PlatformAffiliatePayout =
  typeof platformAffiliatePayouts.$inferSelect;
export type NewPlatformAffiliatePayout =
  typeof platformAffiliatePayouts.$inferInsert;
export type ReservedSlug = typeof reservedSlugs.$inferSelect;
export type NewReservedSlug = typeof reservedSlugs.$inferInsert;

// Delivery provider types
export type DeliveryProviderType =
  (typeof deliveryProviderTypeEnum.enumValues)[number];
export type DeliveryProviderStatus =
  (typeof deliveryProviderStatusEnum.enumValues)[number];
export type DeliveryAssignmentStatus =
  (typeof deliveryAssignmentStatusEnum.enumValues)[number];
export type DeliveryPayoutStatus =
  (typeof deliveryPayoutStatusEnum.enumValues)[number];
export type DeliveryProvider = typeof deliveryProviders.$inferSelect;
export type NewDeliveryProvider = typeof deliveryProviders.$inferInsert;
export type DeliveryPayoutMethod = typeof deliveryPayoutMethods.$inferSelect;
export type NewDeliveryPayoutMethod = typeof deliveryPayoutMethods.$inferInsert;
export type DeliveryProviderZone = typeof deliveryProviderZones.$inferSelect;
export type NewDeliveryProviderZone = typeof deliveryProviderZones.$inferInsert;
export type DeliveryTenantPartnership =
  typeof deliveryTenantPartnerships.$inferSelect;
export type NewDeliveryTenantPartnership =
  typeof deliveryTenantPartnerships.$inferInsert;
export type DeliveryAssignment = typeof deliveryAssignments.$inferSelect;
export type NewDeliveryAssignment = typeof deliveryAssignments.$inferInsert;
export type DeliveryTrackingEvent = typeof deliveryTrackingEvents.$inferSelect;
export type NewDeliveryTrackingEvent =
  typeof deliveryTrackingEvents.$inferInsert;
export type DeliveryRating = typeof deliveryRatings.$inferSelect;
export type NewDeliveryRating = typeof deliveryRatings.$inferInsert;
export type DeliveryPayout = typeof deliveryPayouts.$inferSelect;
export type NewDeliveryPayout = typeof deliveryPayouts.$inferInsert;
export type DeliveryPayoutItem = typeof deliveryPayoutItems.$inferSelect;
export type NewDeliveryPayoutItem = typeof deliveryPayoutItems.$inferInsert;

// Push subscription types
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

// Notification preference types
export type UserNotificationPreference =
  typeof userNotificationPreferences.$inferSelect;
export type NewUserNotificationPreference =
  typeof userNotificationPreferences.$inferInsert;
export type StoreNotificationPreference =
  typeof storeNotificationPreferences.$inferSelect;
export type NewStoreNotificationPreference =
  typeof storeNotificationPreferences.$inferInsert;
export type CustomerNotificationPreference =
  typeof customerNotificationPreferences.$inferSelect;
export type NewCustomerNotificationPreference =
  typeof customerNotificationPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// ============================================================================
// UNIFIED COMMERCE TYPE EXPORTS
// ============================================================================

// Order Channel & Fulfillment types
export type OrderChannel = (typeof orderChannelEnum.enumValues)[number];
export type FulfillmentType = (typeof fulfillmentTypeEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

// Transaction types
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionStatus =
  (typeof transactionStatusEnum.enumValues)[number];
export type OrderTransaction = typeof orderTransactions.$inferSelect;
export type NewOrderTransaction = typeof orderTransactions.$inferInsert;

// Refund types
export type RefundType = (typeof refundTypeEnum.enumValues)[number];
export type RefundStatus = (typeof refundStatusEnum.enumValues)[number];
export type RefundReason = (typeof refundReasonEnum.enumValues)[number];
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type RefundItem = typeof refundItems.$inferSelect;
export type NewRefundItem = typeof refundItems.$inferInsert;

// Discount types
export type DiscountSource = (typeof discountSourceEnum.enumValues)[number];
export type DiscountType = (typeof discountTypeEnum.enumValues)[number];
export type DiscountScope = (typeof discountScopeEnum.enumValues)[number];
export type OrderDiscount = typeof orderDiscounts.$inferSelect;
export type NewOrderDiscount = typeof orderDiscounts.$inferInsert;

// Coupon types
export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type CouponUsage = typeof couponUsages.$inferSelect;
export type NewCouponUsage = typeof couponUsages.$inferInsert;

// Order event types
export type OrderEventCategory =
  (typeof orderEventCategoryEnum.enumValues)[number];
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;

// Inventory reservation types
export type ReservationStatus =
  (typeof reservationStatusEnum.enumValues)[number];
export type InventoryReservation = typeof inventoryReservations.$inferSelect;
export type NewInventoryReservation = typeof inventoryReservations.$inferInsert;

// Store credit types
export type StoreCreditSource =
  (typeof storeCreditSourceEnum.enumValues)[number];
export type StoreCredit = typeof storeCredits.$inferSelect;
export type NewStoreCredit = typeof storeCredits.$inferInsert;
export type StoreCreditTransaction =
  typeof storeCreditTransactions.$inferSelect;
export type NewStoreCreditTransaction =
  typeof storeCreditTransactions.$inferInsert;

// Item condition type
export type ItemCondition = (typeof itemConditionEnum.enumValues)[number];

// Billing types
export type BillingTransactionType =
  (typeof billingTransactionTypeEnum.enumValues)[number];
export type BillingTransactionStatus =
  (typeof billingTransactionStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type BillingTransaction = typeof billingTransactions.$inferSelect;
export type NewBillingTransaction = typeof billingTransactions.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

// Payment gateway types
export type PaymentGateway = (typeof paymentGatewayEnum.enumValues)[number];
export type PaymentWebhookStatus =
  (typeof paymentWebhookStatusEnum.enumValues)[number];
export type PaymentSessionStatus =
  (typeof paymentSessionStatusEnum.enumValues)[number];
export type PaymentGatewayConfig = typeof paymentGatewayConfigs.$inferSelect;
export type NewPaymentGatewayConfig = typeof paymentGatewayConfigs.$inferInsert;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type NewPaymentWebhookEvent = typeof paymentWebhookEvents.$inferInsert;
export type PaymentSession = typeof paymentSessions.$inferSelect;
export type NewPaymentSession = typeof paymentSessions.$inferInsert;

// Crypto payment types
export type CryptoPaymentStatus =
  (typeof cryptoPaymentStatusEnum.enumValues)[number];
export type CryptoNetwork = (typeof cryptoNetworkEnum.enumValues)[number];
export type CryptoPayment = typeof cryptoPayments.$inferSelect;
export type NewCryptoPayment = typeof cryptoPayments.$inferInsert;

// Billing interval type
export type BillingInterval = "monthly" | "yearly";

// Exchange rate types
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;

// Order invoice token types
export type OrderInvoiceToken = typeof orderInvoiceTokens.$inferSelect;
export type NewOrderInvoiceToken = typeof orderInvoiceTokens.$inferInsert;
