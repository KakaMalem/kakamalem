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
} from "drizzle-orm/pg-core";

// ============================================================================
// SHARED TYPES
// ============================================================================
// Address structure for orders and shipments - enables zone matching
export type Address = {
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
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================
export const userRoleEnum = pgEnum("user_role", ["admin", "owner", "staff", "customer"]);
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
  "adjustment",    // Manual stock adjustment
  "sale",          // Stock reduced due to order
  "return",        // Stock increased due to return
  "restock",       // Stock replenished from supplier
  "reserved",      // Stock reserved for pending order
  "released",      // Reserved stock released (order cancelled)
]);

// Shipping Enums
export const shippingRateTypeEnum = pgEnum("shipping_rate_type", [
  "flat",          // Fixed rate regardless of order
  "weight_based",  // Rate based on total weight
  "price_based",   // Rate based on order subtotal (e.g., free over $50)
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",       // Shipment created, not yet handed to carrier
  "picked_up",     // Carrier has picked up the package
  "in_transit",    // Package is on the way
  "out_for_delivery", // Package is out for final delivery
  "delivered",     // Successfully delivered
  "failed",        // Delivery attempt failed
  "returned",      // Package returned to sender
]);

// Store Status Enum
export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending_review", // Just created, awaiting admin approval
  "active",         // Live and accepting orders
  "suspended",      // Temporarily disabled (by admin or due to billing)
  "inactive",       // Disabled by owner or after commission grace period
]);

// Billing Status Enum
export const billingStatusEnum = pgEnum("billing_status", [
  "free_tier",      // In free trial period (up to 10,000 AFN commission accrued)
  "active",         // Paid and in good standing
  "grace_period",   // Free tier exceeded, has 30 days to pay
  "suspended",      // Didn't pay, store suspended
  "forgiven",       // Debt forgiven (store deactivated, can reactivate by paying)
]);

// Commission Transaction Type
export const commissionTransactionTypeEnum = pgEnum("commission_transaction_type", [
  "order_commission", // Commission from order
  "payment",          // Payment received from store owner
  "adjustment",       // Manual adjustment by admin
  "forgiveness",      // Debt forgiven (write-off)
]);

// ============================================================================
// PROFILES (extends Supabase auth.users)
// ============================================================================
// This table links to Supabase Auth's auth.users table via the id field.
// The id should match the user's Supabase Auth UUID.
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // References auth.users.id (not auto-generated)
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").default("customer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("profiles_email_idx").on(table.email)]
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedTenants: many(tenants),
  tenantMembers: many(tenantMembers),
  uploadedMedia: many(media),
}));

// ============================================================================
// TENANT MEMBERS (staff/collaborators for a store)
// ============================================================================
export const tenantMemberRoleEnum = pgEnum("tenant_member_role", ["owner", "admin", "staff"]);

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: tenantMemberRoleEnum("role").default("staff").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_members_tenant_user_idx").on(table.tenantId, table.userId),
    // Index for finding all tenants a user belongs to (dashboard sidebar)
    index("tenant_members_user_id_idx").on(table.userId),
  ]
);

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(profiles, {
    fields: [tenantMembers.userId],
    references: [profiles.id],
  }),
}));

// ============================================================================
// TENANTS (Stores/Storefronts)
// ============================================================================
// Each tenant is a storefront accessible at: kakamalem.com/store/[slug]
// Features: branding, social links, SEO, analytics, and commission tracking.
export const tenants = pgTable("tenants", {
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
  commissionBalance: decimal("commission_balance", { precision: 12, scale: 2 }).default("0").notNull(), // Current owed
  freeTierLimit: decimal("free_tier_limit", { precision: 12, scale: 2 }).default("10000").notNull(), // 10,000 AFN
  freeTierExceededAt: timestamp("free_tier_exceeded_at"), // When they exceeded free tier
  gracePeriodEndsAt: timestamp("grace_period_ends_at"), // 30 days after exceeding
  // Analytics (system-managed, read-only for owners)
  analytics: jsonb("analytics").$type<StoreAnalytics>().default({
    totalViews: 0,
    uniqueVisitors: 0,
    totalOrders: 0,
    totalRevenue: 0,
  }),
  // Ownership
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [tenants.ownerId],
    references: [profiles.id],
  }),
  members: many(tenantMembers),
  media: many(media),
  products: many(products),
  categories: many(categories),
  orders: many(orders),
  shippingZones: many(shippingZones),
  commissionTransactions: many(commissionTransactions),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("categories_tenant_slug_idx").on(table.tenantId, table.slug),
  ]
);

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

// ============================================================================
// PRODUCTS
// ============================================================================
// Products can be simple (no variants) or have variants (e.g., T-shirt in S/M/L).
// For simple products: use price/stock directly on product.
// For variant products: price/stock are on productVariants, product price is base/starting price.
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
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
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
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("products_tenant_slug_idx").on(table.tenantId, table.slug),
  ]
);

// ============================================================================
// MEDIA (centralized media library - tenant-isolated)
// ============================================================================
// All uploaded files go here. Reusable across products, store logos, etc.
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => profiles.id),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 255 }),
    fileName: text("file_name"),
    fileSize: integer("file_size"), // in bytes
    mimeType: varchar("mime_type", { length: 100 }), // image/png, image/jpeg, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Index for media library queries (list all media for a tenant)
    index("media_tenant_id_idx").on(table.tenantId),
  ]
);

export const mediaRelations = relations(media, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [media.tenantId],
    references: [tenants.id],
  }),
  uploadedBy: one(profiles, {
    fields: [media.uploadedById],
    references: [profiles.id],
  }),
  productImages: many(productImages),
  categories: many(categories),
}));

// ============================================================================
// PRODUCT IMAGES (junction table linking products to media)
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Note: No tenant_id index needed here as product_id already provides tenant isolation
    uniqueIndex("product_images_product_media_idx").on(table.productId, table.mediaId),
  ]
);

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

// ============================================================================
// PRODUCT CATEGORIES (junction table for many-to-many product-category relationship)
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_categories_product_category_idx").on(table.productId, table.categoryId),
    // Index for fetching all products in a category (critical for category browsing)
    index("product_categories_category_id_idx").on(table.categoryId),
  ]
);

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

// ============================================================================
// VARIANT OPTIONS (tenant-scoped option types: Size, Color, Material, etc.)
// ============================================================================
// These define the types of options a tenant uses across their products.
// Example: A clothing store might have "Size", "Color", "Material" options.
export const variantOptions = pgTable(
  "variant_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Size", "Color", "Material"
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("variant_options_tenant_name_idx").on(table.tenantId, table.name),
  ]
);

export const variantOptionsRelations = relations(variantOptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [variantOptions.tenantId],
    references: [tenants.id],
  }),
  values: many(variantOptionValues),
}));

// ============================================================================
// VARIANT OPTION VALUES (values for each option: S, M, L, XL for Size)
// ============================================================================
// These are the specific values for each option type.
// Example: For "Size" option: "XS", "S", "M", "L", "XL", "XXL"
// Example: For "Color" option: "Red", "Blue", "Green", "Black"
// NOTE: tenant_id is denormalized here for RLS performance (avoids joins)
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique on option + value, but tenant_id first for RLS performance
    uniqueIndex("variant_option_values_tenant_option_value_idx").on(table.tenantId, table.optionId, table.value),
  ]
);

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

// ============================================================================
// PRODUCT VARIANTS (actual purchasable SKUs with their own inventory)
// ============================================================================
// Each variant is a unique combination of option values for a product.
// Example: "Blue T-Shirt - Size M" is one variant of "Blue T-Shirt" product.
// Variants have their own: SKU, price (can override), stock, and images.
// NOTE: tenant_id is denormalized here for RLS performance (avoids joins)
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
    sku: varchar("sku", { length: 100 }), // Unique identifier for this variant
    // Generated display name (e.g., "Blue / XL") - computed on insert/update
    displayName: varchar("display_name", { length: 255 }),
    // Price: null means use product's base price; set a value to override
    price: decimal("price", { precision: 10, scale: 2 }),
    // Weight: null means use product's base weight; set to override
    weight: decimal("weight", { precision: 10, scale: 3 }),
    // Dimensions: null means use product's base dimensions; set to override
    length: decimal("length", { precision: 10, scale: 2 }),
    width: decimal("width", { precision: 10, scale: 2 }),
    height: decimal("height", { precision: 10, scale: 2 }),
    // Optional variant-specific description
    description: text("description"),
    // Inventory
    stock: integer("stock").default(0).notNull(),
    reservedStock: integer("reserved_stock").default(0).notNull(), // Stock reserved for pending orders
    // Computed stock status (updated via triggers or app logic)
    stockStatus: stockStatusEnum("stock_status").default("in_stock").notNull(),
    // Optional: link to a specific image for this variant
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
    // Status
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Tenant_id first for RLS performance, SKU uniqueness within tenant+product
    uniqueIndex("product_variants_tenant_product_sku_idx").on(table.tenantId, table.productId, table.sku),
    // Index for fast RLS lookups by ID
    uniqueIndex("product_variants_tenant_id_idx").on(table.tenantId, table.id),
    // Index for fetching all variants of a product (critical for product detail pages)
    index("product_variants_product_id_idx").on(table.productId),
  ]
);

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
}));

// ============================================================================
// PRODUCT VARIANT IMAGES (junction table linking variants to media)
// ============================================================================
// Allows variants to have multiple images (e.g., iPhone Orange - 3 angles)
// Similar pattern to productImages but for variants
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Tenant_id first for RLS performance
    uniqueIndex("product_variant_images_tenant_variant_media_idx").on(
      table.tenantId,
      table.variantId,
      table.mediaId
    ),
  ]
);

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

// ============================================================================
// PRODUCT VARIANT OPTIONS (junction: links variants to their option values)
// ============================================================================
// Defines which option values make up a specific variant.
// Example: Variant "Blue-M" has: optionValue "Blue" (from Color) + optionValue "M" (from Size)
// NOTE: tenant_id is denormalized here for RLS performance and to prevent cross-tenant linking
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // A variant can only have one value per option type
    uniqueIndex("product_variant_options_variant_value_idx").on(table.variantId, table.optionValueId),
    // Index for fast RLS lookups
    uniqueIndex("product_variant_options_tenant_id_idx").on(table.tenantId, table.id),
  ]
);

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

// ============================================================================
// INVENTORY MOVEMENTS (audit log for all stock changes)
// ============================================================================
// Tracks every stock change for accountability and debugging.
// Can be used for: inventory reports, undo operations, fraud detection.
export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  // Reference to what changed (variant for variant products, product for simple products)
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  // Movement details
  type: inventoryMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(), // Positive for additions, negative for reductions
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  // Reference to related entities
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  // Who made the change
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  // Notes
  reason: text("reason"), // "Manual adjustment", "Customer return", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  user: one(profiles, {
    fields: [inventoryMovements.userId],
    references: [profiles.id],
  }),
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
}));

// ============================================================================
// CARTS (tenant-isolated)
// ============================================================================
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    customerId: uuid("customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for fast cart lookups by session
    uniqueIndex("carts_tenant_session_idx").on(table.tenantId, table.sessionId),
  ]
);

export const cartsRelations = relations(carts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [carts.tenantId],
    references: [tenants.id],
  }),
  items: many(cartItems),
}));

// ============================================================================
// CART ITEMS
// ============================================================================
// Cart items can reference either a simple product or a specific variant.
// For simple products: productId is set, variantId is null
// For variant products: both productId and variantId are set
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
    // For variant products, this links to the specific variant
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique on cart + product + variant (variant can be null for simple products)
    uniqueIndex("cart_items_cart_product_variant_idx").on(table.cartId, table.productId, table.variantId),
  ]
);

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

// ============================================================================
// ORDERS (tenant-isolated)
// ============================================================================
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Customer info
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }),
    // Structured shipping address - enables zone matching and proper invoices
    shippingAddress: jsonb("shipping_address").$type<Address>().notNull(),
    // Billing address (optional, defaults to shipping if not provided)
    billingAddress: jsonb("billing_address").$type<Address>(),
    // Financial breakdown - required for refunds, invoices, and accounting
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(), // Sum of all items
    shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    taxTotal: decimal("tax_total", { precision: 10, scale: 2 }).default("0").notNull(),
    discountTotal: decimal("discount_total", { precision: 10, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(), // subtotal + shipping + tax - discount
    // Status
    status: orderStatusEnum("status").default("pending").notNull(),
    // Notes
    customerNotes: text("customer_notes"), // Notes from customer during checkout
    staffNotes: text("staff_notes"), // Internal notes for staff
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for order history queries (most recent first)
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    // Index for status filtering
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    // Index for customer email lookups
    index("orders_tenant_email_idx").on(table.tenantId, table.customerEmail),
  ]
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  items: many(orderItems),
  shipments: many(shipments),
}));

// ============================================================================
// ORDER ITEMS
// ============================================================================
// Order items capture a snapshot of the product/variant at time of purchase.
// This ensures order history remains accurate even if products change later.
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
    // Link to variant if applicable
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    // Snapshot of product info at time of purchase (for historical accuracy)
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 255 }), // e.g., "Blue / Large"
    sku: varchar("sku", { length: 100 }), // SKU at time of purchase
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Index for fetching all items in an order (critical for order details page)
    index("order_items_order_id_idx").on(table.orderId),
  ]
);

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

// ============================================================================
// SHIPPING ZONES (geographic regions for shipping)
// ============================================================================
// Store owners define zones to group regions with similar shipping rates.
// Example: "Kabul City", "Major Cities", "Rural Areas", "International"
// Using jsonb for proper indexing and efficient queries across tenants.
export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // "Kabul City", "International"
    description: text("description"),
    // Zone matching criteria - using jsonb for indexing and efficient queries
    // All arrays use ISO codes or exact matches for reliable zone matching
    countries: jsonb("countries").$type<string[]>(), // ["AF", "PK", "IR"] (ISO 2-letter codes)
    states: jsonb("states").$type<string[]>(), // ["Kabul", "Herat", "Balkh"]
    cities: jsonb("cities").$type<string[]>(), // ["Kabul City", "Mazar-i-Sharif"]
    postalCodes: jsonb("postal_codes").$type<string[]>(), // ["1001", "1002"] or patterns
    // Priority for matching (higher = checked first, useful for overlapping zones)
    // Example: "Kabul City" (priority 10) takes precedence over "Afghanistan" (priority 1)
    priority: integer("priority").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shipping_zones_tenant_name_idx").on(table.tenantId, table.name),
  ]
);

export const shippingZonesRelations = relations(shippingZones, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shippingZones.tenantId],
    references: [tenants.id],
  }),
  methods: many(shippingMethods),
}));

// ============================================================================
// SHIPPING METHODS (delivery options per zone)
// ============================================================================
// Each zone can have multiple shipping methods with different rates.
// Example: "Standard Delivery (3-5 days)", "Express (Next Day)", "Same Day"
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
    name: varchar("name", { length: 255 }).notNull(), // "Standard Delivery"
    description: text("description"), // "Delivery in 3-5 business days"
    // Estimated delivery time
    minDeliveryDays: integer("min_delivery_days"), // 3
    maxDeliveryDays: integer("max_delivery_days"), // 5
    // Rate calculation type
    rateType: shippingRateTypeEnum("rate_type").default("flat").notNull(),
    // Base rate (for flat rate, this is the shipping cost)
    baseRate: decimal("base_rate", { precision: 10, scale: 2 }).default("0").notNull(),
    // For weight-based: rate per kg/lb after first weight threshold
    perUnitRate: decimal("per_unit_rate", { precision: 10, scale: 2 }),
    // Weight threshold for base rate (e.g., first 1kg is base rate)
    weightThreshold: decimal("weight_threshold", { precision: 10, scale: 3 }),
    // For price-based: minimum order for free shipping
    freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }),
    // Display order in checkout
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Tenant_id first for RLS performance
    uniqueIndex("shipping_methods_tenant_zone_name_idx").on(table.tenantId, table.zoneId, table.name),
  ]
);

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

// ============================================================================
// SHIPMENTS (actual shipments for orders)
// ============================================================================
// Tracks the physical shipment of an order with carrier and tracking info.
// An order can have multiple shipments (split shipments).
// Use shipmentItems to track which specific items are in each shipment.
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
    // Which shipping method was selected
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, {
      onDelete: "set null",
    }),
    // Carrier info
    carrierName: varchar("carrier_name", { length: 255 }), // "Afghan Post", "DHL", local courier
    trackingNumber: varchar("tracking_number", { length: 255 }),
    trackingUrl: text("tracking_url"), // Direct link to carrier tracking page
    // Shipping cost for this shipment (portion of order's shippingTotal)
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0").notNull(),
    // Status
    status: shipmentStatusEnum("status").default("pending").notNull(),
    // Dates
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    // Delivery address snapshot (structured, in case order address changes)
    deliveryAddress: jsonb("delivery_address").$type<Address>(),
    // Notes
    notes: text("notes"), // Internal notes for staff
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Index for fetching all shipments for an order (critical for order tracking)
    index("shipments_order_id_idx").on(table.orderId),
  ]
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
}));

// ============================================================================
// SHIPMENT ITEMS (junction: which order items are in which shipment)
// ============================================================================
// Solves the "split shipment" problem - tracks exactly which items are in each box.
// Example: T-shirt ships now, heavy jacket ships later from backorder.
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
    // Quantity of this item in this specific shipment
    // Allows partial shipments (e.g., ordered 5, shipping 3 now, 2 later)
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // An order item can be split across shipments, but each entry is unique
    uniqueIndex("shipment_items_shipment_order_item_idx").on(table.shipmentId, table.orderItemId),
    // Index for finding which shipments contain a specific order item
    index("shipment_items_order_item_id_idx").on(table.orderItemId),
  ]
);

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

// ============================================================================
// SHIPMENT TRACKING EVENTS (detailed tracking history)
// ============================================================================
// Stores tracking events/updates from carrier or manual updates.
// Example: "Package picked up at Jakarta", "Arrived at sorting facility"
export const shipmentTrackingEvents = pgTable("shipment_tracking_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  status: shipmentStatusEnum("status").notNull(),
  location: varchar("location", { length: 255 }), // "Jakarta Sorting Center"
  description: text("description"), // "Package arrived at facility"
  eventTime: timestamp("event_time").defaultNow().notNull(),
  // Source of the event
  isCarrierUpdate: boolean("is_carrier_update").default(false).notNull(), // true if from carrier API
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shipmentTrackingEventsRelations = relations(shipmentTrackingEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentTrackingEvents.shipmentId],
    references: [shipments.id],
  }),
}));

// ============================================================================
// REVIEWS (product reviews by customers)
// ============================================================================
// Reviews are published immediately - full transparency, no approval needed.
// Supports: variant attribution, owner replies, and customer-uploaded images.
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
    // Link to specific variant reviewed (if product has variants)
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    // Reviewer info
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    // Review content
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    comment: text("comment"),
    // Store owner response
    replyContent: text("reply_content"),
    repliedAt: timestamp("replied_at"),
    // Verification (auto-set if linked to order)
    isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // RLS optimization index
    uniqueIndex("reviews_tenant_id_idx").on(table.tenantId, table.id),
    // Ensure one review per product per order
    uniqueIndex("reviews_order_product_idx").on(table.orderId, table.productId),
    // Index for fetching all reviews for a product (critical for product detail pages)
    index("reviews_product_id_idx").on(table.productId),
  ]
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
  images: many(reviewMedia),
}));

// ============================================================================
// REVIEW MEDIA (customer-uploaded review images)
// ============================================================================
// Customers can upload photos with their reviews for social proof.
// Uses the same media table pattern as product_images.
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Tenant_id first for RLS performance
    uniqueIndex("review_media_tenant_review_media_idx").on(table.tenantId, table.reviewId, table.mediaId),
  ]
);

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

// ============================================================================
// COMMISSION TRANSACTIONS (audit log for all commission changes)
// ============================================================================
// Tracks every commission-related event for full accountability:
// - Commission earned from orders
// - Payments received from store owners
// - Manual adjustments by admins
// - Debt forgiveness when stores are deactivated
//
// Business Rules:
// 1. Free tier: First 10,000 AFN in commissions is free
// 2. When free tier exceeded → 30-day grace period to pay
// 3. If paid → billing_status = 'active', continue service
// 4. If not paid → billing_status = 'forgiven', store deactivated
// 5. To reactivate after forgiveness → must pay forgiven amount
export const commissionTransactions = pgTable("commission_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  // Transaction type
  type: commissionTransactionTypeEnum("type").notNull(),
  // Amount (positive for charges, negative for payments/forgiveness)
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  // Running balance after this transaction
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),
  // Reference to related order (for order_commission type)
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  // Description
  description: text("description"), // "Commission from order #123", "Payment received", etc.
  // Metadata for auditing
  processedBy: uuid("processed_by").references(() => profiles.id, { onDelete: "set null" }), // Admin who processed (for adjustments/forgiveness)
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commissionTransactionsRelations = relations(commissionTransactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [commissionTransactions.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [commissionTransactions.orderId],
    references: [orders.id],
  }),
  processedByUser: one(profiles, {
    fields: [commissionTransactions.processedBy],
    references: [profiles.id],
  }),
}));

// ============================================================================
// ANALYTICS: DAILY STORE SNAPSHOTS
// ============================================================================
// Aggregated daily metrics for store performance dashboards.
// Enables: trend analysis, period comparisons, charts, and reports.
// Generated nightly by a scheduled job that aggregates order/traffic data.
export const analyticsDailySnapshots = pgTable(
  "analytics_daily_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Date for this snapshot (UTC, no time component)
    snapshotDate: date("snapshot_date").notNull(),

    // ── Revenue & Sales ──
    grossRevenue: decimal("gross_revenue", { precision: 12, scale: 2 }).default("0").notNull(), // Total before discounts
    netRevenue: decimal("net_revenue", { precision: 12, scale: 2 }).default("0").notNull(), // After discounts
    shippingRevenue: decimal("shipping_revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    taxCollected: decimal("tax_collected", { precision: 12, scale: 2 }).default("0").notNull(),
    discountsGiven: decimal("discounts_given", { precision: 12, scale: 2 }).default("0").notNull(),
    refundsIssued: decimal("refunds_issued", { precision: 12, scale: 2 }).default("0").notNull(),
    commissionAccrued: decimal("commission_accrued", { precision: 12, scale: 2 }).default("0").notNull(), // Platform commission

    // ── Orders ──
    totalOrders: integer("total_orders").default(0).notNull(),
    completedOrders: integer("completed_orders").default(0).notNull(), // Delivered
    cancelledOrders: integer("cancelled_orders").default(0).notNull(),
    pendingOrders: integer("pending_orders").default(0).notNull(), // End of day pending
    averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }).default("0").notNull(),

    // ── Products ──
    itemsSold: integer("items_sold").default(0).notNull(), // Total quantity
    uniqueProductsSold: integer("unique_products_sold").default(0).notNull(), // Distinct products

    // ── Traffic ──
    pageViews: integer("page_views").default(0).notNull(),
    uniqueVisitors: integer("unique_visitors").default(0).notNull(),
    newVisitors: integer("new_visitors").default(0).notNull(),
    returningVisitors: integer("returning_visitors").default(0).notNull(),

    // ── Conversion ──
    cartCreations: integer("cart_creations").default(0).notNull(), // Carts started
    checkoutStarts: integer("checkout_starts").default(0).notNull(), // Reached checkout
    checkoutCompletions: integer("checkout_completions").default(0).notNull(), // Completed orders
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(), // % visitors → orders

    // ── Customer Metrics ──
    newCustomers: integer("new_customers").default(0).notNull(), // First-time buyers
    returningCustomers: integer("returning_customers").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One snapshot per tenant per day
    uniqueIndex("analytics_daily_snapshots_tenant_date_idx").on(table.tenantId, table.snapshotDate),
  ]
);

export const analyticsDailySnapshotsRelations = relations(analyticsDailySnapshots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsDailySnapshots.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// ANALYTICS: PRODUCT PERFORMANCE
// ============================================================================
// Daily product-level metrics for identifying best sellers and underperformers.
// Enables: product rankings, inventory decisions, marketing focus.
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
    // Date for this snapshot
    snapshotDate: date("snapshot_date").notNull(),

    // ── Sales ──
    quantitySold: integer("quantity_sold").default(0).notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(), // How many orders had this product

    // ── Traffic ──
    productViews: integer("product_views").default(0).notNull(),
    addToCartCount: integer("add_to_cart_count").default(0).notNull(),
    // Conversion: views → add to cart → purchase
    viewToCartRate: decimal("view_to_cart_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    cartToPurchaseRate: decimal("cart_to_purchase_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    // Revenue efficiency metric (revenue per view)
    revenuePerView: decimal("revenue_per_view", { precision: 10, scale: 2 }).default("0").notNull(),

    // ── Reviews ──
    reviewsReceived: integer("reviews_received").default(0).notNull(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }), // 1.00 - 5.00

    // ── Inventory ──
    stockAtEndOfDay: integer("stock_at_end_of_day").default(0).notNull(),
    stockStatus: stockStatusEnum("stock_status").default("in_stock").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // One row per product per day
    uniqueIndex("analytics_product_perf_tenant_product_date_idx").on(
      table.tenantId,
      table.productId,
      table.snapshotDate
    ),
  ]
);

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

// ============================================================================
// ANALYTICS: CATEGORY PERFORMANCE
// ============================================================================
// Daily category-level metrics for understanding category trends.
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

    // ── Sales ──
    quantitySold: integer("quantity_sold").default(0).notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    ordersContaining: integer("orders_containing").default(0).notNull(),
    uniqueProductsSold: integer("unique_products_sold").default(0).notNull(),

    // ── Traffic ──
    categoryViews: integer("category_views").default(0).notNull(),
    productViewsInCategory: integer("product_views_in_category").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("analytics_category_perf_tenant_cat_date_idx").on(
      table.tenantId,
      table.categoryId,
      table.snapshotDate
    ),
  ]
);

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

// ============================================================================
// ANALYTICS: TRAFFIC SOURCES
// ============================================================================
// Tracks where visitors come from (referrers, UTM parameters, direct).
// Enables: marketing ROI, channel optimization.
export const analyticsTrafficSources = pgTable(
  "analytics_traffic_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    // Source identification
    source: varchar("source", { length: 100 }).notNull(), // "google", "facebook", "instagram", "direct", "referral"
    medium: varchar("medium", { length: 100 }), // "organic", "cpc", "social", "email"
    campaign: varchar("campaign", { length: 255 }), // UTM campaign name
    referrerDomain: varchar("referrer_domain", { length: 255 }), // For referral traffic

    // Metrics
    visitors: integer("visitors").default(0).notNull(),
    pageViews: integer("page_views").default(0).notNull(),
    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const analyticsTrafficSourcesRelations = relations(analyticsTrafficSources, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsTrafficSources.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// ANALYTICS: GEOGRAPHIC SALES
// ============================================================================
// Sales breakdown by location for regional insights.
// Enables: shipping zone optimization, regional marketing, expansion decisions.
export const analyticsGeographicSales = pgTable(
  "analytics_geographic_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    // Location (from shipping address)
    countryCode: varchar("country_code", { length: 2 }).notNull(), // ISO code
    state: varchar("state", { length: 100 }),
    city: varchar("city", { length: 100 }),

    // Metrics
    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    itemsSold: integer("items_sold").default(0).notNull(),
    shippingRevenue: decimal("shipping_revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    uniqueCustomers: integer("unique_customers").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const analyticsGeographicSalesRelations = relations(analyticsGeographicSales, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsGeographicSales.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// ANALYTICS: HOURLY METRICS (for real-time dashboards)
// ============================================================================
// Granular hourly data for live monitoring and peak hour analysis.
// Retention: typically 30-90 days, older data rolled up into daily snapshots.
export const analyticsHourlyMetrics = pgTable(
  "analytics_hourly_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Hour bucket (e.g., 2024-01-15 14:00:00)
    hour: timestamp("hour").notNull(),

    // Quick metrics for real-time dashboard
    pageViews: integer("page_views").default(0).notNull(),
    uniqueVisitors: integer("unique_visitors").default(0).notNull(),
    orders: integer("orders").default(0).notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    cartCreations: integer("cart_creations").default(0).notNull(),
    checkoutStarts: integer("checkout_starts").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("analytics_hourly_tenant_hour_idx").on(table.tenantId, table.hour),
  ]
);

export const analyticsHourlyMetricsRelations = relations(analyticsHourlyMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsHourlyMetrics.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// ANALYTICS: PAGE VIEWS (raw events for detailed analysis)
// ============================================================================
// Individual page view events for funnel analysis and user journey tracking.
// High-volume table - consider partitioning or time-based cleanup in production.
export const analyticsPageViews = pgTable("analytics_page_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Session/visitor identification
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  visitorId: varchar("visitor_id", { length: 255 }), // Persistent across sessions (cookie/fingerprint)
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }), // If logged in

  // Page info
  pageType: varchar("page_type", { length: 50 }).notNull(), // "home", "product", "category", "cart", "checkout", "order_confirmation"
  pagePath: varchar("page_path", { length: 500 }).notNull(), // "/store/myshop/product/blue-shirt"
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),

  // Traffic source (captured on first page of session)
  referrer: text("referrer"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),

  // Device/browser info
  deviceType: varchar("device_type", { length: 20 }), // "desktop", "mobile", "tablet"
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),

  // Geo (from IP)
  countryCode: varchar("country_code", { length: 2 }),
  city: varchar("city", { length: 100 }),

  // Timestamp
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const analyticsPageViewsRelations = relations(analyticsPageViews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsPageViews.tenantId],
    references: [tenants.id],
  }),
  user: one(profiles, {
    fields: [analyticsPageViews.userId],
    references: [profiles.id],
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

// ============================================================================
// ANALYTICS: CONVERSION EVENTS
// ============================================================================
// Key funnel events for conversion tracking and optimization.
// Events: add_to_cart, remove_from_cart, checkout_start, checkout_complete, etc.
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

export const analyticsConversionEvents = pgTable("analytics_conversion_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Event info
  eventType: analyticsEventTypeEnum("event_type").notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  visitorId: varchar("visitor_id", { length: 255 }),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),

  // Context (varies by event type)
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),

  // Event-specific data
  quantity: integer("quantity"), // For add_to_cart
  value: decimal("value", { precision: 12, scale: 2 }), // For checkout_complete (order total)
  searchQuery: varchar("search_query", { length: 255 }), // For search events

  // Timestamp
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export const analyticsConversionEventsRelations = relations(analyticsConversionEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsConversionEvents.tenantId],
    references: [tenants.id],
  }),
  user: one(profiles, {
    fields: [analyticsConversionEvents.userId],
    references: [profiles.id],
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

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
export type TenantMemberRole = (typeof tenantMemberRoleEnum.enumValues)[number];
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
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
// Cart & Order types
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReviewMedia = typeof reviewMedia.$inferSelect;
export type NewReviewMedia = typeof reviewMedia.$inferInsert;
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
// Tenant status & billing types
export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];
export type BillingStatus = (typeof billingStatusEnum.enumValues)[number];
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
