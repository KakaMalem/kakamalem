# Marketplace Implementation Plan

> **Version:** 1.0.0
> **Status:** Draft
> **Last Updated:** February 2026
> **Authors:** Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Vision: Store-Directory Marketplace](#3-vision-store-directory-marketplace)
4. [Industry Standards & Research](#4-industry-standards--research)
5. [Emerging Patterns (2025-2026)](#5-emerging-patterns-2025-2026)
6. [Schema Design](#6-schema-design)
7. [Implementation Phases](#7-implementation-phases)
8. [Technical Specifications](#8-technical-specifications)
9. [SEO Strategy](#9-seo-strategy)
10. [Analytics & Tracking](#10-analytics--tracking)
11. [Monetization Strategy](#11-monetization-strategy)
12. [Afghan Market Considerations](#12-afghan-market-considerations)

---

## 1. Executive Summary

### 1.1 Vision

Transform the Kaka Malem marketplace from a product-listing model (Amazon-style) into a **store-directory marketplace** — a digital bazaar where customers discover, browse, and follow stores. Think of it as a mall directory or food court menu, not a product catalog.

**Key principle:** The unit of discovery is the **store**, not the product.

### 1.2 Why Store-Directory Over Product-Listing

| Factor           | Product-Listing (Amazon)          | Store-Directory (Our Model)   |
| ---------------- | --------------------------------- | ----------------------------- |
| **Trust model**  | Trust the platform                | Trust the shopkeeper          |
| **Discovery**    | Search for items                  | Browse shops                  |
| **Relationship** | Transactional, one-off            | Ongoing, follow stores        |
| **Cultural fit** | Western e-commerce                | Afghan bazaar culture         |
| **Brand value**  | Products compete on price         | Stores build identity         |
| **Complexity**   | Needs product normalization       | Simpler, each store is unique |
| **Competition**  | Stores compete against each other | Stores complement each other  |

The Afghan market is relationship-driven. Customers return to the same shopkeeper they trust. Our marketplace should mirror this — it's a directory of trusted shops, not a warehouse of commodities.

### 1.3 What Changes

| Current                                     | Target                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| Marketplace lists products in a grid        | Marketplace lists stores with rich profiles             |
| Product cards link to individual products   | Store cards link to store profile pages                 |
| Category filtering on products              | Category filtering on stores                            |
| `getMarketplaceProducts()` is primary query | `getMarketplaceStores()` is primary query               |
| No store profile page in marketplace        | Full store profile page at `/marketplace/stores/[slug]` |
| No follow/favorite system                   | Users can follow stores                                 |
| No store-level reviews                      | Aggregate store ratings front and center                |
| Single marketplace toggle                   | Rich marketplace settings (cover image, tags, about)    |
| Simple ILIKE search                         | Full-text search with store-focused autocomplete        |

---

## 2. Current State Analysis

### 2.1 What Exists

**Schema:**

- `tenants.marketplaceEnabled` boolean flag
- Composite index on `(marketplace_enabled, status)`
- `orderChannelEnum` has `"marketplace"` value (reserved, not used)

**Queries** (`lib/db/queries/marketplace.ts`):

- `getMarketplaceStores()` — paginated stores with ratings, product count
- `getMarketplaceProducts()` — paginated products across marketplace stores
- `getMarketplaceCategories()` — aggregated categories with product counts

**Pages:**

- `/marketplace` — hero, featured stores carousel, product grid, search/filter
- `/dashboard/[slug]/settings/marketplace` — toggle switch for marketplace visibility

**Components:**

- `MarketplaceStoreCard` — basic card with logo, name, tagline, rating, location
- `MarketplaceProductCard` — product card with image, price, store badge
- `MarketplaceSearch` — search with URL param sync
- `MarketplaceFilters` — category pills and sort dropdown

**Actions:**

- `updateMarketplaceSettings()` — toggle marketplace visibility

### 2.2 What Needs to Change

| Area                     | Current Problem                       | Target                                                                 |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| **Primary content**      | Products are the focus                | Stores are the focus                                                   |
| **Store cards**          | Minimal info (logo, name, tagline)    | Rich cards with cover image, category, featured products, trust badges |
| **Store profiles**       | No dedicated marketplace profile page | Full profile with about section, gallery, reviews, products            |
| **Discovery**            | Basic ILIKE search                    | Full-text search, category browse, location filter                     |
| **Trust signals**        | None                                  | Verification badges, ratings, activity indicators                      |
| **Engagement**           | View-only                             | Follow stores, share, report                                           |
| **Personalization**      | None                                  | Recently viewed, recommended, followed stores feed                     |
| **Marketplace settings** | Single toggle                         | Cover image, tags, about text, featured products picker                |
| **SEO**                  | No structured data                    | Schema.org `Store` markup, dedicated sitemaps                          |

---

## 3. Vision: Store-Directory Marketplace

### 3.1 User Experience Flow

```
Homepage (/marketplace)
├── Search bar + category pills
├── "Featured Stores" curated section
├── "New on Kaka Malem" section
├── "Popular in [City]" section
├── "Stores You Follow" (logged in)
├── Browse by Category grid
└── All Stores feed (Load More pagination)

Store Profile (/marketplace/stores/[slug])
├── Cover image + logo + store name
├── Category badges + verification badge
├── Tagline + about section
├── Stats bar (rating, reviews, products, orders)
├── Featured products showcase (3-6 items)
├── "Visit Store" prominent CTA
├── Store reviews section
├── "Similar Stores" recommendations
└── Share / Report / Follow actions
```

### 3.2 Store Card Design

The store card is the core building block. Based on industry research (DoorDash, Etsy, Yelp), a high-performing store card includes:

```
┌─────────────────────────────────┐
│  [      Cover Image       ]     │
│  ┌──┐                          │
│  │🖼│  Store Name               │
│  │  │  "Tagline goes here..."   │
│  └──┘                          │
│                                 │
│  🏷 Category   📍 Kabul         │
│  ⭐ 4.7 (128)  📦 45 products  │
│                                 │
│  [img1] [img2] [img3]          │  ← featured product thumbnails
│                                 │
│  ✓ Verified  🟢 Active today   │
└─────────────────────────────────┘
```

**Required fields:** Cover image, logo, name, tagline, category, location, rating, product count
**Optional fields:** Featured product thumbnails (Pro only), verification badge, activity indicator

### 3.3 Information Architecture

```
/marketplace                          → Store discovery homepage
/marketplace/stores                   → All stores (with filtering)
/marketplace/stores/[slug]            → Store profile page
/marketplace/categories               → Browse by category
/marketplace/categories/[slug]        → Stores in a category
/marketplace/cities/[city]            → Stores in a city
```

---

## 4. Industry Standards & Research

### 4.1 How Leading Platforms Organize Store Listings

The dominant pattern across DoorDash, UberEats, Yelp, and Etsy is **category-first browsing** layered with personalization:

1. **Hero section** with search and curated collections ("New Stores", "Trending")
2. **Horizontal category chips** for quick filtering (primary navigation)
3. **Vertical grid** of store cards (2-3 columns desktop, 1-2 mobile)
4. **Curated sections** interspersed: "Recently Added", "Highly Rated", "Popular in [City]"

Key insight: store-directory marketplaces should feel like **discovery experiences** (think Pinterest), not transactional search tools (think Amazon).

### 4.2 Essential Store Card Metadata

Based on DoorDash, Yelp, Google Maps, Etsy analysis:

**Tier 1 (Must-Have):**

- Store name, cover image, logo
- Category label
- Star rating + review count
- Verification badge

**Tier 2 (Strongly Recommended):**

- Short tagline (1-2 lines)
- Location / city
- Product count
- Active/online status indicator
- Price range indicator ($ / $$ / $$$)

**Tier 3 (Nice-to-Have):**

- "New" badge (stores < 30 days old)
- Featured product thumbnails (2-3 mini images)
- Order completion count
- Response time

### 4.3 Filtering & Sorting Best Practices

**Filters (Baymard Institute research — 68% of sites fail on filter UX):**

| Filter          | Type                                         | Priority  |
| --------------- | -------------------------------------------- | --------- |
| Category        | Pills/chips (always visible)                 | Primary   |
| City / Province | Dropdown or pills                            | Primary   |
| Minimum Rating  | Star selector (3+, 4+, 4.5+)                 | Secondary |
| Store Features  | Checkboxes (accepts COD, delivery, verified) | Secondary |
| Recently Active | Toggle (active this week)                    | Tertiary  |

**Sorting:**

| Sort          | Default | Description                                    |
| ------------- | ------- | ---------------------------------------------- |
| Recommended   | Yes     | Algorithmic (rating × activity × completeness) |
| Highest Rated |         | By aggregate rating                            |
| Most Popular  |         | By order count                                 |
| Newest        |         | By createdAt                                   |
| Alphabetical  |         | By name (A-Z)                                  |

**Applied filters** should always show in an overview bar with remove buttons.

### 4.4 Trust Signals (Google 2025 Verification Research)

Google's unification of trust badges in October 2025 into a single "Verified" badge confirms the industry trend toward simplification. Use **no more than 3 badges per store card**.

**Recommended badge system:**

| Badge          | Criteria                             | Visual         |
| -------------- | ------------------------------------ | -------------- |
| **Verified**   | Identity confirmed by platform       | Blue checkmark |
| **Pro Seller** | Paid Pro subscription + good metrics | Gold badge     |
| **Top Rated**  | 4.5+ rating with 50+ reviews         | Star badge     |

**Activity indicators:**

- "Active today" (green dot)
- "Active this week" (gray dot)
- "Last active X days ago" (no dot)

### 4.5 Pagination: Load More (Recommended)

Based on Baymard Institute and NN/g research:

| Method          | SEO      | UX               | Performance    |
| --------------- | -------- | ---------------- | -------------- |
| Pagination      | Best     | More friction    | Best           |
| Infinite Scroll | Worst    | Most engaging    | Worst (memory) |
| **Load More**   | **Good** | **Good balance** | **Good**       |

"Load More" is ideal for the Afghan market:

- Better performance on mid-range Android phones
- Users can reach the footer
- Each batch can have a URL for SEO
- Initial load: 12 stores, then 12 per batch

---

## 5. Emerging Patterns (2025-2026)

### 5.1 Store Storytelling

Etsy's "About" section model — especially powerful in Afghan culture where personal relationships matter:

- Founder/shopkeeper story with photos
- How products are made / sourced
- Team photos
- Milestones ("Established 2020", "1,000th order")
- Social media links

### 5.2 Social Proof Integration

- 84% of consumers trust UGC over branded content (2025 Amra & Elma study)
- Customer photos on store profiles
- "X people viewed this store today" real-time indicators
- Community-driven reviews with photo uploads

### 5.3 Location-Based Discovery

Critical for Afghanistan where delivery zones and local trust matter:

- City/province filtering as primary navigation axis
- "Popular in [City]" curated sections
- "Stores near you" (future, with geolocation)
- Province-based landing pages for SEO

### 5.4 Personalized Discovery

- "Stores You Follow" feed for logged-in users
- "Recently Viewed" section
- "Because you visited [Store], you might like..." recommendations
- Seasonal curation: "Nowruz Gift Shops", "Eid Collection Stores"

### 5.5 Store Quick Preview

Without leaving the listing page:

- Hover (desktop): Expanded card with more details
- Tap (mobile): Bottom sheet with top products, rating breakdown, "Visit Store" CTA
- Prevents unnecessary page navigations on slow connections

---

## 6. Schema Design

### 6.1 New Tables

```sql
-- Store marketplace profile (extends tenants)
CREATE TABLE marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cover_image TEXT,                        -- Cover image path
  about TEXT,                              -- Rich text store story (max 2000 chars)
  tags TEXT[] DEFAULT '{}',               -- Store tags for search/filtering
  featured_product_ids UUID[] DEFAULT '{}', -- Curated product IDs (max 6)
  price_range SMALLINT DEFAULT 2,         -- 1=budget, 2=mid, 3=premium
  highlights TEXT[] DEFAULT '{}',         -- AI-extracted or manual highlights
  social_links JSONB DEFAULT '{}',        -- { instagram, facebook, whatsapp, tiktok }
  is_verified BOOLEAN DEFAULT FALSE,      -- Platform-verified store
  verified_at TIMESTAMPTZ,
  display_order INTEGER DEFAULT 0,        -- Manual sort for featured stores
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Store follows (user follows store)
CREATE TABLE store_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Store marketplace categories (explicit category assignment)
CREATE TABLE marketplace_store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,            -- e.g., "clothing", "electronics"
  category_name TEXT NOT NULL,            -- Display name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, category_slug)
);

-- Marketplace impressions/clicks for analytics
CREATE TABLE marketplace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,               -- 'impression', 'click', 'follow', 'share'
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,                           -- NULL for anonymous
  session_id TEXT,                        -- Anonymous tracking
  source TEXT,                            -- 'homepage', 'search', 'category', 'similar'
  metadata JSONB DEFAULT '{}',            -- search_query, category, position, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predefined marketplace categories (platform-level)
CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_fa TEXT,                           -- Dari/Farsi name
  name_ps TEXT,                           -- Pashto name
  icon TEXT,                              -- Icon name or emoji
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Schema Changes to Existing Tables

```sql
-- Add marketplace-relevant fields to tenants
ALTER TABLE tenants
  ADD COLUMN marketplace_category_slug TEXT,         -- Primary category
  ADD COLUMN marketplace_score REAL DEFAULT 0,       -- Computed ranking score
  ADD COLUMN marketplace_last_active_at TIMESTAMPTZ; -- Last product/order activity

-- Indexes for marketplace queries
CREATE INDEX marketplace_profiles_tenant_idx ON marketplace_profiles(tenant_id);
CREATE INDEX store_follows_user_idx ON store_follows(user_id);
CREATE INDEX store_follows_tenant_idx ON store_follows(tenant_id);
CREATE INDEX marketplace_events_tenant_idx ON marketplace_events(tenant_id, created_at);
CREATE INDEX marketplace_events_type_idx ON marketplace_events(event_type, created_at);
CREATE INDEX tenants_marketplace_score_idx ON tenants(marketplace_score DESC)
  WHERE marketplace_enabled = TRUE AND status = 'active';

-- Full-text search index on tenants
ALTER TABLE tenants ADD COLUMN search_vector tsvector;
CREATE INDEX tenants_search_idx ON tenants USING GIN(search_vector);
-- Trigger to auto-update search_vector (see custom migration)
```

### 6.3 Drizzle Schema Additions

```typescript
// In lib/db/schema.ts

export const marketplaceProfiles = pgTable("marketplace_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  coverImage: text("cover_image"),
  about: text("about"),
  tags: text("tags").array().default([]),
  featuredProductIds: uuid("featured_product_ids").array().default([]),
  priceRange: smallint("price_range").default(2),
  highlights: text("highlights").array().default([]),
  socialLinks: jsonb("social_links").default({}),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const storeFollows = pgTable(
  "store_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.userId, table.tenantId)]
);

export const marketplaceStoreCategories = pgTable(
  "marketplace_store_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categorySlug: text("category_slug").notNull(),
    categoryName: text("category_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.categorySlug)]
);

export const marketplaceEvents = pgTable("marketplace_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  sessionId: text("session_id"),
  source: text("source"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const marketplaceCategories = pgTable("marketplace_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameFa: text("name_fa"),
  namePs: text("name_ps"),
  icon: text("icon"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## 7. Implementation Phases

### Phase 1: Store-First Marketplace Core

**Goal:** Replace product-focused marketplace with store-focused one.

**Duration:** ~1 week

#### 1.1 Schema & Migration

- [ ] Add `marketplace_profiles` table
- [ ] Add `marketplace_categories` platform table
- [ ] Add `marketplace_store_categories` junction table
- [ ] Add `marketplace_score`, `marketplace_category_slug`, `marketplace_last_active_at` to tenants
- [ ] Add `search_vector` tsvector column + GIN index to tenants
- [ ] Create custom migration for search vector trigger
- [ ] Seed marketplace categories (Clothing, Electronics, Food, Handmade, Home, Beauty, etc.)
- [ ] Run `pnpm db:generate` and review migration

#### 1.2 Queries Refactor

- [ ] Rewrite `getMarketplaceStores()` with:
  - Join to `marketplace_profiles` for cover image, about, tags, verification
  - Full-text search using `search_vector` instead of ILIKE
  - Category filtering via `marketplace_store_categories`
  - City/province filtering from tenant location fields
  - Rating aggregation from reviews
  - Follower count subquery
  - Sorting by marketplace_score (recommended), rating, newest, name
- [ ] Add `getMarketplaceStoreProfile(slug)` for store profile page:
  - Full profile data including about, social links, highlights
  - Featured products (resolved from IDs)
  - Review summary (count, average, distribution)
  - Follower count
  - Recent activity
- [ ] Add `getMarketplaceCategories()` for platform categories (not product-derived)
- [ ] Add `getStoresByCategory(categorySlug)` for category pages
- [ ] Add `getSimilarStores(tenantId)` for "Similar Stores" section
- [ ] Remove or deprecate `getMarketplaceProducts()` (no longer primary)

#### 1.3 Marketplace Homepage Rebuild

File: `app/marketplace/page.tsx`

- [ ] Remove product grid section
- [ ] Add search bar with store-focused autocomplete
- [ ] Add horizontal category chips from platform categories
- [ ] Add "Featured Stores" section (editorially curated via `display_order`)
- [ ] Add "New on Kaka Malem" section (stores created < 30 days)
- [ ] Add "Highest Rated" section
- [ ] Add city/province filter (pill-style or dropdown)
- [ ] Add "All Stores" grid with Load More pagination
- [ ] Sorting options: Recommended, Highest Rated, Most Popular, Newest, A-Z

#### 1.4 Store Card Redesign

File: `components/marketplace/marketplace-store-card.tsx`

- [ ] Add cover image (primary visual, aspect ratio 16:9)
- [ ] Logo overlay on cover image (bottom-left)
- [ ] Category badge
- [ ] Location (city)
- [ ] Star rating + review count
- [ ] Product count
- [ ] Verification badge (if verified)
- [ ] "New" badge (if < 30 days old)
- [ ] "Active today" indicator
- [ ] Hover effect: slight scale + shadow
- [ ] Link to `/marketplace/stores/[slug]`

#### 1.5 Store Profile Page (New)

File: `app/marketplace/stores/[slug]/page.tsx`

- [ ] Cover image hero with logo overlay
- [ ] Store name, tagline, category badges
- [ ] Verification + Pro Seller badges
- [ ] Stats bar: rating, review count, product count, follower count
- [ ] "Visit Store" primary CTA button → links to `/store/[slug]`
- [ ] "Follow" button (authenticated users)
- [ ] "Share" button
- [ ] About section (rich text, collapsible if long)
- [ ] Featured products row (3-6 items, links to store)
- [ ] Store reviews section with rating breakdown
- [ ] "Similar Stores" recommendations
- [ ] Schema.org `Store` structured data
- [ ] Open Graph meta tags

#### 1.6 Marketplace Settings Expansion

File: `app/dashboard/[slug]/settings/marketplace/`

- [ ] Keep existing marketplace toggle
- [ ] Add cover image upload
- [ ] Add "About your store" rich text field (max 2000 chars)
- [ ] Add marketplace category selector (pick from platform categories)
- [ ] Add tags input (up to 10 tags)
- [ ] Add featured products picker (select up to 6 products)
- [ ] Add price range selector (Budget / Mid-Range / Premium)
- [ ] Add social links fields (Instagram, Facebook, WhatsApp, TikTok)
- [ ] Preview of how store card will look on marketplace

---

### Phase 2: Discovery & Engagement

**Goal:** Help users find the right stores and keep coming back.

**Duration:** ~1 week

#### 2.1 Follow System

- [ ] Add `store_follows` table
- [ ] Server actions: `followStore()`, `unfollowStore()`, `getFollowedStores()`
- [ ] Follow button component (optimistic UI with React Query)
- [ ] "Stores You Follow" section on marketplace homepage (logged in)
- [ ] Follow count on store profile and store card

#### 2.2 Full-Text Search

- [ ] Implement PostgreSQL `tsvector` trigger on tenants (name, tagline, description)
- [ ] Search query uses `tsquery` with ranking
- [ ] Search autocomplete component with grouped results:
  - "Stores" section (logo + name + category)
  - "Categories" section
- [ ] Recent searches (stored in localStorage)
- [ ] Popular searches section (from `marketplace_events`)

#### 2.3 Category & Location Pages

- [ ] `/marketplace/categories` — browse all categories with store counts
- [ ] `/marketplace/categories/[slug]` — stores in category with filters
- [ ] `/marketplace/cities/[city]` — stores in a city
- [ ] Category page SEO (unique meta, breadcrumbs, structured data)

#### 2.4 Curated Sections

- [ ] "Popular in [City]" — top stores by score per city
- [ ] "Trending" — stores with accelerating order volume (week-over-week growth)
- [ ] "Staff Picks" — admin-curated via `display_order`
- [ ] "Recently Viewed" — client-side (localStorage or Zustand)

#### 2.5 Store Quick Preview

- [ ] Desktop: hover card with expanded info (cover, stats, featured products)
- [ ] Mobile: bottom sheet on long-press or dedicated preview button
- [ ] "Visit Store" CTA in preview

---

### Phase 3: Trust, Quality & Ranking

**Goal:** Surface the best stores and build trust signals.

**Duration:** ~1 week

#### 3.1 Store Verification System

- [ ] Admin UI at `/admin/marketplace` to verify stores
- [ ] Verification criteria checklist:
  - Business information complete
  - Logo and cover image uploaded
  - At least 5 products listed
  - At least 1 order completed
- [ ] "Verified" badge display on cards and profile
- [ ] `is_verified` + `verified_at` fields in `marketplace_profiles`

#### 3.2 Store Ranking Algorithm

Compute `marketplace_score` as a weighted composite:

| Signal               | Weight | Source                                        |
| -------------------- | ------ | --------------------------------------------- |
| Rating score         | 25%    | Average review rating (min 5 reviews)         |
| Review volume        | 15%    | log(review_count + 1)                         |
| Order volume         | 20%    | log(total_orders + 1) from analytics          |
| Activity recency     | 15%    | Decay function on last product/order activity |
| Profile completeness | 10%    | Has cover, about, category, social links      |
| Pro subscription     | 10%    | Is Pro subscriber                             |
| Verification         | 5%     | Is verified                                   |

- [ ] Implement score calculation function
- [ ] Run as scheduled job (daily cron or on-demand via admin action)
- [ ] Store score in `tenants.marketplace_score`
- [ ] Use as default sort ("Recommended")

#### 3.3 Store-Level Reviews

- [ ] Aggregate existing product reviews at the store level
- [ ] Rating breakdown chart (5-star distribution)
- [ ] Review highlights (manually or AI-extracted common themes)
- [ ] "Verified Purchase" badge on reviews
- [ ] Review recency: show most recent first

#### 3.4 Activity & Trust Indicators

- [ ] "Active today" / "Active this week" based on `marketplace_last_active_at`
- [ ] Update `marketplace_last_active_at` on product creation and order fulfillment
- [ ] "X orders completed" milestone badges (50+, 100+, 500+, 1000+)
- [ ] "Member since [Year]" on store profile
- [ ] "Responds within X hours" (future — needs messaging system)

---

### Phase 4: Analytics & Optimization

**Goal:** Give store owners marketplace insights and track platform metrics.

**Duration:** ~3-5 days

#### 4.1 Marketplace Event Tracking

- [ ] Track impressions (store card shown in viewport)
- [ ] Track clicks (store card → profile page)
- [ ] Track follows/unfollows
- [ ] Track shares
- [ ] Track "Visit Store" clicks from profile
- [ ] Track search queries
- [ ] Store events in `marketplace_events` table

#### 4.2 Store Owner Marketplace Analytics

Add to dashboard billing/analytics page:

- [ ] Marketplace impressions (how many times your card was shown)
- [ ] Marketplace CTR (clicks / impressions)
- [ ] Profile views
- [ ] Follower growth chart
- [ ] Top search queries that led to your store
- [ ] Marketplace-referred orders (attribution via `orderChannel = 'marketplace'`)

#### 4.3 Platform Admin Marketplace Dashboard

At `/admin/marketplace`:

- [ ] Total marketplace stores (enabled vs total)
- [ ] Marketplace traffic (total impressions, clicks)
- [ ] Top performing stores
- [ ] Category distribution
- [ ] Verify/unverify stores
- [ ] Manage marketplace categories (CRUD)
- [ ] Feature/unfeature stores
- [ ] Marketplace health metrics

---

### Phase 5: Monetization & Premium Features (Future)

**Goal:** Marketplace-driven revenue beyond subscriptions.

#### 5.1 Premium Store Cards (Pro Benefit)

Pro subscribers get enhanced marketplace presence:

| Feature                     | Free           | Pro              |
| --------------------------- | -------------- | ---------------- |
| Basic store listing         | Yes            | Yes              |
| Cover image on card         | No (logo only) | Yes              |
| Featured product thumbnails | No             | Yes (up to 4)    |
| Search ranking boost        | None           | +10% score boost |
| Marketplace analytics       | Views only     | Full funnel      |
| "Pro Seller" badge          | No             | Yes              |
| Social links display        | No             | Yes              |

#### 5.2 Promoted Placements (Future)

- Featured carousel slot (daily fee)
- In-feed promoted cards (every 8th card, labeled "Sponsored")
- Category page header placement
- Search result boost

#### 5.3 Marketplace Commission (Future)

- Track orders originating from marketplace via `orderChannel = 'marketplace'`
- 30-day attribution window
- Tiered commission: 5% for Free, 3% for Pro

---

## 8. Technical Specifications

### 8.1 File Structure

```
app/
├── marketplace/
│   ├── page.tsx                           # Marketplace homepage
│   ├── layout.tsx                         # Marketplace layout (navbar + footer)
│   ├── stores/
│   │   └── [slug]/
│   │       └── page.tsx                   # Store profile page
│   ├── categories/
│   │   ├── page.tsx                       # All categories
│   │   └── [slug]/
│   │       └── page.tsx                   # Stores in category
│   └── cities/
│       └── [city]/
│           └── page.tsx                   # Stores in city

components/
├── marketplace/
│   ├── marketplace-store-card.tsx         # Redesigned store card
│   ├── marketplace-store-grid.tsx         # Grid with Load More
│   ├── marketplace-search.tsx             # Search with autocomplete
│   ├── marketplace-filters.tsx            # Category + location + sort
│   ├── marketplace-category-chips.tsx     # Horizontal scrollable chips
│   ├── marketplace-store-preview.tsx      # Quick preview (hover/bottom sheet)
│   ├── marketplace-curated-section.tsx    # Reusable section (Featured, New, etc.)
│   ├── store-profile/
│   │   ├── store-profile-header.tsx       # Cover + logo + stats
│   │   ├── store-profile-about.tsx        # About section
│   │   ├── store-profile-products.tsx     # Featured products
│   │   ├── store-profile-reviews.tsx      # Reviews section
│   │   └── store-profile-similar.tsx      # Similar stores
│   ├── follow-button.tsx                  # Follow/unfollow store
│   └── share-button.tsx                   # Share store

lib/
├── db/queries/
│   └── marketplace.ts                     # Refactored queries (store-focused)
├── actions/
│   └── marketplace.ts                     # Server actions (follow, events, settings)
└── validations/
    └── marketplace.ts                     # Zod schemas for marketplace forms
```

### 8.2 Full-Text Search Implementation

```sql
-- Custom migration: drizzle/custom/0002_marketplace_search_trigger.sql

-- Create search vector trigger function
CREATE OR REPLACE FUNCTION tenants_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER tenants_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, tagline, description
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION tenants_search_vector_update();

-- Backfill existing rows
UPDATE tenants SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(tagline, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C');
```

Using `'simple'` dictionary instead of `'english'` because store names and descriptions will often be in Dari/Pashto/mixed languages.

### 8.3 Store Ranking Score Calculation

```typescript
// lib/db/queries/marketplace.ts

export async function computeMarketplaceScores() {
  // Run as scheduled job or admin action
  await db.execute(sql`
    UPDATE tenants t SET marketplace_score = (
      -- Rating (25%) - normalized to 0-1
      COALESCE((
        SELECT AVG(r.rating) / 5.0
        FROM reviews r
        JOIN products p ON p.id = r.product_id
        WHERE p.tenant_id = t.id AND r.is_approved = true
        HAVING COUNT(*) >= 5
      ), 0) * 0.25 +

      -- Review volume (15%) - log scale
      LEAST(LOG(COALESCE((
        SELECT COUNT(*)
        FROM reviews r
        JOIN products p ON p.id = r.product_id
        WHERE p.tenant_id = t.id AND r.is_approved = true
      ), 0) + 1) / 3.0, 1) * 0.15 +

      -- Order volume (20%) - from analytics JSON
      LEAST(LOG(COALESCE(
        (t.analytics->>'totalOrders')::int, 0
      ) + 1) / 4.0, 1) * 0.20 +

      -- Activity recency (15%) - exponential decay
      EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(t.marketplace_last_active_at, t.created_at))) / 2592000) * 0.15 +

      -- Profile completeness (10%)
      (CASE WHEN EXISTS (
        SELECT 1 FROM marketplace_profiles mp
        WHERE mp.tenant_id = t.id
        AND mp.cover_image IS NOT NULL
        AND mp.about IS NOT NULL
        AND array_length(mp.tags, 1) > 0
      ) THEN 0.10 ELSE
        (CASE WHEN t.logo IS NOT NULL THEN 0.03 ELSE 0 END) +
        (CASE WHEN t.tagline IS NOT NULL THEN 0.03 ELSE 0 END) +
        (CASE WHEN t.description IS NOT NULL THEN 0.04 ELSE 0 END)
      END) +

      -- Pro subscription (10%)
      (CASE WHEN t.subscription_plan = 'pro'
        AND t.subscription_status = 'active' THEN 0.10 ELSE 0 END) +

      -- Verification (5%)
      (CASE WHEN EXISTS (
        SELECT 1 FROM marketplace_profiles mp
        WHERE mp.tenant_id = t.id AND mp.is_verified = true
      ) THEN 0.05 ELSE 0 END)
    )
    WHERE t.marketplace_enabled = true AND t.status = 'active'
  `);
}
```

### 8.4 Caching Strategy

| Data                        | Cache Layer | TTL        | Invalidation                                       |
| --------------------------- | ----------- | ---------- | -------------------------------------------------- |
| Marketplace homepage        | ISR         | 5 minutes  | `revalidatePath('/marketplace')`                   |
| Store profile page          | ISR         | 5 minutes  | `revalidatePath('/marketplace/stores/[slug]')`     |
| Category pages              | ISR         | 5 minutes  | `revalidatePath('/marketplace/categories/[slug]')` |
| Marketplace categories list | React Query | 10 minutes | Stale-while-revalidate                             |
| Store follow status         | React Query | 30 seconds | Optimistic update                                  |
| Marketplace scores          | DB column   | 24 hours   | Cron job                                           |
| Search autocomplete         | Client-side | Session    | On search                                          |

### 8.5 API Routes (if needed)

```
GET /api/marketplace/search?q=...&limit=8        → Autocomplete results
GET /api/marketplace/events                       → Track impression/click (POST)
```

Most data fetching uses Server Components + direct DB queries (no API routes needed).

---

## 9. SEO Strategy

### 9.1 Structured Data

**Store Profile Page** — Schema.org `Store`:

```json
{
  "@context": "https://schema.org",
  "@type": "Store",
  "name": "Afghan Silk House",
  "description": "Premium silk scarves and traditional Afghan textiles",
  "image": "https://kakamalem.com/uploads/stores/cover.jpg",
  "logo": "https://kakamalem.com/uploads/stores/logo.jpg",
  "url": "https://kakamalem.com/marketplace/stores/afghan-silk-house",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Kabul",
    "addressCountry": "AF"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "128",
    "bestRating": "5"
  },
  "priceRange": "$$",
  "numberOfEmployees": { "@type": "QuantitativeValue", "value": 3 }
}
```

**Marketplace Homepage** — Schema.org `CollectionPage`:

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Browse Stores - Kaka Malem Marketplace",
  "description": "Discover Afghan stores and shops on Kaka Malem",
  "url": "https://kakamalem.com/marketplace"
}
```

### 9.2 Sitemaps

- `/marketplace-sitemap.xml` — all store profile pages + category pages
- Auto-generated, regenerated on store marketplace enable/disable
- Each store profile page gets: `<lastmod>`, `<changefreq>weekly`, `<priority>0.7`

### 9.3 Meta Tags

Each page gets unique:

- `<title>` — e.g., "Afghan Silk House - Marketplace | Kaka Malem"
- `<meta description>` — store tagline or truncated about
- `<og:image>` — store cover image
- `<og:type>` — `profile` for store pages
- Canonical URLs on every page

### 9.4 URL Structure

SEO-friendly, human-readable URLs:

```
/marketplace                              → "Browse Stores on Kaka Malem"
/marketplace/stores/afghan-silk-house     → "Afghan Silk House | Kaka Malem"
/marketplace/categories/clothing          → "Clothing Stores | Kaka Malem"
/marketplace/cities/kabul                 → "Stores in Kabul | Kaka Malem"
```

---

## 10. Analytics & Tracking

### 10.1 Marketplace Funnel

```
Marketplace Homepage Visit
    ↓
Store Card Impression (card enters viewport)
    ↓
Store Card Click (navigates to profile)
    ↓
Store Profile View
    ↓
"Visit Store" Click (navigates to storefront)
    ↓
Browse Products → Add to Cart → Purchase (existing funnel)
```

### 10.2 Key Metrics

**Platform-Level:**

- Total marketplace-enabled stores
- Marketplace DAU / MAU
- Search-to-click conversion rate
- Category distribution of stores
- Top search queries
- Follow rate (follows / profile views)

**Per-Store (visible to store owner):**

- Impressions, clicks, CTR
- Profile views
- Follower count + growth
- Marketplace-referred orders
- Search queries that surfaced their store
- Rank position in default sort

### 10.3 Event Tracking Implementation

Use Intersection Observer for impression tracking:

```typescript
// components/marketplace/marketplace-store-card.tsx
const ref = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        trackMarketplaceEvent("impression", store.id, { source, position });
        observer.disconnect();
      }
    },
    { threshold: 0.5 }
  );
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);
```

Batch events client-side and send via `navigator.sendBeacon()` on page unload for performance.

---

## 11. Monetization Strategy

### 11.1 Immediate (Tied to Pro Subscription)

The marketplace becomes a compelling reason to upgrade to Pro:

| Feature                     | Free Stores     | Pro Stores         |
| --------------------------- | --------------- | ------------------ |
| Listed in marketplace       | Basic card      | Enhanced card      |
| Cover image on card         | No              | Yes                |
| Featured products display   | No              | Up to 4 thumbnails |
| Search ranking boost        | Baseline        | +10% score         |
| "Pro Seller" badge          | No              | Yes                |
| Social links on profile     | No              | Yes                |
| Marketplace analytics       | View count only | Full funnel        |
| Store story / about section | 200 chars       | 2000 chars         |

### 11.2 Future Revenue Streams

- **Promoted placements** (self-serve ad system, pay per click)
- **Marketplace commission** on marketplace-attributed orders
- **Seasonal campaigns** (Eid, Nowruz featured store packages)

---

## 12. Afghan Market Considerations

### 12.1 Cultural Alignment

- **Bazaar metaphor**: The marketplace should feel like walking through a bazaar — you browse shops, not shelves
- **Shopkeeper identity**: Store owner's story and personality matter more than product specs
- **Trust through relationships**: Follow system mirrors real-world "I always buy from that shop"
- **Local pride**: City/province filtering lets users support local businesses
- **Word of mouth**: Share button + "Your friend follows this store" (future)

### 12.2 Technical Constraints

- **Mid-range Android phones**: Use Load More instead of infinite scroll, optimize images
- **Intermittent connectivity**: Cache marketplace data in Service Worker, skeleton loading
- **Bandwidth**: Lazy load images, use WebP, compress cover images server-side
- **Multiple languages**: Use `'simple'` text search dictionary (not language-specific)
- **RTL support**: Ensure marketplace components work in RTL layout (Dari/Pashto)

### 12.3 Market Categories (Seed Data)

| Slug        | English               | Dari (فارسی)       | Icon |
| ----------- | --------------------- | ------------------ | ---- |
| clothing    | Clothing & Fashion    | پوشاک و مد         | 👗   |
| electronics | Electronics           | الکترونیک          | 📱   |
| food        | Food & Groceries      | غذا و مواد غذایی   | 🍎   |
| handmade    | Handmade & Crafts     | صنایع دستی         | 🎨   |
| home        | Home & Garden         | خانه و باغ         | 🏠   |
| beauty      | Beauty & Health       | زیبایی و سلامت     | 💄   |
| jewelry     | Jewelry & Accessories | جواهرات و اکسسوری  | 💍   |
| books       | Books & Stationery    | کتاب و لوازم تحریر | 📚   |
| sports      | Sports & Outdoors     | ورزشی و فضای باز   | ⚽   |
| automotive  | Automotive            | خودرو              | 🚗   |
| kids        | Kids & Baby           | کودک و نوزاد       | 🧸   |
| services    | Services              | خدمات              | 🔧   |

---

## Summary: Priority Order

| Phase       | Scope                                                | Priority           | Dependencies |
| ----------- | ---------------------------------------------------- | ------------------ | ------------ |
| **Phase 1** | Store-first core (schema, cards, profile, settings)  | **P0 — Build Now** | None         |
| **Phase 2** | Discovery & engagement (follows, search, categories) | **P0 — Build Now** | Phase 1      |
| **Phase 3** | Trust & ranking (verification, scores, badges)       | **P1 — Next**      | Phase 1      |
| **Phase 4** | Analytics & tracking (events, dashboards)            | **P2 — Soon**      | Phase 1-2    |
| **Phase 5** | Monetization (premium cards, promoted placements)    | **P3 — Future**    | Phase 1-3    |
