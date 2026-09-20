# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kaka Malem** is an Afghan-market SaaS storefront builder. Sellers create a store, list products, and accept online card payments via HesabPay or cash on delivery. Multi-tenant: each seller gets their own subdomain or custom domain.

**Business model:** Free tier (limited products), Pro plan via subscription (monthly or yearly, billed via HesabPay). The platform makes money on Pro subscriptions, not on per-transaction fees.

**How it works:**

1. Seller signs up, gets a free trial of Pro
2. Seller creates a storefront, lists products, picks payment methods (HesabPay, COD)
3. Customers shop on the storefront, check out via HesabPay's hosted checkout or place a COD order
4. Seller fulfills orders, manages inventory, runs analytics
5. To stay on Pro after trial: seller pays a monthly or yearly invoice via HesabPay

**Supported payment methods:**

- **HesabPay** — hosted checkout for online card payments (Afghanistan domestic + international when wired)
- **Cash on Delivery** — customer pays the courier on arrival

**Key architecture notes:**

- Multi-tenant SaaS: each seller is a `tenant` row; data is isolated by `tenantId` foreign keys + application-level checks
- HesabPay platform credentials live in env (`HESABPAY_API_KEY`), not per-tenant
- Pro subscription billing uses one-time HesabPay invoices (not recurring) — invoice generated each cycle, customer pays via hosted checkout, webhook activates the period
- Reminders go out 7 days before due date; **no automatic downgrade yet** — handle expired subscriptions manually for now
- Custom domain support via Dokploy/Traefik (each tenant can connect their own domain)
- Offline POS, gateway config UI, custom domain config, and the Pro upgrade button were temporarily commented out during a crypto-marketplace pivot — they need to be re-enabled as part of the next phase

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
- **Payments**: HesabPay (hosted checkout) + COD
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

**Tenant = Seller.** Each seller gets their own storefront, product catalog, and order dashboard. Each store configures its own payment methods (HesabPay, COD).

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

- **Dashboard**: Platform stats, active Pro stores, revenue from subscriptions
- **Stores**: List, search, filter, suspend/activate seller stores
- **Payments**: Platform billing — subscription invoices, transactions, revenue stats
- **Affiliates**: Affiliate program management
- **Settings**: Pro plan pricing (AFN monthly/yearly), free tier limits, trial duration

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

| Table                     | Purpose                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `payment_gateway_configs` | Per-tenant gateway display name + enabled/order, written from Settings → Payments. Its credential columns are legacy: HesabPay uses platform env credentials |
| `payment_sessions`        | Track payment attempts and redirects                                                                                                                         |
| `payment_webhook_events`  | Audit log for gateway webhooks                                                                                                                               |
| `order_transactions`      | Financial transaction ledger                                                                                                                                 |

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
- **Payment gateway**: `hesabpay`, `cod`, `bank_transfer`, `mobile_money`
- **Payment session status**: `pending`, `processing`, `completed`, `failed`, `expired`, `cancelled`
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

### Revenue Model

Subscription-based. Revenue comes from sellers paying for **Pro plan** access:

- **Free tier**: limited product count (configurable in admin settings, default 20). Full feature set otherwise.
- **Pro plan**: unlimited products, priority support. Billed monthly or yearly via HesabPay invoices.
- **Trial**: configurable trial length (default 7 days) gives new stores Pro features.
- **No per-transaction fee** on orders. Sellers keep 100% of their order revenue (whatever HesabPay or the courier passes through).

### How Pro billing actually works

HesabPay doesn't natively support recurring card-on-file billing, so Pro is implemented as **repeated one-time invoices**:

1. Seller upgrades → invoice generated → HesabPay hosted checkout → webhook activates subscription period
2. Cron sends a reminder email 7 days before the period ends
3. Seller clicks the reminder → new invoice → pays again → period extends
4. **No automatic downgrade yet** — expired subscriptions are handled manually (review + grace period). Build the auto-downgrade later if churn becomes an issue.

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

## Payment System

**HesabPay (hosted checkout) and COD only.**

| Gateway         | Type    | Use Case                                                 |
| --------------- | ------- | -------------------------------------------------------- |
| `hesabpay`      | Online  | Card payments — HesabPay hosts the checkout, we redirect |
| `cod`           | Offline | Cash on Delivery — courier collects at door              |
| `bank_transfer` | Manual  | Bank transfer with manual verification (rarely used)     |
| `mobile_money`  | Manual  | M-Paisa, M-Hawala (rarely used)                          |

### Payment Architecture

```
lib/payments/
├── index.ts              # Payment orchestrator (HesabPay-only API path; COD goes through non-API branch)
├── types.ts              # Common gateway types
└── hesabpay/
    ├── index.ts          # HesabPay exports
    ├── client.ts         # HesabPay API client
    └── types.ts          # HesabPay-specific types

lib/actions/payments.ts            # Server actions for payments
app/api/webhooks/hesabpay/route.ts # HesabPay webhook handler
```

### Payment Flow

1. Customer picks a payment method at checkout
2. Order is created (status: `pending`)
3. If `hesabpay`: create a payment session, redirect to HesabPay's hosted checkout
4. HesabPay redirects back with `?data={success, message, transaction_id}` AND fires a webhook
5. Webhook handler updates the payment session + order to `paid` and `confirmed`
6. If `cod`: skip the redirect, mark the order as confirmed immediately, customer pays the courier

### Currency

**One base currency per store, no live FX.** Each tenant picks a base currency (`tenants.currency`, default AFN) from `currencyOptions` in `lib/validations/stores.ts`. It is chosen in the store-creation wizard and afterwards in Settings → Payments (owner or admin), alongside the AFN rate and the payment-method toggles, because currency decides what customers are actually charged; `lib/currency/currencies.ts` holds the display metadata (symbol, decimals) that `formatPrice()` uses. Every price, order, invoice and dashboard figure for that store is in its base currency. Customers cannot switch currency.

`lib/stores/use-currency-store.tsx` is a `CurrencyProvider` seeded with the store's currency; `currency` and `storeCurrency` are always equal and `rates` is always empty, because there is no customer-side conversion. `components/store/price-display.tsx` is a thin wrapper around `formatPrice()`.

`lib/currency/index.ts` contains no-op `convertToAFN()` / `getExchangeRates()` stubs that exist only so the Amazon/AliExpress dropship importers still compile — they store the source price as-is, and the seller adjusts after import.

#### HesabPay is AFN-only

HesabPay's create-session API has **no currency field**: every `price` it receives is treated as AFN, and HesabPay does not convert. A store priced in another currency must therefore convert before calling it.

- `tenants.afnExchangeRate` — seller-set rate, "1 unit of the store's currency = X AFN". NULL on a non-AFN store means HesabPay is not offered. Ignored for AFN stores.
- `lib/payments/currency.ts` — dependency-free helpers (`resolveHesabPayCharge`, `toAfnAmount`, `fromAfnAmount`, `canStoreUseHesabPay`) shared by server actions and client components so the customer sees exactly what will be charged.
- `getEnabledGateways()` drops HesabPay for a non-AFN store with no rate, and otherwise annotates it with `chargeCurrency` / `chargeExchangeRate` for the storefront to display.
- `createOrderPaymentSession()` converts, then locks `customerCurrency` / `customerAmount` / `exchangeRateUsed` / `exchangeRateLockedAt` onto the order. Retries reuse the locked rate, so a customer is always charged what they were quoted.
- `lib/payments/order-payment.ts` converts the AFN payment back with that locked rate, de-duplicates webhook replays by `gatewayTransactionId`, and writes `order_payments` (the ledger whose triggers sync `orders.amount_paid` — see `drizzle/custom/0005_payment_ledger_cleanup.sql`) plus an `order_transactions` row in the charged currency.

### Database Tables

| Table                     | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `payment_gateway_configs` | Per-tenant gateway enable/order (credential columns are legacy) |
| `payment_sessions`        | Track payment attempts                                          |
| `payment_webhook_events`  | Audit log for webhooks                                          |
| `order_transactions`      | Financial transaction ledger                                    |

### Configuration

Sellers configure payments at `/dashboard/[slug]/settings/payments` (owner or admin): store currency, the AFN exchange rate when they price in something else, which methods are offered, and which is preselected. That page writes `tenants.currency` / `tenants.afnExchangeRate` via `updatePaymentCurrencySettings()` and the per-gateway rows via `savePaymentGatewayConfig()`:

```typescript
// Offer HesabPay on a store, preselected at checkout
await savePaymentGatewayConfig(tenantId, "hesabpay", {
  displayName: "Pay with Card",
  description: "Secure payment via HesabPay",
  isEnabled: true,
  displayOrder: 0,
});
```

HesabPay credentials are **not** per-tenant: the platform's `HESABPAY_API_KEY` env var is used for every store (escrow model). The credential columns on `payment_gateway_configs` (`apiKey`, `merchantPin`, `webhookSecret`, …) are legacy, unused by the UI, and should not be surfaced to client components.

### Seller earnings and payouts

Because credentials are platform-level, a card payment lands in the **platform's** HesabPay account, not the seller's. The platform therefore owes the seller that money and forwards it on request. Cash on delivery never enters this system: the courier hands that money straight to the seller.

Sellers keep 100% of order revenue. Nothing is deducted on the way through; the platform earns from Pro subscriptions only.

| Table                   | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `seller_balances`       | One row per store: available / reserved / lifetime. The row exists to be locked. |
| `seller_ledger_entries` | Append-only movements. Unique on (`reference_type`, `reference_id`).  |
| `seller_payouts`        | One row per withdrawal, with the destination snapshotted.             |

- `lib/payouts/ledger.ts` owns every balance change. Earnings are credited from `recordGatewayPaymentForOrder()` keyed on the `order_transactions` row, so a replayed webhook credits once. Refunds debit from `processRefund()`, converted back to AFN with the order's locked rate, and only for orders actually paid through HesabPay.
- Balances are **AFN**, because that is what HesabPay settled, even when the store prices in another currency.
- `lib/actions/payouts.ts` runs withdrawals in three steps: reserve in a transaction, call HesabPay **outside** any transaction, then settle or reverse. Each status change commits in the same transaction as its ledger movement, so a payout can never claim an outcome its balance has not had applied.
- `sendMoneyToVendors` returns `sent` / `rejected` / `unknown`, and only `rejected` returns the seller's balance. Success needs a positive signal (`success: true`, `status_code: 10`, or a transaction id); the absence of a failure flag is **not** success. Network errors, unreadable bodies, 5xx and unconfirmed 200s are `unknown`: the money stays reserved and the payout stays `processing`. Resolve those on `/admin/payments`, which is the only way out of that state.
- `lib/payouts/errors.ts` types every failure by kind (validation, permission, balance, gateway, configuration, unknown_outcome, unexpected) so the UI can react: inline field errors, HesabPay's own words, or a warning that must not be retried.
- `lib/payouts/account.ts` — a HesabPay account is an Afghan mobile number. Stored as E.164, sent to HesabPay as the 9-digit national number. The dashboard field is the shared `PhoneInput` locked to AF with `countryCallingCodeEditable={false}`; without that prop the country is *not* locked.
- `lib/payments/hesabpay/errors.ts` coerces any gateway payload to one readable string. Never pass a gateway value straight to a toast or a text column: HesabPay returns objects, which become "[object Object]" when stored and crash React when rendered. It also drops echoed request fields and credential values.
- `lib/payments/hesabpay/pin.ts` encrypts the merchant PIN exactly as HesabPay's own WooCommerce plugin does: AES-256-CBC, key = first 32 bytes of the API key (zero-padded), random IV, `base64(IV || ciphertext)`.
- Withdrawing and changing the payout account are **owner-only**; viewing earnings is admin or owner.
- `pnpm earnings:backfill` credits past HesabPay payments into the ledger. Idempotent, and supports `--dry-run`.

### Payment Flow

1. Customer selects payment method at checkout
2. `createOrderPaymentSession()` creates session with gateway
3. Customer redirected to gateway (HesabPay) or confirmation page (COD)
4. Webhook receives payment confirmation
5. Order marked as paid, inventory updated

### Webhook Setup

HesabPay webhook URL: `https://kakamalem.com/api/webhooks/hesabpay`

Credentials are platform-level, so one URL is registered for the whole platform and the optional `?tenantId={tenantId}` query param is normally absent. HesabPay sends no event type — the handler derives success/failure from the payload's `success` flag, and registers separate URLs for the "Payment Success" and "Payment Failure" events.

Matching a webhook back to a payment session, most to least reliable:

1. `session_id` / `memo` against `payment_sessions.gateway_session_id`
2. the order or invoice id echoed back in `items[0].id` — we put it on every line item when creating the session, which is also what HesabPay's own WooCommerce plugin reads
3. tenant + exact amount + created within the hour (only works when `?tenantId=` is present)

Crediting is idempotent: a repeat of the same `transaction_id` is ignored, so webhook retries are safe.

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
