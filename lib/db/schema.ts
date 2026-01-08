import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
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

// ============================================================================
// SHARED TYPES
// ============================================================================

// Address structure for orders and shipments - enables zone matching
export type Address = {
  firstName: string;
  lastName: string;
  phone?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string; // ISO 2-letter code (e.g., "AF", "US")
};

// Social links structure for storefronts
export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  whatsapp?: string; // With country code
  telegram?: string;
  tiktok?: string;
  youtube?: string;
};

// SEO metadata structure
export type SeoMetadata = {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string; // URL to social preview image
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
  email: string;
  phone?: string;
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

// Order status
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

// Inventory & Variant Management Enums
export const stockStatusEnum = pgEnum("stock_status", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "on_backorder",
]);

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

// Billing Status Enum
export const billingStatusEnum = pgEnum("billing_status", [
  "free_tier", // In free trial period (up to 10,000 AFN commission accrued)
  "active", // Paid and in good standing
  "grace_period", // Free tier exceeded, has 30 days to pay
  "suspended", // Didn't pay, store suspended
  "forgiven", // Debt forgiven (store deactivated, can reactivate by paying)
]);

// Commission Transaction Type
export const commissionTransactionTypeEnum = pgEnum("commission_transaction_type", [
  "order_commission", // Commission from order
  "payment", // Payment received from store owner
  "adjustment", // Manual adjustment by admin
  "forgiveness", // Debt forgiven (write-off)
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
export const deliveryAssignmentStatusEnum = pgEnum("delivery_assignment_status", [
  "pending", // Awaiting acceptance
  "accepted", // Driver accepted
  "picked_up", // Package picked up
  "in_transit", // On the way
  "delivered", // Successfully delivered
  "failed", // Delivery failed
  "returned", // Returned to sender
  "cancelled", // Assignment cancelled
]);

// Delivery provider payout status
export const deliveryPayoutStatusEnum = pgEnum("delivery_payout_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
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
    preferredCurrency: varchar("preferred_currency", { length: 3 }).default("AFN"),
    preferredLanguage: varchar("preferred_language", { length: 10 }).default("fa"), // Dari

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
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Address label (e.g., "Home", "Office", "Mom's House")
    label: varchar("label", { length: 100 }),

    // Full address details
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    street1: varchar("street1", { length: 255 }).notNull(),
    street2: varchar("street2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(), // ISO 2-letter code

    // Default flag
    isDefault: boolean("is_default").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_addresses_user_id_idx").on(table.userId),
  ]
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
    headerDisplay: varchar("header_display", { length: 20 }).default("logo_and_name"), // logo_and_name, logo_only, name_only

    // Contact
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),

    // Social & SEO
    socialLinks: jsonb("social_links").$type<SocialLinks>(),
    seo: jsonb("seo").$type<SeoMetadata>(),

    // Settings
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // Status (replaces simple isActive)
    status: tenantStatusEnum("status").default("pending_review").notNull(),

    // Billing & Commission
    billingStatus: billingStatusEnum("billing_status").default("free_tier").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("5.00").notNull(), // 5% default
    commissionBalance: decimal("commission_balance", { precision: 14, scale: 2 }).default("0").notNull(), // Current owed (increased precision)
    freeTierLimit: decimal("free_tier_limit", { precision: 14, scale: 2 }).default("10000").notNull(), // 10,000 AFN
    freeTierExceededAt: timestamp("free_tier_exceeded_at", { withTimezone: true, mode: "string" }),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true, mode: "string" }),

    // Analytics (system-managed, read-only for owners)
    analytics: jsonb("analytics").$type<StoreAnalytics>().default({
      totalViews: 0,
      uniqueVisitors: 0,
      totalOrders: 0,
      totalRevenue: 0,
    }),

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
  ]
);

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
    canManageCustomers: boolean("can_manage_customers").default(false).notNull(),
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
    uniqueIndex("tenant_members_tenant_user_idx").on(table.tenantId, table.userId),
    // Find all tenants a user belongs to (dashboard sidebar)
    index("tenant_members_user_id_idx").on(table.userId),
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
    totalSpent: decimal("total_spent", { precision: 14, scale: 2 }).default("0").notNull(),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true, mode: "string" }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One customer record per user per store
    uniqueIndex("store_customers_tenant_user_idx").on(table.tenantId, table.userId),
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
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
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
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
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

    // Stock for simple products (ignored when hasVariants=true)
    stock: integer("stock").default(0).notNull(),

    // Variant configuration
    hasVariants: boolean("has_variants").default(false).notNull(),

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

    // Publishing timestamps
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),

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
    uniqueIndex("product_images_product_media_idx").on(table.productId, table.mediaId),
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
    uniqueIndex("product_categories_product_category_idx").on(table.productId, table.categoryId),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("variant_options_tenant_name_idx").on(table.tenantId, table.name),
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
    displayName: varchar("display_name", { length: 255 }), // "Blue / XL"
    price: decimal("price", { precision: 12, scale: 2 }), // null = use product price
    weight: decimal("weight", { precision: 10, scale: 3 }),
    length: decimal("length", { precision: 10, scale: 2 }),
    width: decimal("width", { precision: 10, scale: 2 }),
    height: decimal("height", { precision: 10, scale: 2 }),
    description: text("description"),
    stock: integer("stock").default(0).notNull(),
    reservedStock: integer("reserved_stock").default(0).notNull(),
    stockStatus: stockStatusEnum("stock_status").default("in_stock").notNull(),
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
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
    uniqueIndex("product_variants_tenant_product_sku_idx").on(table.tenantId, table.productId, table.sku),
    index("product_variants_product_id_idx").on(table.productId),
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
    uniqueIndex("product_variant_options_variant_value_idx").on(table.variantId, table.optionValueId),
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
    uniqueIndex("inventory_locations_tenant_name_idx").on(table.tenantId, table.name),
    index("inventory_locations_tenant_active_idx").on(table.tenantId, table.isActive),
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
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),

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
    locationId: uuid("location_id").references(() => inventoryLocations.id, { onDelete: "set null" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),

    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(), // Positive for additions, negative for reductions
    previousStock: integer("previous_stock").notNull(),
    newStock: integer("new_stock").notNull(),

    // Cost tracking for FIFO/LIFO
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }),
    totalCost: decimal("total_cost", { precision: 14, scale: 2 }),

    // References
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
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
    countedById: text("counted_by_id").references(() => user.id, { onDelete: "set null" }),
    verifiedById: text("verified_by_id").references(() => user.id, { onDelete: "set null" }),

    notes: text("notes"),

    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
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
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),

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
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),

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
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_variant_idx").on(table.cartId, table.productId, table.variantId),
    check("cart_items_quantity_check", sql`quantity > 0`),
  ]
);

// ============================================================================
// ORDERS (Tenant-isolated)
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

    // Link to platform user (nullable for guest checkout)
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // Optional link to store customer record (for store-specific data)
    storeCustomerId: uuid("store_customer_id").references(() => storeCustomers.id, {
      onDelete: "set null",
    }),

    // Snapshot of customer info at time of order (immutable historical record)
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>().notNull(),

    // Structured addresses
    shippingAddress: jsonb("shipping_address").$type<Address>().notNull(),
    billingAddress: jsonb("billing_address").$type<Address>(),

    // Financial breakdown
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingTotal: decimal("shipping_total", { precision: 12, scale: 2 }).default("0").notNull(),
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).default("0").notNull(),
    discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 12, scale: 2 }).notNull(),

    // Status
    status: orderStatusEnum("status").default("pending").notNull(),

    // Notes
    customerNotes: text("customer_notes"),
    staffNotes: text("staff_notes"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique order number per tenant
    uniqueIndex("orders_tenant_order_number_idx").on(table.tenantId, table.orderNumber),
    // Order history queries
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    // Status filtering
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    // User order history (platform-wide)
    index("orders_user_id_idx").on(table.userId),
    // Store customer orders
    index("orders_store_customer_id_idx").on(table.storeCustomerId),
  ]
);

// ============================================================================
// ORDER ITEMS
// ============================================================================
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    // Snapshot of product info at time of purchase
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 255 }),
    sku: varchar("sku", { length: 100 }),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    check("order_items_quantity_check", sql`quantity > 0`),
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
    uniqueIndex("shipping_zones_tenant_name_idx").on(table.tenantId, table.name),
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
    baseRate: decimal("base_rate", { precision: 12, scale: 2 }).default("0").notNull(),

    // Per-item rate (for per_item type)
    perItemRate: decimal("per_item_rate", { precision: 12, scale: 2 }),

    // Per-kg rate (for weight_based type)
    perKgRate: decimal("per_kg_rate", { precision: 12, scale: 2 }),

    // Free shipping threshold (for price_based type, also optional on others)
    freeShippingThreshold: decimal("free_shipping_threshold", { precision: 12, scale: 2 }),

    // Weight limits
    minWeight: decimal("min_weight_kg", { precision: 10, scale: 3 }), // Min weight for this method
    maxWeight: decimal("max_weight_kg", { precision: 10, scale: 3 }), // Max weight for this method

    // Handling fee (added on top of calculated rate)
    handlingFee: decimal("handling_fee", { precision: 12, scale: 2 }).default("0"),

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
    uniqueIndex("shipping_methods_tenant_zone_name_idx").on(table.tenantId, table.zoneId, table.name),
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
    perKgRateInTier: decimal("per_kg_rate_in_tier", { precision: 12, scale: 2 }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipping_weight_tiers_method_id_idx").on(table.methodId),
    // Order by min weight for tier lookup
    index("shipping_weight_tiers_method_weight_idx").on(table.methodId, table.minWeight),
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
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, {
      onDelete: "set null",
    }),
    carrierName: varchar("carrier_name", { length: 255 }),
    trackingNumber: varchar("tracking_number", { length: 255 }),
    trackingUrl: text("tracking_url"),
    shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).default("0").notNull(),
    status: shipmentStatusEnum("status").default("pending").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "string" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "string" }),
    deliveryAddress: jsonb("delivery_address").$type<Address>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipments_order_id_idx").on(table.orderId),
  ]
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
    uniqueIndex("shipment_items_shipment_order_item_idx").on(table.shipmentId, table.orderItemId),
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
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>().notNull(),

    // Review content
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    comment: text("comment"),

    // Store owner response
    replyContent: text("reply_content"),
    repliedAt: timestamp("replied_at", { withTimezone: true, mode: "string" }),

    // Verification
    isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),

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
    uniqueIndex("review_media_tenant_review_media_idx").on(table.tenantId, table.reviewId, table.mediaId),
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
    balanceAfter: decimal("balance_after", { precision: 14, scale: 2 }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    description: text("description"),
    processedBy: text("processed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("commission_transactions_tenant_id_idx").on(table.tenantId),
  ]
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
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),

    // Commission rate (overrides tenant default)
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),

    // Validity period (for promotional rates)
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "string" }),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "string" }),

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
    minMonthlyRevenue: decimal("min_monthly_revenue", { precision: 14, scale: 2 }), // Min monthly sales
    minMonthlyOrders: integer("min_monthly_orders"), // Min orders per month
    minAccountAge: integer("min_account_age_days"), // Days since store creation

    // Benefits
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
    freeShippingCredits: decimal("free_shipping_credits", { precision: 12, scale: 2 }),
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
  (table) => [
    uniqueIndex("commission_tiers_name_idx").on(table.name),
  ]
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
    available: decimal("available", { precision: 14, scale: 2 }).default("0").notNull(), // Ready for payout
    pending: decimal("pending", { precision: 14, scale: 2 }).default("0").notNull(), // From recent orders (holding period)
    reserved: decimal("reserved", { precision: 14, scale: 2 }).default("0").notNull(), // Held for disputes/refunds
    lifetimeEarnings: decimal("lifetime_earnings", { precision: 14, scale: 2 }).default("0").notNull(),
    lifetimePaidOut: decimal("lifetime_paid_out", { precision: 14, scale: 2 }).default("0").notNull(),

    // Commission tier
    currentTierId: uuid("current_tier_id").references(() => commissionTiers.id, { onDelete: "set null" }),
    tierQualifiedAt: timestamp("tier_qualified_at", { withTimezone: true, mode: "string" }),

    // Payout settings
    autoPayout: boolean("auto_payout").default(false).notNull(),
    autoPayoutThreshold: decimal("auto_payout_threshold", { precision: 12, scale: 2 }),
    payoutHoldDays: integer("payout_hold_days").default(7).notNull(), // Days before pending becomes available

    // Currency
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("seller_balances_tenant_id_idx").on(table.tenantId),
  ]
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
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("seller_payout_methods_tenant_id_idx").on(table.tenantId),
  ]
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
    availableAfter: decimal("available_after", { precision: 14, scale: 2 }).notNull(),
    pendingAfter: decimal("pending_after", { precision: 14, scale: 2 }).notNull(),
    reservedAfter: decimal("reserved_after", { precision: 14, scale: 2 }).notNull(),

    // References
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
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
    payoutMethodId: uuid("payout_method_id")
      .references(() => sellerPayoutMethods.id, { onDelete: "set null" }),

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
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    // External reference
    externalReference: varchar("external_reference", { length: 255 }), // Bank reference, transaction ID, etc.
    failureReason: text("failure_reason"),

    // Who processed
    processedById: text("processed_by_id").references(() => user.id, { onDelete: "set null" }),

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
    uniqueIndex("seller_payout_items_payout_transaction_idx").on(table.payoutId, table.transactionId),
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
    grossRevenue: decimal("gross_revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    netRevenue: decimal("net_revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    shippingRevenue: decimal("shipping_revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    taxCollected: decimal("tax_collected", { precision: 14, scale: 2 }).default("0").notNull(),
    discountsGiven: decimal("discounts_given", { precision: 14, scale: 2 }).default("0").notNull(),
    refundsIssued: decimal("refunds_issued", { precision: 14, scale: 2 }).default("0").notNull(),
    commissionAccrued: decimal("commission_accrued", { precision: 14, scale: 2 }).default("0").notNull(),

    // Orders
    totalOrders: integer("total_orders").default(0).notNull(),
    completedOrders: integer("completed_orders").default(0).notNull(),
    cancelledOrders: integer("cancelled_orders").default(0).notNull(),
    pendingOrders: integer("pending_orders").default(0).notNull(),
    averageOrderValue: decimal("average_order_value", { precision: 12, scale: 2 }).default("0").notNull(),

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
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(),

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
    uniqueIndex("analytics_daily_snapshots_tenant_date_idx").on(table.tenantId, table.snapshotDate),
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
    revenue: decimal("revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(),
    productViews: integer("product_views").default(0).notNull(),
    addToCartCount: integer("add_to_cart_count").default(0).notNull(),
    viewToCartRate: decimal("view_to_cart_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    cartToPurchaseRate: decimal("cart_to_purchase_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    revenuePerView: decimal("revenue_per_view", { precision: 12, scale: 2 }).default("0").notNull(),
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
    revenue: decimal("revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(),
    uniqueProductsSold: integer("unique_products_sold").default(0).notNull(),
    categoryViews: integer("category_views").default(0).notNull(),
    productViewsInCategory: integer("product_views_in_category").default(0).notNull(),

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
    revenue: decimal("revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(),

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
    revenue: decimal("revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    itemsSold: integer("items_sold").default(0).notNull(),
    shippingRevenue: decimal("shipping_revenue", { precision: 14, scale: 2 }).default("0").notNull(),
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
    revenue: decimal("revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    cartCreations: integer("cart_creations").default(0).notNull(),
    checkoutStarts: integer("checkout_starts").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_hourly_tenant_hour_idx").on(table.tenantId, table.hour),
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
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),

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

    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),

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
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "string" }),
    suspensionReason: text("suspension_reason"),

    // Verification & trust
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),

    // Aggregated stats (for portfolio display)
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalEarnings: decimal("total_earnings", { precision: 14, scale: 2 }).default("0").notNull(),
    totalPaidOut: decimal("total_paid_out", { precision: 14, scale: 2 }).default("0").notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(),
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
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),

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
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "string" }),
    rejectionReason: text("rejection_reason"),

    // Custom commission for this affiliate-store pair (overrides store default)
    commissionType: affiliateCommissionTypeEnum("commission_type").default("percentage").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // % or fixed amount
    commissionFixed: decimal("commission_fixed", { precision: 12, scale: 2 }), // For hybrid: base amount

    // Cookie duration (days the affiliate gets credit after click)
    cookieDurationDays: integer("cookie_duration_days").default(30).notNull(),

    // Partnership stats (for this store only)
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 }).default("0").notNull(),
    totalCommissionEarned: decimal("total_commission_earned", { precision: 14, scale: 2 }).default("0").notNull(),

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
      .references(() => affiliateTenantPartnerships.id, { onDelete: "cascade" }),

    // Unique tracking code (e.g., "abc123" -> /store/shop?ref=abc123)
    code: varchar("code", { length: 50 }).notNull().unique(),

    // What the link points to
    targetType: varchar("target_type", { length: 20 }).notNull(), // "store", "product", "category"
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),

    // Custom name for affiliate's reference
    name: varchar("name", { length: 255 }),

    // Stats
    totalClicks: integer("total_clicks").default(0).notNull(),
    uniqueClicks: integer("unique_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 }).default("0").notNull(),

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
    convertedAt: timestamp("converted_at", { withTimezone: true, mode: "string" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),

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
      .references(() => affiliateTenantPartnerships.id, { onDelete: "cascade" }),
    linkId: uuid("link_id").references(() => affiliateLinks.id, { onDelete: "set null" }),
    clickId: uuid("click_id").references(() => affiliateClicks.id, { onDelete: "set null" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Order details at time of conversion
    orderTotal: decimal("order_total", { precision: 14, scale: 2 }).notNull(),
    orderCurrency: varchar("order_currency", { length: 3 }).default("AFN").notNull(),

    // Commission calculation
    commissionType: affiliateCommissionTypeEnum("commission_type").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
    commissionFixed: decimal("commission_fixed", { precision: 12, scale: 2 }),
    commissionAmount: decimal("commission_amount", { precision: 14, scale: 2 }).notNull(),

    // Status
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected, paid
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "string" }),
    rejectionReason: text("rejection_reason"),

    // Payment tracking
    payoutId: uuid("payout_id"), // Forward reference to affiliatePayouts
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),

    convertedAt: timestamp("converted_at", { withTimezone: true, mode: "string" })
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
    payoutMethodId: uuid("payout_method_id")
      .references(() => affiliatePayoutMethods.id, { onDelete: "set null" }),

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

    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    externalReference: varchar("external_reference", { length: 255 }),
    failureReason: text("failure_reason"),
    processedById: text("processed_by_id").references(() => user.id, { onDelete: "set null" }),
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
      .references(() => affiliateTenantPartnerships.id, { onDelete: "cascade" }),

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
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "string" }),

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
    vehicleCapacityKg: decimal("vehicle_capacity_kg", { precision: 10, scale: 2 }),

    // Status
    status: deliveryProviderStatusEnum("status").default("pending").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "string" }),
    suspensionReason: text("suspension_reason"),

    // Verification
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),
    idDocumentUrl: text("id_document_url"), // For verification
    licenseDocumentUrl: text("license_document_url"),

    // Operating hours
    operatingHours: jsonb("operating_hours").$type<Record<string, { start: string; end: string }>>(),
    isAvailable: boolean("is_available").default(true).notNull(),

    // Aggregated stats (for portfolio)
    totalDeliveries: integer("total_deliveries").default(0).notNull(),
    completedDeliveries: integer("completed_deliveries").default(0).notNull(),
    failedDeliveries: integer("failed_deliveries").default(0).notNull(),
    onTimeDeliveryRate: decimal("on_time_delivery_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    totalReviews: integer("total_reviews").default(0).notNull(),
    totalEarnings: decimal("total_earnings", { precision: 14, scale: 2 }).default("0").notNull(),
    totalPaidOut: decimal("total_paid_out", { precision: 14, scale: 2 }).default("0").notNull(),

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
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),

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
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "string" }),
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
    totalEarned: decimal("total_earned", { precision: 14, scale: 2 }).default("0").notNull(),

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
    partnershipId: uuid("partnership_id")
      .references(() => deliveryTenantPartnerships.id, { onDelete: "set null" }),

    // Assignment reference number
    assignmentNumber: varchar("assignment_number", { length: 50 }).notNull(),

    // Status
    status: deliveryAssignmentStatusEnum("status").default("pending").notNull(),

    // Pickup details
    pickupAddress: jsonb("pickup_address").$type<Address>().notNull(),
    pickupInstructions: text("pickup_instructions"),
    scheduledPickupAt: timestamp("scheduled_pickup_at", { withTimezone: true, mode: "string" }),
    actualPickupAt: timestamp("actual_pickup_at", { withTimezone: true, mode: "string" }),

    // Delivery details
    deliveryAddress: jsonb("delivery_address").$type<Address>().notNull(),
    deliveryInstructions: text("delivery_instructions"),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true, mode: "string" }),
    actualDeliveryAt: timestamp("actual_delivery_at", { withTimezone: true, mode: "string" }),

    // Package details
    weightKg: decimal("weight_kg", { precision: 10, scale: 3 }),
    packageCount: integer("package_count").default(1).notNull(),
    description: text("description"),

    // Pricing
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).default("0").notNull(),
    providerEarnings: decimal("provider_earnings", { precision: 12, scale: 2 }).notNull(),

    // Cash on delivery
    isCod: boolean("is_cod").default(false).notNull(), // Cash on delivery?
    codAmount: decimal("cod_amount", { precision: 14, scale: 2 }),
    codCollected: boolean("cod_collected").default(false).notNull(),
    codCollectedAt: timestamp("cod_collected_at", { withTimezone: true, mode: "string" }),

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
    uniqueIndex("delivery_assignments_assignment_number_idx").on(table.assignmentNumber),
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
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" }),

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
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_ratings_assignment_rater_idx").on(table.assignmentId, table.ratedById),
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
    payoutMethodId: uuid("payout_method_id")
      .references(() => deliveryPayoutMethods.id, { onDelete: "set null" }),

    payoutNumber: varchar("payout_number", { length: 50 }).notNull(),

    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    fee: decimal("fee", { precision: 12, scale: 2 }).default("0").notNull(),
    netAmount: decimal("net_amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("AFN").notNull(),

    // How many deliveries included
    deliveryCount: integer("delivery_count").notNull(),

    // COD amounts (if applicable)
    codCollected: decimal("cod_collected", { precision: 14, scale: 2 }).default("0").notNull(),

    status: deliveryPayoutStatusEnum("status").default("pending").notNull(),

    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "string" }),

    externalReference: varchar("external_reference", { length: 255 }),
    failureReason: text("failure_reason"),
    processedById: text("processed_by_id").references(() => user.id, { onDelete: "set null" }),
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
    uniqueIndex("delivery_payout_items_payout_assignment_idx").on(table.payoutId, table.assignmentId),
    index("delivery_payout_items_payout_id_idx").on(table.payoutId),
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
  shippingZones: many(shippingZones),
  commissionTransactions: many(commissionTransactions),
  reviews: many(reviews),
  // Analytics
  dailySnapshots: many(analyticsDailySnapshots),
  hourlyMetrics: many(analyticsHourlyMetrics),
  pageViews: many(analyticsPageViews),
  conversionEvents: many(analyticsConversionEvents),
  productPerformance: many(analyticsProductPerformance),
  categoryPerformance: many(analyticsCategoryPerformance),
  trafficSources: many(analyticsTrafficSources),
  geographicSales: many(analyticsGeographicSales),
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

export const storeCustomersRelations = relations(storeCustomers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [storeCustomers.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [storeCustomers.userId],
    references: [user.id],
  }),
}));

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
  inventoryMovements: many(inventoryMovements),
  reviews: many(reviews),
  wishlistItems: many(wishlistItems),
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
  categories: many(categories),
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

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const variantOptionsRelations = relations(variantOptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [variantOptions.tenantId],
    references: [tenants.id],
  }),
  values: many(variantOptionValues),
}));

export const variantOptionValuesRelations = relations(variantOptionValues, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [variantOptionValues.tenantId],
    references: [tenants.id],
  }),
  option: one(variantOptions, {
    fields: [variantOptionValues.optionId],
    references: [variantOptions.id],
  }),
  productVariantOptions: many(productVariantOptions),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
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
  inventoryMovements: many(inventoryMovements),
  wishlistItems: many(wishlistItems),
}));

export const productVariantImagesRelations = relations(productVariantImages, ({ one }) => ({
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
}));

export const productVariantOptionsRelations = relations(productVariantOptions, ({ one }) => ({
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
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryMovements.tenantId],
    references: [tenants.id],
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
  user: one(user, {
    fields: [inventoryMovements.userId],
    references: [user.id],
  }),
}));

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
  items: many(orderItems),
  shipments: many(shipments),
  reviews: many(reviews),
  inventoryMovements: many(inventoryMovements),
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
}));

export const shippingZonesRelations = relations(shippingZones, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shippingZones.tenantId],
    references: [tenants.id],
  }),
  methods: many(shippingMethods),
}));

export const shippingMethodsRelations = relations(shippingMethods, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shippingMethods.tenantId],
    references: [tenants.id],
  }),
  zone: one(shippingZones, {
    fields: [shippingMethods.zoneId],
    references: [shippingZones.id],
  }),
}));

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

export const shipmentTrackingEventsRelations = relations(shipmentTrackingEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentTrackingEvents.shipmentId],
    references: [shipments.id],
  }),
}));

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

export const commissionTransactionsRelations = relations(commissionTransactions, ({ one }) => ({
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
}));

// Analytics Relations
export const analyticsDailySnapshotsRelations = relations(analyticsDailySnapshots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsDailySnapshots.tenantId],
    references: [tenants.id],
  }),
}));

export const analyticsProductPerformanceRelations = relations(analyticsProductPerformance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsProductPerformance.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [analyticsProductPerformance.productId],
    references: [products.id],
  }),
}));

export const analyticsCategoryPerformanceRelations = relations(analyticsCategoryPerformance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsCategoryPerformance.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [analyticsCategoryPerformance.categoryId],
    references: [categories.id],
  }),
}));

export const analyticsTrafficSourcesRelations = relations(analyticsTrafficSources, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsTrafficSources.tenantId],
    references: [tenants.id],
  }),
}));

export const analyticsGeographicSalesRelations = relations(analyticsGeographicSales, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsGeographicSales.tenantId],
    references: [tenants.id],
  }),
}));

export const analyticsHourlyMetricsRelations = relations(analyticsHourlyMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsHourlyMetrics.tenantId],
    references: [tenants.id],
  }),
}));

export const analyticsPageViewsRelations = relations(analyticsPageViews, ({ one }) => ({
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
}));

export const analyticsConversionEventsRelations = relations(analyticsConversionEvents, ({ one }) => ({
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
}));

// Inventory Relations
export const inventoryLocationsRelations = relations(inventoryLocations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [inventoryLocations.tenantId],
    references: [tenants.id],
  }),
  levels: many(inventoryLevels),
  movements: many(inventoryMovements),
  counts: many(inventoryCounts),
}));

export const inventoryLevelsRelations = relations(inventoryLevels, ({ one }) => ({
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
}));

export const inventoryCountsRelations = relations(inventoryCounts, ({ one, many }) => ({
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
}));

export const inventoryCountItemsRelations = relations(inventoryCountItems, ({ one }) => ({
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
}));

// Shipping Weight Tiers Relations
export const shippingWeightTiersRelations = relations(shippingWeightTiers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shippingWeightTiers.tenantId],
    references: [tenants.id],
  }),
  method: one(shippingMethods, {
    fields: [shippingWeightTiers.methodId],
    references: [shippingMethods.id],
  }),
}));

// Commission Relations
export const commissionRulesRelations = relations(commissionRules, ({ one }) => ({
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
}));

export const commissionTiersRelations = relations(commissionTiers, ({ many }) => ({
  sellerBalances: many(sellerBalances),
}));

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

export const sellerPayoutMethodsRelations = relations(sellerPayoutMethods, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sellerPayoutMethods.tenantId],
    references: [tenants.id],
  }),
  payouts: many(sellerPayouts),
}));

export const sellerTransactionsRelations = relations(sellerTransactions, ({ one }) => ({
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
}));

export const sellerPayoutsRelations = relations(sellerPayouts, ({ one, many }) => ({
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
}));

export const sellerPayoutItemsRelations = relations(sellerPayoutItems, ({ one }) => ({
  payout: one(sellerPayouts, {
    fields: [sellerPayoutItems.payoutId],
    references: [sellerPayouts.id],
  }),
  transaction: one(sellerTransactions, {
    fields: [sellerPayoutItems.transactionId],
    references: [sellerTransactions.id],
  }),
}));

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

export const affiliatePayoutMethodsRelations = relations(affiliatePayoutMethods, ({ one, many }) => ({
  affiliate: one(affiliates, {
    fields: [affiliatePayoutMethods.affiliateId],
    references: [affiliates.id],
  }),
  payouts: many(affiliatePayouts),
}));

export const affiliateTenantPartnershipsRelations = relations(affiliateTenantPartnerships, ({ one, many }) => ({
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
  rating: one(affiliateRatings),
}));

export const affiliateLinksRelations = relations(affiliateLinks, ({ one, many }) => ({
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
}));

export const affiliateClicksRelations = relations(affiliateClicks, ({ one }) => ({
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
}));

export const affiliateConversionsRelations = relations(affiliateConversions, ({ one }) => ({
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
}));

export const affiliatePayoutsRelations = relations(affiliatePayouts, ({ one }) => ({
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
}));

export const affiliateRatingsRelations = relations(affiliateRatings, ({ one }) => ({
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
}));

// Delivery Provider Relations
export const deliveryProvidersRelations = relations(deliveryProviders, ({ one, many }) => ({
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
}));

export const deliveryPayoutMethodsRelations = relations(deliveryPayoutMethods, ({ one, many }) => ({
  provider: one(deliveryProviders, {
    fields: [deliveryPayoutMethods.providerId],
    references: [deliveryProviders.id],
  }),
  payouts: many(deliveryPayouts),
}));

export const deliveryProviderZonesRelations = relations(deliveryProviderZones, ({ one }) => ({
  provider: one(deliveryProviders, {
    fields: [deliveryProviderZones.providerId],
    references: [deliveryProviders.id],
  }),
}));

export const deliveryTenantPartnershipsRelations = relations(deliveryTenantPartnerships, ({ one, many }) => ({
  provider: one(deliveryProviders, {
    fields: [deliveryTenantPartnerships.providerId],
    references: [deliveryProviders.id],
  }),
  tenant: one(tenants, {
    fields: [deliveryTenantPartnerships.tenantId],
    references: [tenants.id],
  }),
  assignments: many(deliveryAssignments),
}));

export const deliveryAssignmentsRelations = relations(deliveryAssignments, ({ one, many }) => ({
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
}));

export const deliveryTrackingEventsRelations = relations(deliveryTrackingEvents, ({ one }) => ({
  assignment: one(deliveryAssignments, {
    fields: [deliveryTrackingEvents.assignmentId],
    references: [deliveryAssignments.id],
  }),
}));

export const deliveryRatingsRelations = relations(deliveryRatings, ({ one }) => ({
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
}));

export const deliveryPayoutsRelations = relations(deliveryPayouts, ({ one, many }) => ({
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
}));

export const deliveryPayoutItemsRelations = relations(deliveryPayoutItems, ({ one }) => ({
  payout: one(deliveryPayouts, {
    fields: [deliveryPayoutItems.payoutId],
    references: [deliveryPayouts.id],
  }),
  assignment: one(deliveryAssignments, {
    fields: [deliveryPayoutItems.assignmentId],
    references: [deliveryAssignments.id],
  }),
}));

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

// Tenant member types
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
export type TenantMemberRole = (typeof tenantMemberRoleEnum.enumValues)[number];

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
export type StockStatus = (typeof stockStatusEnum.enumValues)[number];

// Inventory types
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventoryMovementType = (typeof inventoryMovementTypeEnum.enumValues)[number];

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
export type NewShipmentTrackingEvent = typeof shipmentTrackingEvents.$inferInsert;

// Review types
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReviewMedia = typeof reviewMedia.$inferSelect;
export type NewReviewMedia = typeof reviewMedia.$inferInsert;

// Commission types
export type CommissionTransactionType = (typeof commissionTransactionTypeEnum.enumValues)[number];
export type CommissionTransaction = typeof commissionTransactions.$inferSelect;
export type NewCommissionTransaction = typeof commissionTransactions.$inferInsert;

// Analytics types
export type AnalyticsDailySnapshot = typeof analyticsDailySnapshots.$inferSelect;
export type NewAnalyticsDailySnapshot = typeof analyticsDailySnapshots.$inferInsert;
export type AnalyticsProductPerformance = typeof analyticsProductPerformance.$inferSelect;
export type NewAnalyticsProductPerformance = typeof analyticsProductPerformance.$inferInsert;
export type AnalyticsCategoryPerformance = typeof analyticsCategoryPerformance.$inferSelect;
export type NewAnalyticsCategoryPerformance = typeof analyticsCategoryPerformance.$inferInsert;
export type AnalyticsTrafficSource = typeof analyticsTrafficSources.$inferSelect;
export type NewAnalyticsTrafficSource = typeof analyticsTrafficSources.$inferInsert;
export type AnalyticsGeographicSales = typeof analyticsGeographicSales.$inferSelect;
export type NewAnalyticsGeographicSales = typeof analyticsGeographicSales.$inferInsert;
export type AnalyticsHourlyMetrics = typeof analyticsHourlyMetrics.$inferSelect;
export type NewAnalyticsHourlyMetrics = typeof analyticsHourlyMetrics.$inferInsert;
export type AnalyticsPageView = typeof analyticsPageViews.$inferSelect;
export type NewAnalyticsPageView = typeof analyticsPageViews.$inferInsert;
export type AnalyticsEventType = (typeof analyticsEventTypeEnum.enumValues)[number];
export type AnalyticsConversionEvent = typeof analyticsConversionEvents.$inferSelect;
export type NewAnalyticsConversionEvent = typeof analyticsConversionEvents.$inferInsert;

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
export type SellerTransactionType = (typeof sellerTransactionTypeEnum.enumValues)[number];
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
export type AffiliateCommissionType = (typeof affiliateCommissionTypeEnum.enumValues)[number];
export type AffiliatePayoutStatus = (typeof affiliatePayoutStatusEnum.enumValues)[number];
export type Affiliate = typeof affiliates.$inferSelect;
export type NewAffiliate = typeof affiliates.$inferInsert;
export type AffiliatePayoutMethod = typeof affiliatePayoutMethods.$inferSelect;
export type NewAffiliatePayoutMethod = typeof affiliatePayoutMethods.$inferInsert;
export type AffiliateTenantPartnership = typeof affiliateTenantPartnerships.$inferSelect;
export type NewAffiliateTenantPartnership = typeof affiliateTenantPartnerships.$inferInsert;
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

// Delivery provider types
export type DeliveryProviderType = (typeof deliveryProviderTypeEnum.enumValues)[number];
export type DeliveryProviderStatus = (typeof deliveryProviderStatusEnum.enumValues)[number];
export type DeliveryAssignmentStatus = (typeof deliveryAssignmentStatusEnum.enumValues)[number];
export type DeliveryPayoutStatus = (typeof deliveryPayoutStatusEnum.enumValues)[number];
export type DeliveryProvider = typeof deliveryProviders.$inferSelect;
export type NewDeliveryProvider = typeof deliveryProviders.$inferInsert;
export type DeliveryPayoutMethod = typeof deliveryPayoutMethods.$inferSelect;
export type NewDeliveryPayoutMethod = typeof deliveryPayoutMethods.$inferInsert;
export type DeliveryProviderZone = typeof deliveryProviderZones.$inferSelect;
export type NewDeliveryProviderZone = typeof deliveryProviderZones.$inferInsert;
export type DeliveryTenantPartnership = typeof deliveryTenantPartnerships.$inferSelect;
export type NewDeliveryTenantPartnership = typeof deliveryTenantPartnerships.$inferInsert;
export type DeliveryAssignment = typeof deliveryAssignments.$inferSelect;
export type NewDeliveryAssignment = typeof deliveryAssignments.$inferInsert;
export type DeliveryTrackingEvent = typeof deliveryTrackingEvents.$inferSelect;
export type NewDeliveryTrackingEvent = typeof deliveryTrackingEvents.$inferInsert;
export type DeliveryRating = typeof deliveryRatings.$inferSelect;
export type NewDeliveryRating = typeof deliveryRatings.$inferInsert;
export type DeliveryPayout = typeof deliveryPayouts.$inferSelect;
export type NewDeliveryPayout = typeof deliveryPayouts.$inferInsert;
export type DeliveryPayoutItem = typeof deliveryPayoutItems.$inferSelect;
export type NewDeliveryPayoutItem = typeof deliveryPayoutItems.$inferInsert;
