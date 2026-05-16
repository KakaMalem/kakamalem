# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kaka Malem** is a UK-based, Afghanistan-operated crypto-native escrow marketplace for cross-border trade. It connects Western buyers with white-label sellers (dropshippers sourcing from Chinese factories) via trustless crypto escrow.

**Business model:** No subscriptions. No upfront fees. Sellers list for free. Kaka Malem takes a **5% fee on escrow release** — deducted automatically when funds are released to the seller. Buyers pay nothing extra.

**How it works:**

1. Seller creates a storefront, lists white-label products
2. Buyer pays crypto (USDT/USDC) → funds held in Kaka Malem escrow
3. Seller ships, uploads tracking number
4. Buyer confirms delivery → funds released to seller minus 5% fee
5. If no confirmation after 30 days → auto-release to seller
6. If dispute → admin resolves, funds go to winner

**Supported payment currency:** USDT on TRC20 only. Auto-detected via TronGrid.

**Key architecture notes:**

- Platform is in transition from Afghan-market SaaS to global escrow marketplace
- The escrow system (`lib/escrow/`) is the new core of the platform — **this is what to build**
- Fiat payment options (COD, bank transfer, mobile money) are removed from new storefront checkout
- POS/offline sales are deprecated for new stores
- Subscription billing (free/pro trial model) is replaced with per-transaction fees

**Legacy infrastructure — DO NOT REMOVE:**
Stripe and HesabPay integrations remain in the codebase for one existing client on the old Afghan-market SaaS model. They must not be deleted or broken. New features are built for the escrow model only. If you are working on something related to the new escrow marketplace, do not touch `lib/stripe/`, `lib/payments/hesabpay/`, or `app/api/webhooks/stripe/` and `app/api/webhooks/hesabpay/`.

## Development Commands

```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

Database commands (Drizzle):

```bash
pnpm db:generate       # Generate migration files from schema changes
pnpm db:migrate        # Apply migrations from drizzle/ folder
pnpm db:migrate:custom # Apply custom SQL (triggers, functions) from drizzle/custom/
pnpm db:studio         # Open Drizzle Studio GUI
pnpm db:push           # Push schema directly (DEV ONLY - can cause data loss!)
```

## Database Migration Workflow

**IMPORTANT: Always use migrations, never use `db:push` in production!**

### Making Schema Changes

1. **Edit the schema** in `lib/db/schema.ts`
2. **Generate migration**:
   ```bash
   pnpm db:generate
   ```
3. **Review the generated SQL** in `drizzle/XXXX_*.sql`
4. **Commit the migration**:
   ```bash
   git add drizzle/
   git commit -m "migration: description of changes"
   ```
5. **Push to deploy** - migrations run automatically via `deploy.sh`

### Why NOT to use db:push

- No migration history (can't rollback)
- No team collaboration (no files to review)
- Can accidentally drop columns/data

### Custom SQL Migrations (Triggers, Functions)

Drizzle-kit doesn't manage triggers, functions, or other custom SQL. Use the custom migration system:

1. **Create SQL file** in `drizzle/custom/` with numbered prefix (e.g., `0001_my_trigger.sql`)
2. **Run migrations**:
   ```bash
   pnpm db:migrate:custom
   ```
3. **Tracks applied migrations** in `custom_migrations` table (safe to re-run)

Add shadcn/ui components:

```bash
pnpm dlx shadcn-ui@latest add [component-name]
```

## Deployment

Deployment is managed by **Dokploy** on the production VPS. Dokploy is configured with a Git source pointed at this repo; pushing to `main` triggers a webhook that clones the repo on the VPS and runs `docker build` against the [Dockerfile](Dockerfile).

**To deploy**: `git push origin main` — Dokploy handles the rest.

**Environment variables**: managed in the Dokploy UI per application (not in `.env*` files in the repo).

**Routing & SSL**: Dokploy provisions Traefik for HTTPS termination and custom domain SSL via Let's Encrypt. The main domain and per-tenant custom domains (e.g., `shop.mybrand.com`) are configured in the Dokploy "Domains" tab for the application.

**Migrations**: run via the Dokploy UI's terminal inside the container (`pnpm db:migrate`, `pnpm db:migrate:custom`), or locally with `DATABASE_URL_UNPOOLED` pointed at the production database.

### Key Infrastructure Files

```
Dockerfile              # Multi-stage build for Next.js (Dokploy builds this)
.dockerignore           # Exclude files from Docker context

scripts/
├── backup-database.sh        # Postgres backup (run manually or via cron on the DB host)
├── cleanup-temp-uploads.ts   # Periodic cleanup of stale upload temp files
├── generate-icons.mjs        # Generate PWA icons from a source image
└── migrate-custom.ts         # Apply custom SQL migrations from drizzle/custom/

.github/workflows/
└── ci.yml                    # Lint, type check, build (independent of deploy)
```

### Database Backups

The [scripts/backup-database.sh](scripts/backup-database.sh) script handles `pg_dump`-based backups with rotation. Run manually or wire it up via cron on whichever host runs Postgres (Dokploy-managed container, separate VPS, or managed service — depends on your setup).

### Health Check Endpoint

`GET /api/health` returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latency": 5 }
  }
}
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (RSC by default)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 with CSS variables in OKLCH color space
- **State Management**: Zustand (for client-side state like cart)
- **Data Fetching**: React Query (for client-side data fetching/caching)
- **Database**: PostgreSQL 18 with PgBouncer + Drizzle ORM
- **Authentication**: Better Auth (email/password, Google OAuth, Facebook OAuth)
- **File Storage**: Local NVMe storage (served via Next.js API route)
- **UI Components**: shadcn/ui (new-york style)
- **Validation**: Zod
- **Notifications**: Novu (in-app + push notifications)
- **Offline/PWA**: Dexie.js (IndexedDB) + Serwist (Service Worker)
- **Payments**: USDT/USDC crypto escrow (new model) — Stripe/HesabPay retained for legacy client only
- **Custom Domains**: Traefik via Dokploy (automatic SSL via Let's Encrypt)
- **Package Manager**: pnpm
- **Deployment**: Dokploy (Git auto-deploy, builds Dockerfile on VPS)

## Architecture

### Multitenancy Model

Path-based routing following [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant):

- **Public storefronts**: `kakamalem.com/store/[slug]` (seller storefronts)
- **Seller dashboard**: `kakamalem.com/dashboard`
- **All tenant data isolated** via `tenant_id` foreign key + application-level checks
- **Tenant-isolated carts**: Each shop has separate carts (no cross-shop cart)

**Tenant = Seller.** Each seller gets their own storefront, product catalog, and order/escrow dashboard. Buyers shop across seller storefronts but all payments go through Kaka Malem's central escrow system.

### App Router Structure

```
app/
├── layout.tsx              # Root layout (Geist fonts, metadata)
├── page.tsx                # Landing page
├── globals.css             # Tailwind + CSS theme variables
├── (auth)/                 # Route group: platform auth
│   ├── login/              # Email/password + OAuth login
│   ├── signup/             # User registration
│   ├── confirm/            # Email confirmation page
│   ├── error/              # Auth error page
│   └── logout/             # Logout handler
├── admin/                  # Platform admin panel (/admin)
│   ├── page.tsx            # Admin dashboard
│   ├── stores/             # Store management
│   └── settings/           # Platform settings
├── dashboard/              # Store owner dashboard (protected)
│   ├── page.tsx            # Store selector
│   ├── new/                # Create new store
│   ├── account/            # User account settings
│   └── [slug]/             # Per-store dashboard
│       ├── page.tsx        # Store dashboard home
│       ├── products/       # Product management
│       ├── categories/     # Category management
│       ├── orders/         # Order management
│       ├── offline-sales/  # POS/offline sales
│       ├── inventory/      # Stock management
│       ├── analytics/      # Store analytics
│       ├── shipping/       # Shipping methods
│       ├── customers/      # Customer groups
│       ├── variants/       # Variant options (Size, Color, etc.)
│       ├── media/          # Media library
│       ├── settings/       # Store settings
│       └── billing/        # Subscription management
├── store/[slug]/           # Public storefront for each tenant
│   ├── (auth)/             # Store-specific customer auth
│   │   └── auth/           # Login, signup, forgot-password
│   └── (storefront)/       # Public pages
│       ├── page.tsx        # Store homepage
│       ├── products/       # Product listing
│       ├── product/[slug]/ # Product detail
│       ├── category/[slug]/# Category view
│       ├── cart/           # Shopping cart
│       ├── checkout/       # Checkout flow
│       └── account/        # Customer account (orders, addresses, wishlist)
├── privacy/                # Privacy policy
├── terms/                  # Terms of service
└── data-deletion/          # Data deletion request (Facebook requirement)
```

### Admin Panel (/admin)

Platform administration accessible only to `platform_admin` or `super_admin` users.

- **Dashboard**: Platform stats, revenue from fees, active escrows
- **Stores**: List, search, filter, suspend/activate seller stores
- **Payments**: Crypto payment verification, manual approval
- **Disputes**: Dispute queue — view evidence, message parties, resolve (refund buyer or release to seller)
- **Payouts**: Seller withdrawal requests — mark processing, complete with tx hash, or reject with reason
- **Settings**: Platform fee %, escrow auto-release timeout, wallet addresses

### Key Directories

```
lib/
├── db/
│   ├── index.ts            # Drizzle client
│   ├── schema.ts           # Database schema (see below)
│   └── queries/            # Reusable query functions (20+ files)
├── auth/
│   ├── index.ts            # Better Auth configuration
│   ├── client.ts           # Client-side auth hooks
│   └── server.ts           # Server-side auth helpers
├── storage/
│   └── index.ts            # Local file storage utilities
├── actions/                # Server actions for data mutations (22+ files)
├── stores/                 # Zustand stores for client state
├── validations/            # Zod schemas for forms
└── utils.ts                # cn() helper for Tailwind classes

components/
├── ui/                     # shadcn/ui components
├── auth/                   # Auth-related components
├── dashboard/              # Dashboard page components
└── store/                  # Storefront components

database/                   # PostgreSQL configuration files
├── postgresql.conf         # Optimized PostgreSQL 18 config
├── pg_hba.conf            # Client authentication config
└── pgbouncer.ini          # Connection pooling config
```

### Client-Side State (Zustand)

Location: `lib/stores/`

| Store                          | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `use-cart-store.ts`            | Shopping cart state per tenant          |
| `use-checkout-store.ts`        | Checkout flow state (address, shipping) |
| `use-tenant-settings-store.ts` | Cached tenant settings for storefront   |

### Path Alias

`@/*` maps to project root. Use: `@/lib/utils`, `@/components/ui/button`

## Database Schema

### Core Tables

| Table            | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `profiles`       | User profiles linked to Better Auth (id = user.id)          |
| `tenants`        | Stores/storefronts with branding, billing status, analytics |
| `tenant_members` | Staff/collaborators per store (owner, admin, staff roles)   |
| `categories`     | Product categories per tenant (image, displayOrder)         |
| `products`       | Products with optional variants support                     |
| `media`          | Centralized media library (tenant-isolated)                 |
| `product_images` | Junction: products <-> media                                |

### Inventory & Variants

| Table                     | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `variant_options`         | Option types per tenant (Size, Color, Material)   |
| `variant_option_values`   | Values per option (S, M, L, XL for Size)          |
| `product_variants`        | SKUs with own price/stock (Blue T-Shirt - Size M) |
| `product_variant_options` | Junction: variants <-> option values              |
| `inventory_movements`     | Audit log for all stock changes                   |

### Orders & Shipping

| Table                                    | Purpose                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| `carts` / `cart_items`                   | Shopping carts (session or customer based)                   |
| `orders` / `order_items`                 | Orders with address, financial breakdown                     |
| `offline_orders` / `offline_order_items` | POS/in-store sales (no shipping required)                    |
| `shipping_zones`                         | Geographic regions (countries, states, cities, postal codes) |
| `shipping_methods`                       | Delivery options per zone (flat, weight-based, price-based)  |
| `delivery_zones`                         | Local delivery areas with polygon/radius boundaries          |
| `shipments`                              | Physical shipments with tracking                             |
| `shipment_items`                         | Which items in each shipment (split shipment support)        |
| `shipment_tracking_events`               | Tracking history                                             |

### Customers & Pricing

| Table                          | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `customer_groups`              | Customer segments per tenant (VIP, Wholesale, etc.) |
| `customer_group_members`       | Junction: customers <-> groups                      |
| `price_tiers`                  | Quantity-based pricing (buy 10+ get discount)       |
| `group_pricing`                | Special prices per customer group                   |
| `scheduled_sales`              | Time-limited discounts (start/end date)             |
| `wishlists` / `wishlist_items` | Customer wishlists per tenant                       |

### Reviews & Billing

| Table                     | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `reviews`                 | Product reviews (1-5 stars, owner replies, verified purchase) |
| `review_media`            | Customer-uploaded review images                               |
| `commission_transactions` | Platform commission audit log                                 |

### Payments

| Table                     | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `payment_gateway_configs` | Gateway credentials per tenant (legacy stores only — settings page hidden) |
| `payment_sessions`        | Track payment attempts and redirects                                       |
| `payment_webhook_events`  | Audit log for gateway webhooks                                             |
| `order_transactions`      | Financial transaction ledger                                               |

### Analytics (System-Managed)

| Table                            | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `analytics_daily_snapshots`      | Daily aggregated metrics                    |
| `analytics_hourly_metrics`       | Real-time dashboard data                    |
| `analytics_product_performance`  | Per-product daily metrics                   |
| `analytics_category_performance` | Per-category daily metrics                  |
| `analytics_traffic_sources`      | UTM/referrer tracking                       |
| `analytics_geographic_sales`     | Sales by location                           |
| `analytics_page_views`           | Raw page view events                        |
| `analytics_conversion_events`    | Funnel events (add_to_cart, checkout, etc.) |

## Analytics Dashboard

The analytics dashboard at `/dashboard/[slug]/analytics` provides store owners with performance insights.

### Available Features

| Feature                 | Component                   | Data Source                          |
| ----------------------- | --------------------------- | ------------------------------------ |
| Revenue & Orders Charts | `RevenueTrendChart`         | Orders table aggregation             |
| KPI Cards               | `EnhancedAnalyticsKPICards` | `getEnhancedKPIs()`                  |
| Top Products            | `AnalyticsTopProducts`      | Order items aggregation              |
| Customer Split          | `CustomerSplitCard`         | New vs returning customers           |
| Category Distribution   | `CategoryDistributionChart` | `/api/analytics/categories`          |
| Sales Heatmap           | `SalesHeatmap`              | `/api/analytics/heatmap`             |
| Product Performance     | `ProductPerformanceTable`   | `/api/analytics/products`            |
| Real-time Metrics       | `RealTimeIndicator`         | `/api/analytics/realtime` (30s poll) |
| Geographic Sales        | -                           | `/api/analytics/geographic`          |

### Query Functions

Location: `lib/db/queries/analytics.ts`

| Function                   | Returns                                          |
| -------------------------- | ------------------------------------------------ |
| `getAnalyticsData()`       | KPIs, daily data, top products                   |
| `getEnhancedKPIs()`        | Extended KPIs (items per order, etc.)            |
| `getCategoryPerformance()` | Revenue/orders by category                       |
| `getSalesHeatmap()`        | Order count by hour × day-of-week (168 points)   |
| `getProductPerformance()`  | Paginated product metrics                        |
| `getConversionFunnel()`    | Purchase funnel (partial - needs event tracking) |
| `getGeographicSales()`     | Sales by country/state/city                      |
| `getTrafficSources()`      | Placeholder (needs UTM tracking)                 |

### Time Range Options

- `today`, `yesterday`, `7d`, `30d`, `90d`
- `this_month`, `last_month`, `this_year`
- `custom` (with start/end dates)

### Not Yet Implemented

These features require analytics event tracking to be implemented:

- Full conversion funnel (product_view → add_to_cart → checkout_start → purchase)
- Traffic sources (UTM parameter capture)
- Cart abandonment rate
- Product page views

### Enums

- **User roles** (`profiles.role`): `admin`, `owner`, `staff`, `customer`
- **Tenant member roles**: `owner`, `admin`, `staff`
- **Tenant status**: `pending_review`, `active`, `suspended`, `inactive`
- **Subscription plan**: `free`, `pro`
- **Subscription status**: `trialing`, `active`, `past_due`, `cancelled`, `expired`
- **Order status**: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`, `partially_refunded`
- **Payment status**: `unpaid`, `partial`, `paid`, `refunded`, `partial_refund`
- **Payment method**: `cash`, `card`, `bank_transfer`, `mobile_money`, `store_credit`
- **Payment gateway**: `hesabpay`, `stripe`, `cod`, `bank_transfer`, `mobile_money`
- **Payment session status**: `pending`, `processing`, `completed`, `failed`, `expired`, `cancelled`
- **Escrow status**: `pending`, `funded`, `in_transit`, `delivered`, `released`, `disputed`, `resolved_buyer`, `resolved_seller`, `expired`
- **Escrow currency**: `usdt`, `usdc`
- **Dispute status**: `open`, `resolved_buyer`, `resolved_seller`
- **Dispute party**: `buyer`, `seller`, `admin`
- **Stock status**: `in_stock`, `low_stock`, `out_of_stock`, `on_backorder`
- **Shipment status**: `pending`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed`, `returned`
- **Store mode**: `full`, `online_only`, `offline_only`, `catalog`

### Store Modes

| Mode           | Online Cart | Checkout | POS/Offline | Use Case                        |
| -------------- | ----------- | -------- | ----------- | ------------------------------- |
| `full`         | Yes         | Yes      | Yes         | Omnichannel (default)           |
| `online_only`  | Yes         | Yes      | No          | E-commerce only                 |
| `offline_only` | No          | No       | Yes         | Physical store, POS only        |
| `catalog`      | No          | No       | No          | Showcase products, contact only |

When `store_mode` is `catalog` or `offline_only`, the storefront disables the cart drawer and shows appropriate CTAs (contact info or "visit in-store").

### Platform Fee Model

No subscriptions. Revenue comes from a **5% fee on every escrow release**.

- Fee is deducted automatically when escrow is released to the seller
- Fee % is configurable in admin settings (default: 5%)
- Fee is snapshotted on the `escrow_transactions` record at payment time — changes to the fee % do not affect existing escrows
- Buyers see the full product price — sellers account for the fee in their margin
- No listing fees, no monthly fees, no transaction fees on disputes

> **Legacy:** The subscription billing schema (`tenants.subscriptionStatus`, `tenants.subscriptionPlan`, trial logic) remains in the database and code for the one existing client using the old Afghan-market SaaS model. Do not remove it. New stores on the escrow model bypass this entirely.

## Authorization

### Role Hierarchy

- **Owner** > **Admin** > **Staff** (per-tenant via `tenant_members`)
- Platform admin role via `user_profiles.platform_role = 'platform_admin'` or `'super_admin'`

### Authorization Model

Authorization is enforced at the **application level** (not database RLS):

- All queries filter by `tenant_id` for tenant isolation
- Server actions check permissions via `lib/auth/context.ts` helpers:
  - `getUserStoreContext(tenantId)` - Get user's relationship to a store
  - `canManageStore(tenantId)` - Check if user can manage store
  - `hasMinimumRole(tenantId, role)` - Check role hierarchy
- Platform admin access checked via `isPlatformAdmin()` in `lib/auth/server.ts`

### Auto Profile Creation

Better Auth creates `user_profiles` automatically via database hooks when users sign up.

## Validation Patterns

### Zod Schemas

Location: `lib/validations/`

```typescript
// Example: lib/validations/auth.ts
export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

### Form Validation Pattern

```typescript
// Client-side
const [errors, setErrors] = useState<Partial<Record<keyof InputType, string>>>(
  {}
);

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setErrors({});

  const result = schema.safeParse(formData);
  if (!result.success) {
    const fieldErrors: typeof errors = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as keyof InputType;
      fieldErrors[field] = issue.message;
    });
    setErrors(fieldErrors);
    return;
  }

  // Submit to server action
};
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## Styling Guidelines

- **Mobile-first**: Always write mobile styles first, use responsive prefixes for larger screens
- **No dark mode**: Do not use `dark:` variants
- Use `cn()` helper for conditional classes:
  ```typescript
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", condition && "conditional-class")} />;
  ```
- Theme colors in `globals.css` as CSS variables (OKLCH color space)
- shadcn/ui components use CSS variables for theming

## Authentication Flow

Using Better Auth (https://www.better-auth.com) - a self-hosted, PostgreSQL-backed auth solution.

### Email/Password

1. User submits form → client-side Zod validation
2. Better Auth handles signup/signin via `/api/auth/[...all]` route
3. For signup: email confirmation sent → user clicks link → verified
4. Session stored in cookies (HTTP-only, secure)

### OAuth (Google/Facebook)

1. User clicks OAuth button → redirects to provider
2. Provider redirects back to `/api/auth/callback/{provider}`
3. Better Auth exchanges code for session
4. Redirect to `/dashboard`

### Auth Helpers

```typescript
// lib/auth/server.ts - Server-side
import { auth } from "@/lib/auth";
const session = await auth.api.getSession({ headers: await headers() });

// Additional server helpers:
// - getUser() - Get current user (cached)
// - getUserProfile() - Get user's extended profile
// - requireAuth() - Require auth (throws if not authenticated)
// - isPlatformAdmin() - Check if user is platform/super admin
// - requirePlatformAdmin() - Require admin access (throws if not)
// - getPortalAccess() - Get all user's portal access (seller, staff, affiliate, delivery)
// - hasStoreAccess(tenantId) - Check store access with role

// lib/auth/context.ts - Store context helpers
// - getUserStoreContext(tenantId) - Get user's relationship to a store
// - canManageStore(tenantId) - Check if user can manage store
// - hasMinimumRole(tenantId, role) - Check role hierarchy
// - getUserAddresses() - Get user's saved addresses

// lib/auth/client.ts - Client-side
import { authClient } from "@/lib/auth/client";
const { data: session } = authClient.useSession();
```

## Environment Variables

### Production (`.env`)

```bash
# PostgreSQL 18 via PgBouncer (pooled for app runtime)
DATABASE_URL="postgresql://kakamalem_app:password@localhost:6543/kakamalem"

# PostgreSQL 18 direct (for drizzle-kit migrations)
DATABASE_URL_UNPOOLED="postgresql://kakamalem_migrations:password@localhost:5432/kakamalem"

# Better Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET="your-secret-key"

# App URL for auth redirects
NEXT_PUBLIC_APP_URL="https://kakamalem.com"

# Local file storage path
STORAGE_PATH="/var/www/kakamalem-uploads"
```

### Local Development (`.env.local`)

```bash
# Local PostgreSQL (no pooling needed)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kakamalem"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/kakamalem"

# Better Auth
BETTER_AUTH_SECRET="dev-secret-at-least-32-characters-long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Local storage path (Windows example)
STORAGE_PATH="C:/Users/YourName/kakamalem-uploads"
```

**Note:** `.env.local` takes precedence over `.env` in Next.js. Delete or rename `.env.local` to use production environment.

## Escrow System

The escrow system is the core product. All buyer payments are held in escrow until delivery is confirmed or a dispute is resolved.

### Escrow Flow

```
Buyer pays crypto → Kaka Malem escrow wallet (custodial)
  → Seller ships → uploads tracking number
    → Buyer confirms delivery → funds released to seller (minus 5% fee)
    → OR: 30 days after in_transit with no buyer action → auto-release to seller
    → OR: Buyer opens dispute → funds frozen → admin resolves → release or refund
```

### Escrow Status Enum

```
pending          → Order placed, awaiting buyer payment
funded           → Crypto received and confirmed in escrow wallet
in_transit       → Seller uploaded tracking, marked as shipped
delivered        → Buyer confirmed receipt
released         → Funds sent to seller wallet (minus platform fee)
disputed         → Dispute opened, funds frozen pending admin decision
resolved_buyer   → Admin ruled for buyer — full refund sent to buyer
resolved_seller  → Admin ruled for seller — funds released to seller
expired          → Auto-released to seller after 30-day timeout
```

### Key Files

```
lib/escrow/
├── index.ts         # Core: createEscrow(), fundEscrow(), markShipped(), confirmDeliveryAndRelease(),
│                    #   openDispute(), resolveDispute(), processAutoReleases()
└── types.ts         # EscrowStatus enum, input types, result types

lib/actions/escrow.ts    # Server actions: createOrderEscrow, confirmEscrowPayment, sellerMarkShipped,
                         #   buyerConfirmDelivery, openEscrowDispute, adminResolveDispute, addDisputeMessage

app/api/cron/
├── escrow-auto-release/ # Cron: auto-releases in_transit escrows past 30-day deadline
└── mature-earnings/     # Cron: moves pending seller earnings to available after 7-day hold

app/admin/disputes/      # Admin dispute queue — review, message, resolve
app/admin/payouts/       # Admin seller payout processing — approve, complete, reject
```

### Database Tables

| Table                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `escrow_transactions` | Per-order escrow record (amount, currency, network, status, fee) |
| `disputes`            | Dispute records (reason, status, resolution, resolver)           |
| `dispute_messages`    | Threaded evidence/messages per dispute (buyer, seller, admin)    |

### Seller Earnings Integration

When escrow releases (buyer confirms, admin resolves for seller, or 30-day auto-release), `creditSellerEarnings()` is called automatically. Funds go to the seller's `pending` balance, then mature to `available` after 7 days (configurable via `payoutHoldDays`). Sellers request payouts from their earnings dashboard; admins process them manually at `/admin/payouts`.

- Withdrawal fee: **$0.50 USDT** (covers TRC20 gas)
- No minimum withdrawal
- Race condition protected via `SELECT ... FOR UPDATE` row locking
- Database `CHECK` constraints prevent negative balances

### Platform Fee

- Default: **5%** — configurable in admin settings
- Deducted on `release()` — seller receives `amount * (1 - feePercent)`
- Fee % snapshotted on `escrow_transactions.platformFeePercent` at payment time
- Platform fee sent to a configurable platform wallet address

---

## Payment System

**USDT on TRC20 only for new storefront checkout. No new fiat integrations.**

| Currency | Network | Status |
| -------- | ------- | ------ |
| USDT     | TRC20   | Live   |

TRC20 was chosen for lowest fees (~$0.30), fastest confirmation (~3s), and auto-detection support via TronGrid API (free, no API key). ERC20/BEP20 were removed from checkout — only TRC20 is offered to buyers. The platform operates a custodial wallet model: all USDT sits in the platform wallet, seller balances are internal bookkeeping, and on-chain transfers only happen on buyer deposit and seller withdrawal.

> **Legacy payment infrastructure** (Stripe, HesabPay, COD, bank transfer, mobile money) remains intact in `lib/payments/` and `lib/stripe/` for the one existing client. Do not remove or modify.

### Payment Architecture

```
lib/payments/
├── index.ts              # Payment orchestrator
├── types.ts              # Common gateway types
├── hesabpay/
│   ├── index.ts          # HesabPay exports
│   ├── client.ts         # HesabPay API client
│   └── types.ts          # HesabPay-specific types
└── stripe/
    └── index.ts          # Stripe payment provider

lib/stripe/
├── index.ts              # Stripe server client
├── client.ts             # Stripe browser client (@stripe/stripe-js)
└── subscriptions.ts      # Pro subscription management

lib/actions/payments.ts   # Server actions for payments
lib/actions/stripe-subscriptions.ts  # Subscription server actions
app/api/webhooks/hesabpay/route.ts   # HesabPay webhook handler
app/api/webhooks/stripe/route.ts     # Stripe webhook handler
```

### Supported Payment Gateways

| Gateway         | Type    | Use Case                               |
| --------------- | ------- | -------------------------------------- |
| `hesabpay`      | Online  | Card payments (Afghanistan primary)    |
| `stripe`        | Online  | International payments + subscriptions |
| `cod`           | Offline | Cash on Delivery                       |
| `bank_transfer` | Manual  | Bank transfer with verification        |
| `mobile_money`  | Manual  | M-Paisa, M-Hawala                      |

### Multi-Currency Support

International customers can view prices and pay in their preferred currency:

```
lib/currency/
├── index.ts              # Exchange rate service (caching, conversion)
└── country-currency.ts   # Country → currency mapping

lib/stores/use-currency-store.ts    # Client-side currency state (Zustand)
components/store/currency-selector.tsx  # Currency dropdown
components/store/price-display.tsx      # Auto-converting price display
app/api/exchange-rates/route.ts         # Exchange rate API endpoint
```

**Features:**

- Auto-detect currency based on IP/browser locale
- Real-time exchange rates (cached, updated daily)
- Prices displayed in customer's currency
- Payments processed in customer's currency via Stripe

**Exchange Rate Source:** [Fawaz Ahmed Currency API](https://github.com/fawazahmed0/exchange-api) (free, supports AFN)

### Database Tables

| Table                     | Purpose                              |
| ------------------------- | ------------------------------------ |
| `payment_gateway_configs` | Store gateway credentials per tenant |
| `payment_sessions`        | Track payment attempts               |
| `payment_webhook_events`  | Audit log for webhooks               |
| `order_transactions`      | Financial transaction ledger         |
| `exchange_rates`          | Cached exchange rates for AFN        |

### Configuration

Gateway credentials are stored per-tenant in `payment_gateway_configs`:

```typescript
// Enable HesabPay for a store
await savePaymentGatewayConfig(tenantId, "hesabpay", {
  displayName: "Pay with Card",
  apiKey: "hpay_live_xxx",
  merchantPin: "1234",
  webhookSecret: "whsec_xxx",
  isLive: true,
  isEnabled: true,
});
```

### Payment Flow

1. Customer selects payment method at checkout
2. `createOrderPaymentSession()` creates session with gateway
3. Customer redirected to gateway (HesabPay) or confirmation page (COD)
4. Webhook receives payment confirmation
5. Order marked as paid, inventory updated

### Webhook Setup

HesabPay webhook URL: `https://kakamalem.com/api/webhooks/hesabpay?tenantId={tenantId}`

Events handled:

- `payment.completed` - Mark order as paid
- `payment.failed` - Update session status
- `payment.cancelled` - Update session status
- `refund.completed` - Process refund

## Offline/PWA Support

The POS system supports offline operation via Progressive Web App (PWA) technology:

- **Service Worker**: Serwist for caching and offline support
- **IndexedDB**: Dexie.js for local data storage
- **Offline Sales**: POS can process sales offline, synced when back online
- **Background Sync**: Queued operations synced automatically

Key files:

- `lib/offline/` - Dexie database and sync logic
- `app/sw.ts` - Service worker configuration
- See [docs/OFFLINE_SYNC_ROADMAP.md](docs/OFFLINE_SYNC_ROADMAP.md) for architecture

## Notifications

Using Novu for multi-channel notifications:

- **In-App**: Real-time notifications in dashboard
- **Email**: Order confirmations, shipping updates
- **Push**: Browser push notifications (optional)

Key files:

- `lib/notifications/` - Novu client and helpers
- Configured via `NOVU_API_KEY` environment variable

## SEO

Dynamic SEO configuration per store:

- **Sitemaps**: Auto-generated at `/sitemap.xml` (dynamic per store)
- **Robots.txt**: Dynamic at `/robots.txt`
- **Meta Tags**: Per-page via Next.js `generateMetadata`
- **Structured Data**: JSON-LD for products and organization

## Development Notes

- **No test framework** configured yet
- **ESLint 9+** flat config in `eslint.config.mjs`
- **React Server Components** enabled by default
- **Rich text editor**: TipTap (used for product descriptions)
- Components in `components/ui/` are shadcn/ui (don't modify directly unless necessary)
- For new features, create server actions in appropriate `lib/` subdirectory

### Custom Domains

Tenants connect a custom domain (e.g. `shop.mybrand.com`) to their store. The system has three layers:

1. **DNS verification** ([lib/services/domain-verification.ts](lib/services/domain-verification.ts)) — generates a verification token, asks the tenant to add CNAME/TXT records at their registrar, then verifies via Google DNS-over-HTTPS.
2. **Provisioner** ([lib/domains/](lib/domains/)) — an abstraction over the upstream proxy that owns TLS termination. Implementations:
   - `DokployProvisioner` (production) — calls Dokploy's REST API to register/unregister hostnames; Dokploy updates Traefik routing and Traefik issues Let's Encrypt certs.
   - `NullProvisioner` (local dev) — no-ops every call so the flow can be exercised without a Dokploy instance.

   Selected via `DOMAIN_PROVISIONER=dokploy|null`. Dokploy mode requires `DOKPLOY_API_URL`, `DOKPLOY_API_KEY`, and `DOKPLOY_APPLICATION_ID`.

   **`DOKPLOY_API_URL` must be the Docker-internal address** (e.g. `http://dokploy:3000`), not the public hostname. Public hostnames resolve to the VPS's public IP, which the container can't loop back to (hairpin NAT) — fetch fails silently with no response.

3. **Routing** ([proxy.ts](proxy.ts)) — rewrites incoming custom-domain requests to `/store/custom-domain/...` and exposes the original host via the `x-custom-domain` header. `getTenantByCustomDomain()` resolves the host to a tenant.

#### Domain lifecycle

```
[connect]  → pending → dns_verification → ssl_provisioning → active
                              ↓                  ↓
                            error              error
```

`verifyDomain()` ([lib/actions/domains.ts](lib/actions/domains.ts)) drives the happy path: verifies DNS, persists `ssl_provisioning`, registers with the provisioner, then flips to `active`. Provisioner failures land the domain in `error` with a human-readable message in `tenants.domainError`.

`disconnectDomain()` calls `provisioner.unregister(host)` (best-effort) before clearing the DB columns.

#### Crons

| Route                            | What it does                                                                                                                         | Recommended cadence |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `GET /api/cron/domain-health`    | Re-checks DNS for pending domains, then probes HTTPS for active ones and downgrades `sslStatus` if the cert is invalid.              | every 5–10 min      |
| `GET /api/cron/domain-reconcile` | Diffs `active` domains in DB vs the provisioner's list; re-registers missing ones and logs orphans. Safety net for partial failures. | daily               |

Both require `Authorization: Bearer $CRON_SECRET`. **Note:** as of this writing the production cron scheduling has not been configured under Dokploy — wire these up via Dokploy's scheduled-jobs feature or an external cron hitting the URLs.

### Next.js 16 Proxy (NOT middleware.ts)

**IMPORTANT:** Next.js 16 uses `proxy.ts` at the project root instead of `middleware.ts`. Do NOT create a middleware.ts file.

The `proxy.ts` file handles:

1. **SEO redirects** - www → non-www canonical redirect
2. **Custom domain routing** - Rewrites custom domains to `/store/custom-domain/` route

```typescript
// proxy.ts - NOT middleware.ts
export function proxy(request: NextRequest) {
  // www redirect for SEO
  if (hostname === "www.kakamalem.com") {
    return NextResponse.redirect(url, { status: 301 });
  }

  // Custom domain rewrite
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## Common Patterns

### Server Component Data Fetching

```typescript
// app/store/[slug]/page.tsx
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  // ...
}
```

### Client Component with Server Action

```typescript
"use client";

import { serverAction } from "@/lib/actions";

export function MyForm() {
  const handleSubmit = async (formData: FormData) => {
    const result = await serverAction(formData);
    // handle result
  };
  // ...
}
```

### Tenant-Scoped Queries

Always filter by `tenant_id`:

```typescript
const products = await db.query.products.findMany({
  where: eq(products.tenantId, tenantId),
});
```
